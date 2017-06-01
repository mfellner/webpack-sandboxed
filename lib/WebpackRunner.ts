import path = require('path');
import webpack = require('webpack');
import logger from './logger';
import MemoryFS = require('memory-fs');
import createMemoryFS from './memory-fs';
import * as utils from './utils';

export type WebpackBundle = { [key: string]: string };
export type Options = {
  config?: webpack.Configuration,
  packages?: string[],
  includes?: string[],
  basedir?: string
};

export interface WebpackBaseConfiguration extends webpack.Configuration {
  context: string,
  entry: string,
  output: {
    path: string,
    filename: string
  },
  resolve: webpack.Resolve,
  resolveLoader: webpack.ResolveLoader
}

type OnComplete = (error?: Error, bundle?: WebpackBundle, stats?: webpack.Stats) => void;

interface WebpackCompiler extends webpack.Compiler {
  inputFileSystem: any;
  resolvers: {
    normal: any;
    loader: any;
    context: any;
  };
}

const log = logger('webpack');
const nodeModulesPath = utils.findNodeModulesPath();

export default class WebpackRunner {
  private readonly memfs: MemoryFS;
  private readonly config: WebpackBaseConfiguration;

  constructor(memfs: MemoryFS, config: WebpackBaseConfiguration) {
    this.memfs = memfs;
    this.config = config;
  }

  static async createInstance(options: Options = {}): Promise<WebpackRunner> {
    const packages = options.packages || [];
    const includes = options.includes || [];
    const config: webpack.Configuration = options.config || {};

    // Create webpack configuration.
    // The root directory must match the real installation directory so that tools
    // like Babel can resolve other modules. The node module system actually
    // operates on the real file system and not on memory-fs.
    const root = options.basedir || path.dirname(nodeModulesPath);
    const entry = path.join(root, 'entry.js');
    const output = path.join(root, 'bundle/[name].[chunkhash].js');
    const includesPath = path.join(root, 'includes');

    const baseConfig: WebpackBaseConfiguration = {
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
    const webpackConfig = utils.deepAssign(config, baseConfig) as WebpackBaseConfiguration;

    // Webpack buildins like global, amd-define etc. are required.
    const webpackPath = require.resolve('webpack') && path.join(nodeModulesPath, 'webpack');
    const webpackBuildinPath = path.join(webpackPath, 'buildin');
    packages.push(webpackBuildinPath);
    // This webpack dependency includes node APIs required by other modules, e.g. loaders.
    require.resolve('node-libs-browser') && packages.push('node-libs-browser');

    const memfs = await createMemoryFS({ packages, includes, includesPath, root });
    memfs.mkdirpSync(path.dirname(output));

    return new WebpackRunner(memfs, webpackConfig);
  }

  private runAsync(source: string, onComplete: OnComplete): void {
    const entry = path.join(this.config.context, this.config.entry);
    this.memfs.mkdirpSync(path.dirname(entry));
    this.memfs.writeFileSync(entry, source);

    const outDir = this.config.output.path;
    const compiler = webpack(this.config) as WebpackCompiler;

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
      onComplete(undefined, bundle, stats);
    });
  }

  run(source: string): Promise<[WebpackBundle, webpack.Stats]> {
    return new Promise((resolve, reject) => {
      log.debug('Executing script...');
      this.runAsync(source, (error, bundle, stats) => {
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

  nodeModulesInContext(): string[] {
    return this.memfs.readdirSync(path.join(this.config.context, 'node_modules'));
  }

  toJSON(): object {
    return {
      config: Object.freeze(Object.assign({}, this.config)),
      node_modules: this.nodeModulesInContext().sort()
    };
  }

  toString(): string {
    return JSON.stringify(this.toJSON(), null, 2);
  }
}
