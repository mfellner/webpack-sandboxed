// @flow

import path from 'path'
import MemoryFS from 'memory-fs'
import * as utils from './utils'

export type { MemoryFS as MemoryFS } from 'memory-fs'

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
    const stats = await utils.fsStat(packagePath)
    if (!stats.isDirectory()) throw new Error(`No such module ${packagePath}`)

    await utils.walkDirectory(packagePath, async (file) => {
      const [_, match] = /^.*(node_modules.+)$/.exec(file)
      const exportPath = path.join(this.root, match)

      const fileContent = await utils.fsReadFile(file)
      this.memfs.mkdirpSync(path.dirname(exportPath))
      this.memfs.writeFileSync(exportPath, fileContent)

      // Also recursively load all dependencies of the loaded module.
      // TODO: optimize
      if (file.endsWith('package.json')) {
        const {dependencies} = JSON.parse(fileContent.toString())
        if (dependencies) {
          await Promise.all(Object.keys(dependencies).map(async (dependency) =>
            await this.loadPackage(nodeModulesPath, dependency)
          ))
        }
      }
    })
  }
}

export async function createInstance(packages: Array<string> = []): Promise<MemoryFS> {
  const memfs = new MemoryFS()
  const loader = new PackageLoader('/', memfs)

  const [nodeModulesPath] = await utils.findDirectory(process.cwd(), 'node_modules')
  if (!nodeModulesPath) throw new Error(`node_modules not found.`)

  await Promise.all(packages.map(async (p) =>
    await loader.loadPackage(nodeModulesPath, p)
  ))

  return memfs
}
