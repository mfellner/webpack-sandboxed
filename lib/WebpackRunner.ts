import path = require('path');
import webpack = require('webpack');
import logger from './logger';
import MemoryFS = require('memory-fs');

export type WebpackBundle = { [key: string]: string };
export type Options = {
  config?: webpack.Configuration;
  packages?: string[];
  includes?: string[];
  basedir?: string;
};

export interface WebpackBaseConfiguration extends webpack.Configuration {
  context: string;
  entry: string;
  output: {
    path: string;
    filename: string;
  };
  resolve: webpack.Resolve;
  resolveLoader: webpack.ResolveLoader;
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

export default class WebpackRunner {
  private readonly memfs: MemoryFS;
  private readonly config: WebpackBaseConfiguration;

  constructor(memfs: MemoryFS, config: WebpackBaseConfiguration) {
    this.memfs = memfs;
    this.config = config;
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
        (object, file) =>
          Object.assign(object, {
            [file]: this.memfs.readFileSync(path.join(outDir, file)).toString()
          }),
        {}
      );
      this.memfs.rmdirSync(outDir);
      onComplete(undefined, bundle, stats);
    });
  }

  public run(source: string): Promise<[WebpackBundle, webpack.Stats]> {
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

  private nodeModulesInContext(): string[] {
    return this.memfs.readdirSync(path.join(this.config.context, 'node_modules'));
  }

  public toJSON(): object {
    return {
      config: Object.freeze(Object.assign({}, this.config)),
      node_modules: this.nodeModulesInContext().sort()
    };
  }

  public toString(): string {
    return JSON.stringify(this.toJSON(), null, 2);
  }
}
