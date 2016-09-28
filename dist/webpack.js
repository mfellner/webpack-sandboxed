'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WebpackRunner = exports.SandboxVM = undefined;

var _vm = require('vm');

var _vm2 = _interopRequireDefault(_vm);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _webpack = require('webpack');

var _webpack2 = _interopRequireDefault(_webpack);

var _memoryFs = require('./memory-fs');

var memoryfs = _interopRequireWildcard(_memoryFs);

var _utils = require('./utils');

var utils = _interopRequireWildcard(_utils);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { return step("next", value); }, function (err) { return step("throw", err); }); } } return step("next"); }); }; }

class SandboxVM {

  constructor(globals = {}) {
    this.globals = globals;
  }

  run(source, onComplete) {
    const script = new _vm2.default.Script(source, {
      displayErrors: true
    });
    const sandbox = Object.assign({}, this.globals, { onComplete });
    const context = _vm2.default.createContext(sandbox);

    return script.runInContext(context);
  }
}

exports.SandboxVM = SandboxVM;
class WebpackRunner {

  constructor(vm, memfs, packages, config) {
    this.vm = vm;
    this.memfs = memfs;
    this.packages = packages;

    this.entry = '/src/entry.js';
    this.output = '/bundle/[name]-[hash].min.js';

    const baseConfig = {
      context: _path2.default.dirname(this.entry),
      entry: `./${ _path2.default.basename(this.entry) }`,
      output: {
        path: _path2.default.dirname(this.output),
        filename: _path2.default.basename(this.output)
      },
      module: {
        loaders: []
      },
      resolve: {
        root: '/',
        modulesDirectories: ['node_modules']
      },
      plugins: '@plugins' // variable-literal
    };

    const configString = utils.stringify(Object.assign(baseConfig, config), '@');

    // The webpack script to run in the sandbox VM. Relies on global variables to be present.
    this.script = `
    const outDir = '${ _path2.default.dirname(this.output) }'
    const outFile = '${ _path2.default.basename(this.output) }'
    const compiler = webpack(${ configString })
    compiler.inputFileSystem = memfs
    compiler.resolvers.normal.fileSystem = memfs
    compiler.resolvers.context.fileSystem = memfs
    compiler.outputFileSystem = memfs
    compiler.run((error, stats) => {
     const files = memfs.readdirSync(outDir)
     const bundle = files.reduce((bundle, file) =>
       Object.assign(bundle, {[file]: memfs.readFileSync(path.join(outDir, file)).toString()})
     , {})
     onComplete(error, bundle, stats)
    })
    `;
  }

  static createInstance(options = {}) {
    return _asyncToGenerator(function* () {
      const packages = options.packages || [];
      const config = options.config || {};
      const plugins = config.plugins;

      const otherConfig = _objectWithoutProperties(config, ['plugins']);

      const memfs = yield memoryfs.createInstance(packages);
      // Initialize VM with global variables to be used in the webpack script.
      const vm = new SandboxVM({
        path: _path2.default,
        webpack: _webpack2.default,
        plugins,
        memfs
      });

      return new WebpackRunner(vm, memfs, packages, otherConfig);
    })();
  }

  __run(source, onComplete) {
    var _this = this;

    return _asyncToGenerator(function* () {
      _this.memfs.mkdirpSync(_path2.default.dirname(_this.entry));
      _this.memfs.mkdirpSync(_path2.default.dirname(_this.output));
      _this.memfs.writeFileSync(_this.entry, source);

      _this.vm.run(_this.script, function (error, bundle, stats) {
        _this.memfs.rmdirSync('/src');
        _this.memfs.rmdirSync('/bundle');
        onComplete(error, bundle, stats);
      });
    })();
  }

  run(source) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      return new Promise((() => {
        var _ref = _asyncToGenerator(function* (resolve, reject) {
          yield _this2.__run(source, function (error, bundle, stats) {
            if (error) reject(error);else if (stats.hasErrors()) reject(stats.toString());else resolve([bundle, stats]);
          });
        });

        return function (_x, _x2) {
          return _ref.apply(this, arguments);
        };
      })());
    })();
  }
}
exports.WebpackRunner = WebpackRunner;