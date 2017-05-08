// @flow

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

type WebpackTarget = 'web' | 'webworker' | 'node' | 'async-node' | 'node-webkit' | 'electron';

type WebpackConfig = {
  context: string,
  entry: string,
  context: string,
  output: {
    path: string,
    filename: string
  },
  module: {
    loaders: Array<Object>
  },
  target: WebpackTarget,
  plugins: Array<Object>
};

type OnComplete = (error: ?Error, bundle: ?WebpackBundle, stats: ?WebpackStats) => void;

type Options = {
  config?: WebpackConfig,
  packages?: Array<string>,
  includes?: Array<string>,
  basedir?: string
};

const log = logger('webpack');
const nodeModulesPath = utils.findNodeModulesPath();

export class WebpackRunner {
  memfs: memoryfs.MemoryFS;
  config: WebpackConfig;

  constructor(memfs: memoryfs.MemoryFS, config: WebpackConfig) {
    this.memfs = memfs;
    this.config = config;
  }

  static async createInstance(options: Options = {}): Promise<WebpackRunner> {
    const packages = options.packages || [];
    const includes = options.includes || [];
    const config = options.config || {};

    // Create webpack configuration.
    // The root directory must match the real installation directory so that tools
    // like Babel can resolve other modules. The node module system actually
    // operates on the real file system and not on memory-fs.
    const root = options.basedir || path.dirname(nodeModulesPath);
    const entry = path.join(root, 'entry.js');
    const output = path.join(root, 'bundle/[name].[chunkhash].js');
    const includesPath = path.join(root, 'includes');

    const baseConfig = {
      context: path.dirname(entry),
      entry: `./${path.basename(entry)}`,
      output: {
        path: path.dirname(output),
        filename: path.basename(output)
      },
      resolve: {
        modules: [path.resolve('node_modules'), path.join(root, 'node_modules'), includesPath]
      },
      resolveLoader: {
        modules: [path.resolve('node_modules'), path.join(root, 'node_modules')]
      }
    };
    const webpackConfig = utils.deepAssign(baseConfig, config);

    // Webpack buildins like global, amd-define etc. are required.
    const webpackPath = require.resolve('webpack') && path.join(nodeModulesPath, 'webpack');
    const webpackBuildinPath = path.join(webpackPath, 'buildin');
    packages.push(webpackBuildinPath);
    // This webpack dependency includes node APIs required by other modules, e.g. loaders.
    require.resolve('node-libs-browser') && packages.push('node-libs-browser');

    const memfs = await memoryfs.createInstance({ packages, includes, includesPath, root });
    memfs.mkdirpSync(path.dirname(output));

    return new WebpackRunner(memfs, webpackConfig);
  }

  async runAsync(source: string, onComplete: OnComplete) {
    const entry = path.join(this.config.context, this.config.entry);
    this.memfs.mkdirpSync(path.dirname(entry));
    this.memfs.writeFileSync(entry, source);

    const outDir = this.config.output.path;
    const compiler = webpack(this.config);

    compiler.inputFileSystem = this.memfs;
    compiler.outputFileSystem = this.memfs;
    compiler.resolvers.normal.fileSystem = this.memfs;
    compiler.resolvers.loader.fileSystem = this.memfs;
    compiler.resolvers.context.fileSystem = this.memfs;

    compiler.run((error, stats) => {
      if (error) return onComplete(error);
      const files = this.memfs.readdirSync(outDir);
      const bundle = files.reduce(
        (bundle, file) =>
          Object.assign(bundle, {
            [file]: this.memfs.readFileSync(path.join(outDir, file)).toString()
          }),
        {}
      );
      this.memfs.rmdirSync(outDir);
      onComplete(null, bundle, stats);
    });
  }

  async run(source: string): Promise<[WebpackBundle, WebpackStats]> {
    return new Promise(async (resolve, reject) => {
      log.debug('Executing script...');
      await this.runAsync(source, (error, bundle, stats) => {
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

  nodeModulesInContext(): Array<string> {
    return this.memfs.readdirSync(path.join(this.config.context, 'node_modules'));
  }

  toJSON() {
    return {
      config: Object.freeze(Object.assign({}, this.config)),
      node_modules: this.nodeModulesInContext().sort()
    };
  }

  toString() {
    return JSON.stringify(this.toJSON(), null, 2);
  }
}
