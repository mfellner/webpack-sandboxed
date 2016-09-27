// @flow

import vm from 'vm'
import path from 'path'
import webpack from 'webpack'
import * as memoryfs from './memory-fs'
import * as utils from './utils'

type WebpackBundle = { [key: string]: string }
type WebpackStats = {
  hasErrors: () => boolean,
  hasWarnings: () => boolean,
  toJson: (options: ?Object) => Object,
  toString: (options: ?Object) => Object
}
type WebpackTarget = 'web' | 'webworker' | 'node' | 'async-node' | 'node-webkit' | 'electron'
type WebpackConfig = {
  context?: string,
  entry?: string | { [key: string]: string },
  context?: string,
  output?: {
    path: string,
    filename: string
  },
  module?: {
    loaders: Array<Object>,
  },
  target?: WebpackTarget,
  plugins?: Array<Object> | '@plugins'
}
type OnComplete = (error: Error, bundle: WebpackBundle, stats: WebpackStats) => void

export class SandboxVM {
  globals: Object;

  constructor(globals: Object = {}) {
    this.globals = globals
  }

  run(source: string, onComplete: OnComplete): any {
    const script = new vm.Script(source, {
      displayErrors: true
    })
    const sandbox = Object.assign({}, this.globals, {onComplete})
    const context = vm.createContext(sandbox)

    return script.runInContext(context)
  }
}

export class WebpackRunner {
  vm: SandboxVM;
  memfs: memoryfs.MemoryFS;
  packages: Array<string>;
  entry: string;
  output: string;
  plugins: Array<Object>;
  script: string;

  constructor(vm: SandboxVM, memfs: memoryfs.MemoryFS, packages: Array<string>, config: ?WebpackConfig) {
    this.vm = vm
    this.memfs = memfs;
    this.packages = packages;

    this.entry = '/src/entry.js'
    this.output = '/bundle/[name]-[hash].min.js'

    const baseConfig: WebpackConfig = {
      context: path.dirname(this.entry),
      entry: `./${path.basename(this.entry)}`,
      output: {
        path: path.dirname(this.output),
        filename: path.basename(this.output)
      },
      module: {
        loaders: []
      },
      plugins: '@plugins' // variable-literal
    }

    const configString = utils.stringify(Object.assign(baseConfig, config), '@')

    // The webpack script to run in the sandbox VM. Relies on global variables to be present.
    this.script = `
    const outDir = '${path.dirname(this.output)}'
    const outFile = '${path.basename(this.output)}'
    const compiler = webpack(${configString})
    compiler.inputFileSystem = fs
    compiler.resolvers.normal.fileSystem = fs
    compiler.resolvers.context.fileSystem = fs
    compiler.outputFileSystem = fs
    compiler.run((error, stats) => {
     const files = fs.readdirSync(outDir)
     const bundle = files.reduce((bundle, file) =>
       Object.assign(bundle, {[file]: fs.readFileSync(path.join(outDir, file)).toString()})
     , {})
     onComplete(error, bundle, stats)
    })
    `
  }

  static async createInstance(packages: Array<string> = [], config: WebpackConfig = {}): Promise<WebpackRunner> {
    const {plugins, ...otherConfig} = config

    const memfs = await memoryfs.createInstance(packages)
    // Initialize VM with global variables to be used in the webpack script.
    const vm = new SandboxVM({
      path: path,
      webpack: webpack,
      fs: memfs,
      plugins: plugins || []
    })

    return new WebpackRunner(vm, memfs, packages, otherConfig)
  }

  async __run(source: string, onComplete: OnComplete) {
    this.memfs.mkdirpSync(path.dirname(this.entry))
    this.memfs.mkdirpSync(path.dirname(this.output))
    this.memfs.writeFileSync(this.entry, source)

    this.vm.run(this.script, (error, bundle, stats) => {
      this.memfs.rmdirSync('/src')
      this.memfs.rmdirSync('/bundle')
      onComplete(error, bundle, stats)
    })
  }

  async run(source: string): Promise<[WebpackBundle, WebpackStats]> {
    return new Promise(async (resolve, reject) => {
      await this.__run(source, (error, bundle, stats) => {
        if (error) reject(error)
        else if (stats.hasErrors()) reject(stats.toString())
        else resolve([bundle, stats])
      })
    })
  }
}
