import path = require('path');
import createMemoryFS from './memory-fs';
import { deepAssign, findNodeModulesPath } from './utils';
import WebpackRunner, { Options, WebpackBaseConfiguration } from './WebpackRunner';

export default async function createInstance(options: Options = {}): Promise<WebpackRunner> {
  const packages = options.packages || [];
  const includes = options.includes || [];
  const config = options.config || {};
  const nodeModulesPath = findNodeModulesPath();

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
  const webpackConfig = deepAssign(config, baseConfig) as WebpackBaseConfiguration;

  // Webpack buildins like global, amd-define etc. are required.
  const webpackPath = require.resolve('webpack') && path.join(nodeModulesPath, 'webpack');
  const webpackBuildinPath = path.join(webpackPath, 'buildin');
  packages.push(webpackBuildinPath);
  // This webpack dependency includes node APIs required by other modules, e.g. loaders.
  if (require.resolve('node-libs-browser')) packages.push('node-libs-browser');

  const memfs = await createMemoryFS({ packages, includes, includesPath, root });
  memfs.mkdirpSync(path.dirname(output));

  return new WebpackRunner(memfs, webpackConfig);
}
