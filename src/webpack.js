// @flow

import vm from 'vm'
import path from 'path'
import webpack from 'webpack'
import * as memoryfs from './memory-fs'

type WebpackBundle = { [key: string]: string }
type WebpackStats = {
  hasErrors: () => boolean,
  hasWarnings: () => boolean,
  toJson: (options: ?Object) => Object,
  toString: (options: ?Object) => Object
}
type WebpackTarget = 'web' | 'webworker' | 'node' | 'async-node' | 'node-webkit' | 'electron'
type WebpackDefinitions = { [key: string]: string }
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
    const sandbox = Object.assign({}, this.globals, {__onComplete: onComplete})
    const context = vm.createContext(sandbox)

    return script.runInContext(context)
  }
}

export class WebpackRunner {
  vm: SandboxVM;
  memfs: memoryfs.MemoryFS;
  target: WebpackTarget;
  packages: Array<string>;
  definitions: WebpackDefinitions;

  constructor(vm: SandboxVM, memfs: memoryfs.MemoryFS, target: WebpackTarget, packages: Array<string>, definitions: WebpackDefinitions) {
    this.vm = vm
    this.memfs = memfs;
    this.target = target;
    this.packages = packages;
  }

  static async createInstance(target: WebpackTarget = 'web', packages: Array<string> = [], definitions: WebpackDefinitions = {}): Promise<WebpackRunner> {
    const memfs = await memoryfs.createInstance(packages)
    const vm = new SandboxVM({
      __path: path,
      __webpack: webpack,
      __fs: memfs
    })
    const __definitions = Object.assign({'process.env.NODE_ENV': 'production'}, definitions)
    return new WebpackRunner(vm, memfs, target, packages, __definitions)
  }

  async __run(source: string, onComplete: OnComplete) {
    const entry = '/src/entry.js'
    const outFile = '/bundle/[name]-[hash].min.js'

    this.memfs.mkdirpSync(path.dirname(entry))
    this.memfs.mkdirpSync(path.dirname(outFile))
    this.memfs.writeFileSync(entry, source)

    const script = createWebpackScript(this.target, entry, outFile, this.definitions)

    this.vm.run(script, (error, bundle, stats) => {
      this.memfs.rmdirSync('/src')
      this.memfs.rmdirSync('/bundle')
      onComplete(error, bundle, stats)
    })
  }

  async run(source: string): Promise<[WebpackBundle, WebpackStats]> {
    return new Promise(async (resolve, reject) => {
      await this.__run(source, (error, bundle, stats) => {
        if (error) reject(error)
        else resolve([bundle, stats])
      })
    })
  }
}

function createWebpackScript(target: WebpackTarget, entry: string, outFile: string, definitions: WebpackDefinitions = {}): string {
  return `
  const outDir = '${path.dirname(outFile)}'
  const outFile = '${path.basename(outFile)}'
  const compiler = __webpack({
    target: '${target}',
    context: '${path.dirname(entry)}',
    entry: './${path.basename(entry)}',
    output: {
      path: outDir,
      filename: outFile
    },
    module: {
      loaders: []
    },
    plugins: [
      new __webpack.DefinePlugin(${JSON.stringify(definitions)})
    ]
  })
  compiler.inputFileSystem = __fs
  compiler.resolvers.normal.fileSystem = __fs
  compiler.resolvers.context.fileSystem = __fs
  compiler.outputFileSystem = __fs
  compiler.run((error, stats) => {
    const files = __fs.readdirSync(outDir)
    const bundle = files.reduce((bundle, file) =>
      Object.assign(bundle, {[file]: __fs.readFileSync(__path.join(outDir, file)).toString()})
    , {})
    __onComplete(error, bundle, stats)
  })
  `
}
