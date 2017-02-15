// @flow

import vm from 'vm';
import path from 'path';
import webpack from 'webpack';
import logger from './logger';
import * as memoryfs from './memory-fs';
import * as utils from './utils';

type WebpackBundle = { [key: string]: string };
type WebpackStats = {
  hasErrors: () => boolean,
  hasWarnings: () => boolean,
  toJson: (options: ?Object) => Object,
  toString: (options: ?Object) => Object
};
type WebpackTarget =
  | 'web'
  | 'webworker'
  | 'node'
  | 'async-node'
  | 'node-webkit'
  | 'electron';
type WebpackConfig = {
  context?: string,
  entry?: string | { [key: string]: string },
  context?: string,
  output?: {
    path: string,
    filename: string
  },
  module?: {
    loaders: Array<Object>
  },
  target?: WebpackTarget,
  plugins?: Array<Object> | '@plugins'
};
type OnComplete = (
  error: ?Error,
  bundle: ?WebpackBundle,
  stats: ?WebpackStats
) => void;
type Options = {
  config?: WebpackConfig,
  packages?: Array<string>,
  includes?: Array<string>
};

const log = logger('webpack');

export class SandboxVM {
  globals: Object;

  constructor(globals: Object = {}) {
    this.globals = globals;
  }

  run(source: string, onComplete: OnComplete): any {
    try {
      const script = new vm.Script(source, { displayErrors: true });
      const sandbox = Object.assign({}, this.globals, { onComplete });
      const context = vm.createContext(sandbox);
      return script.runInContext(context);
    } catch (error) {
      return onComplete(error);
    }
  }
}

export class WebpackRunner {
  vm: SandboxVM;
  memfs: memoryfs.MemoryFS;
  entry: string;
  script: string;

  constructor(vm: SandboxVM, memfs: memoryfs.MemoryFS, entry: string) {
    this.vm = vm;
    this.memfs = memfs;
    this.entry = entry;

    // The webpack script to run in the sandbox VM. Relies on global variables to be present.
    this.script = `
    const outDir = webpackConfig.output.path
    const compiler = webpack(webpackConfig)
    compiler.inputFileSystem = memfs
    compiler.resolvers.normal.fileSystem = memfs
    compiler.resolvers.context.fileSystem = memfs
    compiler.outputFileSystem = memfs
    compiler.run((error, stats) => {
      if (error) return onComplete(error)
      const files = memfs.readdirSync(outDir)
      const bundle = files.reduce((bundle, file) =>
        Object.assign(bundle, {[file]: memfs.readFileSync(path.join(outDir, file)).toString()})
      , {})
      memfs.rmdirSync(outDir)
      onComplete(null, bundle, stats)
    })
    `;
  }

  static async createInstance(options: Options = {}): Promise<WebpackRunner> {
    const packages = options.packages || [];
    const includes = options.includes || [];
    const config = options.config || {};

    // Create webpack configuration.
    // The root directory must match the real installation directory so that packages
    // like Babel can resolve other modules. The node module system in the sandbox
    // operates on the real file system and not on memory-fs.
    // We use the base path of the memory-fs module that should be installed
    // alongside the webpack-sandboxed module and its dependants.
    const root = /^(.*)node_modules/.exec(require.resolve('memory-fs'))[1];
    const entry = path.join(root, 'entry.js');
    const output = path.join(root, 'bundle/[name]-[hash].min.js');
    const baseConfig: WebpackConfig = {
      context: path.dirname(entry),
      entry: `./${path.basename(entry)}`,
      output: {
        path: path.dirname(output),
        filename: path.basename(output)
      }
    };
    const webpackConfig = utils.deepAssign(baseConfig, config);

    const memfs = await memoryfs.createInstance({ packages, includes, root });
    memfs.mkdirpSync(path.dirname(output));

    // Initialize VM with global variables to be used in the webpack script.
    const vm = new SandboxVM({
      path,
      webpack,
      memfs,
      webpackConfig
    });

    return new WebpackRunner(vm, memfs, entry);
  }

  async __run(source: string, onComplete: OnComplete) {
    this.memfs.mkdirpSync(path.dirname(this.entry));
    this.memfs.writeFileSync(this.entry, source);
    this.vm.run(this.script, (error, bundle, stats) =>
      onComplete(error, bundle, stats));
  }

  async run(source: string): Promise<[WebpackBundle, WebpackStats]> {
    return new Promise(async (resolve, reject) => {
      log.debug('Executing script...');
      await this.__run(source, (error, bundle, stats) => {
        if (error) {
          log.error('Failed to execute script.');
          reject(error);
        } else if (stats && stats.hasErrors()) {
          log.error('Script finished with errors.');
          reject(stats.toString());
        } else if (bundle && stats) {
          log.debug('Successfully compiled bundle.');
          resolve([bundle, stats]);
        } else {
          log.error('Failed to execute script.');
          reject(new Error('Unknown error.'));
        }
      });
    });
  }
}
