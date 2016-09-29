// @flow

import fs from 'fs'
import path from 'path'

export function fsReaddir(dirpath: string) {
  return new Promise((resolve, reject) => {
    fs.readdir(dirpath, (error, files) => {
      if (error) return reject(error)
      else return resolve(files)
    })
  })
}

export function fsReadFile(filepath: string) {
  return new Promise((resolve, reject) => {
    fs.readFile(filepath, (error, data) => {
      if (error) return reject(error)
      else return resolve(data)
    })
  })
}

export function fsStat(dirpath: string): Promise<fs.Stats> {
  return new Promise((resolve, reject) => {
    fs.stat(dirpath, (error, stats) => {
      if (error) return reject(error)
      else return resolve(stats)
    })
  })
}

export function fsPipe(inStream: fs.ReadStream, outStream: fs.WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    inStream.pipe(outStream)
    outStream.on('finish', () => resolve())
    outStream.on('error', error => reject(error))
  })
}

export async function walkDirectory(root: string, callback: ?(file: string) => Promise<void>): Promise<Array<string>> {
  let files = []
  try {
    files = await fsReaddir(root)
    if (files.length === 0) return []
  } catch (e) {
    if (e.code === 'ENOENT') return []
    else throw e
  }

  let filePaths = []

  for (let file of files) {
    const filePath = path.resolve(root, file)
    const stats = await fsStat(filePath)

    if (stats.isDirectory()) {
      await walkDirectory(filePath, callback)
    } else {
      filePaths = filePaths.concat(filePath)
      if (callback) await callback(filePath)
    }
  }
  return filePaths
}

const IGNORE_DEFAULT = [/\.git/, /dist/]

export async function findDirectory(root: string, name: string, ignore: Array<RegExp> = IGNORE_DEFAULT): Promise<Array<string>> {
  if (root.endsWith(path.basename(name))) return [root]

  let files = []
  try {
    files = await fsReaddir(root)
    if (files.length === 0) return []
  } catch (e) {
    if (e.code === 'ENOENT') return []
    else throw e
  }

  const fileInfos = await Promise.all(files
    .map(file => path.resolve(root, file))
    .map(async (file) => {
      const stats = await fsStat(file)
      const isDirectory = stats.isDirectory()
      return {file, isDirectory}
    }))

  const isNotIgnored = (file: string) => ignore.reduce((ignore, pattern) => ignore && !pattern.test(file), true)

  const subDirs = fileInfos
    .filter(info => info.isDirectory && isNotIgnored(info.file))
    .map(info => info.file)

  const moreDirs = await Promise.all(subDirs.map(async (dir) => await findDirectory(dir, name)))

  return moreDirs.reduce((dirs, dir) => dirs.concat(dir), [])
}

export function stringify(value: mixed, escape: ?string): string {
  if (value === null || typeof value === 'undefined'){
    return ''
  } else if (value instanceof RegExp) {
    return value.toString()
  } else if (Array.isArray(value)) {
    return `[${value.map(e => stringify(e, escape)).join(',')}]`
  } else if (typeof value === 'object') {
    let string = '{'
    const keys = Object.keys(value)

    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i]
      string += `${key}: ${stringify(value[key], escape)}`
      if (i < keys.length - 1) string += ', '
    }
    return string + '}'
  } else if (typeof value === 'string' && typeof escape === 'string' && value.startsWith(escape)) {
    return value.substring(escape.length)
  } else {
    return JSON.stringify(value)
  }
}
