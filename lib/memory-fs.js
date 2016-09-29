// @flow

import fs from 'fs'
import path from 'path'
import MemoryFS from 'memory-fs'
import * as utils from './utils'

export type { MemoryFS as MemoryFS } from 'memory-fs'
type Arguments = {
  packages?: Array<string>,
  includes?: Array<string>,
  root?: string
}

class PackageLoader {
  root: string;
  memfs: MemoryFS;
  cache: { [key: string]: boolean };

  constructor(root: string, memfs: MemoryFS) {
    this.root = root
    this.memfs = memfs
    this.cache = {}
  }

  async loadPackage(nodeModulesPath: string, packageName: string): Promise<void> {
    // Don't resolve the same dependency twice.
    if (this.cache[packageName]) return
    else this.cache[packageName] = true

    const packagePath = path.resolve(nodeModulesPath, packageName)
    try {
      const stats = await utils.fsStat(packagePath)
      if (!stats.isDirectory()) throw new Error(`No such module ${packagePath}`)
    } catch (e) {
      if (e.code === 'ENOENT') throw new Error(`No such module ${packagePath}`)
      else throw e
    }

    await utils.walkDirectory(packagePath, async (file) => {
      const [_, match] = /^.*(node_modules.+)$/.exec(file)
      const exportPath = path.join(this.root, match)

      this.memfs.mkdirpSync(path.dirname(exportPath))
      await utils.fsPipe(fs.createReadStream(file), this.memfs.createWriteStream(exportPath))

      // Also recursively load all dependencies of the loaded module.
      // TODO: optimize
      if (file === path.join(packagePath, 'package.json')) {
        const fileContent = await utils.fsReadFile(file)
        const {dependencies} = JSON.parse(fileContent.toString())
        if (dependencies) {
          await Promise.all(Object.keys(dependencies).map(async (dependency) =>
            await this.loadPackage(nodeModulesPath, dependency)
          ))
        }
      }
    })
  }

  async loadFile(inputPath: string, outputPath: string) {
    const stats = await utils.fsStat(inputPath)

    // If input is a file, load only this file.
    if (stats.isFile()) {
      const resolvedOutputPath = path.resolve(this.root, outputPath)
      this.memfs.mkdirpSync(path.dirname(resolvedOutputPath))
      await utils.fsPipe(fs.createReadStream(inputPath), this.memfs.createWriteStream(resolvedOutputPath))
      return
    }

    // Otherwise recursively load the directory.
    await utils.walkDirectory(inputPath, async (file) => {
      const relativeInputPath = path.relative(inputPath, file)
      const resolvedOutputPath = path.resolve(this.root, outputPath, relativeInputPath)

      this.memfs.mkdirpSync(path.dirname(resolvedOutputPath))
      await utils.fsPipe(fs.createReadStream(file), this.memfs.createWriteStream(resolvedOutputPath))
    })
  }
}

export async function createInstance(args: Arguments = {}): Promise<MemoryFS> {
  const root = args.root || process.cwd()
  const memfs = new MemoryFS()
  const loader = new PackageLoader(root, memfs)

  const [nodeModulesPath] = await utils.findDirectory(process.cwd(), 'node_modules')
  if (!nodeModulesPath) throw new Error(`node_modules not found.`)

  const packages = args.packages || []

  await Promise.all(packages.map(async (p) =>
    await loader.loadPackage(nodeModulesPath, p)
  ))

  const includes = args.includes || []

  await Promise.all(includes.map(async (include) =>
    await loader.loadFile(include, path.join(root, path.basename(include)))
  ))

  return memfs
}
