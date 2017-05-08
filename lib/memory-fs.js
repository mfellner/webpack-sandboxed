// @flow

import fs from 'fs';
import path from 'path';
import requireResolve from 'resolve';
import MemoryFS from 'memory-fs';
import logger from './logger';
import * as utils from './utils';

export type { MemoryFS } from 'memory-fs';
type Arguments = {
  packages?: Array<string>,
  includes?: Array<string>,
  includesPath?: string,
  root?: string
};

const log = logger('memory-fs');
const nodeModulesDirName = path.basename(utils.findNodeModulesPath());

class PackageLoader {
  root: string;
  memfs: MemoryFS;
  cache: { [key: string]: boolean };

  constructor(root: string, memfs: MemoryFS) {
    this.root = root;
    this.memfs = memfs;
    this.cache = {};
  }

  async resolvePackage(packageName: string): Promise<string> {
    const mainFilePath = await new Promise((resolve, reject) => {
      requireResolve(
        packageName,
        {
          basedir: this.root,
          // Use the path of package.json as fallback for the main file.
          packageFilter: (pkg, pkgJson) =>
            pkg.main ? pkg : Object.assign({}, pkg, { main: pkgJson })
        },
        (error, result) => (error ? reject(error) : resolve(result))
      );
    });
    // Extract the package path (excluding the path of the main file).
    return new RegExp(`(.*.${nodeModulesDirName}.${packageName}).`).exec(mainFilePath)[1];
  }

  async loadPackage(packageName: string): Promise<void> {
    // Don't resolve the same dependency twice.
    if (this.cache[packageName]) return;
    else this.cache[packageName] = true;

    let packagePath;
    if (path.isAbsolute(packageName)) {
      packagePath = packageName;
    } else {
      try {
        packagePath = await this.resolvePackage(packageName);
      } catch (e) {
        log.error(e.message, e.code);
        return;
      }
    }

    await utils.walkDirectory(packagePath, async file => {
      // Extract the file path inside the node modules directory.
      const match = new RegExp(`.*.${nodeModulesDirName}(.+)`).exec(file)[1];
      const exportPath = path.join(this.root, 'node_modules', match);

      this.memfs.mkdirpSync(path.dirname(exportPath));
      await utils.fsPipe(fs.createReadStream(file), this.memfs.createWriteStream(exportPath));

      // Also recursively load all dependencies of the loaded module.
      // TODO: optimize
      if (file === path.join(packagePath, 'package.json')) {
        const fileContent = await utils.fsReadFile(file);
        const { dependencies } = JSON.parse(fileContent.toString());
        if (dependencies) {
          await Promise.all(
            Object.keys(dependencies).map(async dependency => await this.loadPackage(dependency))
          );
        }
      }
    });
  }

  async loadFile(inputPath: string, outputPath: string) {
    const stats = await utils.fsStat(inputPath);

    // If input is a file, load only this file.
    if (stats.isFile()) {
      const resolvedOutputPath = path.resolve(this.root, outputPath);
      this.memfs.mkdirpSync(path.dirname(resolvedOutputPath));
      await utils.fsPipe(
        fs.createReadStream(inputPath),
        this.memfs.createWriteStream(resolvedOutputPath)
      );
      return;
    }

    // Otherwise recursively load the directory.
    await utils.walkDirectory(inputPath, async file => {
      const relativeInputPath = path.relative(inputPath, file);
      const resolvedOutputPath = path.resolve(this.root, outputPath, relativeInputPath);

      this.memfs.mkdirpSync(path.dirname(resolvedOutputPath));
      await utils.fsPipe(
        fs.createReadStream(file),
        this.memfs.createWriteStream(resolvedOutputPath)
      );
    });
  }
}

export async function createInstance(args: Arguments = {}): Promise<MemoryFS> {
  const root = args.root || process.cwd();
  const memfs = new MemoryFS();
  const loader = new PackageLoader(root, memfs);
  const packages = Array.from(new Set(args.packages || []));

  log.debug('Load packages %o', packages);
  await Promise.all(packages.map(async p => await loader.loadPackage(p)));

  const includes = args.includes || [];
  const includesPath = args.includesPath || 'includes';
  const absIncludesPath = path.isAbsolute(includesPath)
    ? includesPath
    : path.join(root, includesPath);

  log.debug('Load includes %o', includes);
  await Promise.all(
    includes.map(
      async include =>
        await loader.loadFile(include, path.join(absIncludesPath, path.basename(include)))
    )
  );

  return memfs;
}
