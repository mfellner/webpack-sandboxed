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
  root?: string
};

const log = logger('memory-fs');

class PackageLoader {
  root: string;
  memfs: MemoryFS;
  cache: { [key: string]: boolean };

  constructor(root: string, memfs: MemoryFS) {
    this.root = root;
    this.memfs = memfs;
    this.cache = {};
  }

  resolvePackage(packageName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      requireResolve(
        packageName,
        {
          // Use the path of package.json as fallback for the main file.
          packageFilter: (pkg, pkgJson) =>
            pkg.main ? pkg : Object.assign({}, pkg, { main: pkgJson })
        },
        (error, result) => error ? reject(error) : resolve(result)
      );
    })
      // Extract the package path (the first path segment after node_modules).
      .then(mainFilePath => /(^.*node_modules\/[^\/]+)/.exec(mainFilePath)[1]);
  }

  async loadPackage(packageName: string): Promise<void> {
    // Don't resolve the same dependency twice.
    if (this.cache[packageName]) return;
    else this.cache[packageName] = true;

    const packagePath = await this.resolvePackage(packageName);
    log.debug('Loading %s', packagePath);

    await utils.walkDirectory(packagePath, async file => {
      const match = /^.*(node_modules.+)$/.exec(file)[1];
      const exportPath = path.join(this.root, match);

      this.memfs.mkdirpSync(path.dirname(exportPath));
      await utils.fsPipe(
        fs.createReadStream(file),
        this.memfs.createWriteStream(exportPath)
      );

      // Also recursively load all dependencies of the loaded module.
      // TODO: optimize
      if (file === path.join(packagePath, 'package.json')) {
        const fileContent = await utils.fsReadFile(file);
        const { dependencies } = JSON.parse(fileContent.toString());
        if (dependencies) {
          await Promise.all(
            Object.keys(dependencies)
              .map(async dependency => await this.loadPackage(dependency))
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
      const resolvedOutputPath = path.resolve(
        this.root,
        outputPath,
        relativeInputPath
      );

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
  const packages = args.packages || [];

  log.debug('Loading packages...');
  await Promise.all(packages.map(async p => await loader.loadPackage(p)));

  const includes = args.includes || [];

  log.debug('Loading includes...');
  await Promise.all(
    includes.map(
      async include =>
        await loader.loadFile(include, path.join(root, path.basename(include)))
    )
  );

  return memfs;
}
