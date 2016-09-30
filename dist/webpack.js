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

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var _memoryFs = require('./memory-fs');

var memoryfs = _interopRequireWildcard(_memoryFs);

var _utils = require('./utils');

var utils = _interopRequireWildcard(_utils);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const log = (0, _logger2.default)('webpack');

class SandboxVM {

  constructor(globals = {}) {
    this.globals = globals;
  }

  run(source, onComplete) {
    try {
      const script = new _vm2.default.Script(source, { displayErrors: true });
      const sandbox = Object.assign({}, this.globals, { onComplete });
      const context = _vm2.default.createContext(sandbox);
      return script.runInContext(context);
    } catch (error) {
      return onComplete(error);
    }
  }
}

exports.SandboxVM = SandboxVM;
class WebpackRunner {

  constructor(vm, memfs, entry) {
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

  static createInstance(options = {}) {
    return _asyncToGenerator(function* () {
      const packages = options.packages || [];
      const includes = options.includes || [];
      const config = options.config || {};

      // Create webpack configuration.
      // The root directory must match the real cwd so that packages like Babel
      // can resolve other modules. The node module system in the sandbox operates
      // on the real file system and not on memory-fs.
      const root = process.cwd();
      const entry = _path2.default.join(root, 'entry.js');
      const output = _path2.default.join(root, 'bundle/[name]-[hash].min.js');
      const baseConfig = {
        context: _path2.default.dirname(entry),
        entry: `./${ _path2.default.basename(entry) }`,
        output: {
          path: _path2.default.dirname(output),
          filename: _path2.default.basename(output)
        }
      };
      const webpackConfig = Object.assign(baseConfig, config);

      const memfs = yield memoryfs.createInstance({ packages, includes, root });
      memfs.mkdirpSync(_path2.default.dirname(output));

      // Initialize VM with global variables to be used in the webpack script.
      const vm = new SandboxVM({
        path: _path2.default,
        webpack: _webpack2.default,
        memfs,
        webpackConfig
      });

      return new WebpackRunner(vm, memfs, entry);
    })();
  }

  __run(source, onComplete) {
    var _this = this;

    return _asyncToGenerator(function* () {
      _this.memfs.mkdirpSync(_path2.default.dirname(_this.entry));
      _this.memfs.writeFileSync(_this.entry, source);
      _this.vm.run(_this.script, function (error, bundle, stats) {
        return onComplete(error, bundle, stats);
      });
    })();
  }

  run(source) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      return new Promise((() => {
        var _ref = _asyncToGenerator(function* (resolve, reject) {
          log.debug('Executing script...');
          yield _this2.__run(source, function (error, bundle, stats) {
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

        return function (_x, _x2) {
          return _ref.apply(this, arguments);
        };
      })());
    })();
  }
}
exports.WebpackRunner = WebpackRunner;