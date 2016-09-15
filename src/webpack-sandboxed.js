const vm = require('vm')
const path = require('path')
const webpack = require('webpack')
const MemoryFS = require('memory-fs')

function runScript(source, globals = {}) {
  const context = createContext(globals)
  const script = new vm.Script(source, {
    displayErrors: true
  })
  return script.runInContext(context)
}

function createContext(globals) {
  const _globals = {
    module: {},
    exports: {}
  }
  _globals.module.exports = _globals.exports
  const sandbox = Object.assign({}, global, _globals, globals)
  sandbox.exports = sandbox.module
  return vm.createContext(sandbox)
}

function getWebpackScript(entry, outFile) {
  return `
  const outDir = '${path.dirname(outFile)}'
  const outFile = '${path.basename(outFile)}'
  const compiler = __webpack({
    context: '${path.dirname(entry)}',
    entry: './${path.basename(entry)}',
    output: {
      path: outDir,
      filename: outFile
    },
    module: {
      loaders: []
    }
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

function runWebpack(source, onComplete) {
  const entry = '/src/entry.js'
  const outFile = '/bundle/[name]-[hash].min.js'
  const memfs = new MemoryFS()

  memfs.mkdirpSync(path.dirname(entry))
  memfs.mkdirpSync(path.dirname(outFile))
  memfs.writeFileSync(entry, source)

  const script = getWebpackScript(entry, outFile)

  runScript(script, {
    __path: path,
    __webpack: webpack,
    __fs: memfs,
    __onComplete: onComplete
  })
}

function promiseRunWebpack(source) {
  return new Promise((resolve, reject) => {
    runWebpack(source, (error, bundle, stats) => {
      if (error) reject(error)
      else resolve([bundle, stats])
    })
  })
}

module.exports = promiseRunWebpack
