import fs = require('fs');
import path = require('path');

export function fsReaddir(dirpath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    fs.readdir(dirpath, (error, files) => {
      if (error) return reject(error);
      else return resolve(files);
    });
  });
}

export function fsReadFile(filepath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    fs.readFile(filepath, (error, data) => {
      if (error) return reject(error);
      else return resolve(data);
    });
  });
}

export function fsStat(dirpath: string): Promise<fs.Stats> {
  return new Promise((resolve, reject) => {
    fs.stat(dirpath, (error, stats) => {
      if (error) return reject(error);
      else return resolve(stats);
    });
  });
}

export function fsPipe(inStream: fs.ReadStream, outStream: fs.WriteStream): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    inStream.pipe(outStream);
    outStream.on('finish', () => resolve());
    outStream.on('error', (e: Error) => reject(e));
  });
}

export async function walkDirectory(
  root: string,
  callback?: (file: string) => Promise<void>
): Promise<string[]> {
  let files: string[] = [];
  try {
    files = await fsReaddir(root);
    if (files.length === 0) return [];
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    else throw e;
  }

  return Promise.all(
    files.map(async file => {
      const filePath = path.resolve(root, file);
      const stats = await fsStat(filePath);

      if (stats.isDirectory()) {
        return walkDirectory(filePath, callback);
      } else {
        if (callback) await callback(filePath);
        return [filePath];
      }
    })
  ).then(paths => paths.reduce((collected, subPaths) => collected.concat(subPaths)));
}

export type Assignable = { [key: string]: any };

export function deepAssign(...objects: Assignable[]): Assignable {
  const obj = objects[0];
  for (let i = 1; i < objects.length; i += 1) {
    const other = objects[i];
    for (const key of Object.keys(other)) {
      const val = other[key];
      if (Array.isArray(val)) {
        if (Array.isArray(obj[key])) {
          const arr: any[] = [].concat(obj[key]);
          for (const x of val) {
            if (!arr.includes(x)) {
              arr.push(x);
            }
          }
          obj[key] = arr;
        } else {
          obj[key] = val;
        }
      } else if (typeof val === 'object') {
        obj[key] = deepAssign({}, obj[key] || {}, val);
      } else {
        obj[key] = val;
      }
    }
  }
  return obj;
}

/**
 * Find the absolute path of the node modules install directory.
 *
 * We use the base path of the memory-fs module that should be
 * installed alongside the webpack-sandboxed module by default.
 *
 * Example: /foo/bar/node_modules/memory-fs => /foo/bar/node_modules
 */
export function findNodeModulesPath(): string {
  const match = /^(.*)(\/|\\)memory-fs(\/|\\)/.exec(require.resolve('memory-fs'));
  if (!match) {
    throw new Error('memory-fs is not installed!');
  }
  return match[1];
}
