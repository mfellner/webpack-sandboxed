'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createInstance = undefined;

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

let createInstance = exports.createInstance = (() => {
  var _ref4 = _asyncToGenerator(function* (args = {}) {
    const root = args.root || process.cwd();
    const memfs = new _memoryFs2.default();
    const loader = new PackageLoader(root, memfs);

    var _ref5 = yield utils.findDirectory(process.cwd(), 'node_modules');

    var _ref6 = _slicedToArray(_ref5, 1);

    const nodeModulesPath = _ref6[0];

    if (!nodeModulesPath) throw new Error(`node_modules not found.`);

    const packages = args.packages || [];

    log.debug('Loading packages...');
    yield Promise.all(packages.map((() => {
      var _ref7 = _asyncToGenerator(function* (p) {
        return yield loader.loadPackage(nodeModulesPath, p);
      });

      return function (_x5) {
        return _ref7.apply(this, arguments);
      };
    })()));

    const includes = args.includes || [];

    log.debug('Loading includes...');
    yield Promise.all(includes.map((() => {
      var _ref8 = _asyncToGenerator(function* (include) {
        return yield loader.loadFile(include, _path2.default.join(root, _path2.default.basename(include)));
      });

      return function (_x6) {
        return _ref8.apply(this, arguments);
      };
    })()));

    return memfs;
  });

  return function createInstance(_x4) {
    return _ref4.apply(this, arguments);
  };
})();

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _memoryFs = require('memory-fs');

var _memoryFs2 = _interopRequireDefault(_memoryFs);

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var _utils = require('./utils');

var utils = _interopRequireWildcard(_utils);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const log = (0, _logger2.default)('memory-fs');

class PackageLoader {

  constructor(root, memfs) {
    this.root = root;
    this.memfs = memfs;
    this.cache = {};
  }

  loadPackage(nodeModulesPath, packageName) {
    var _this = this;

    return _asyncToGenerator(function* () {
      // Don't resolve the same dependency twice.
      if (_this.cache[packageName]) return;else _this.cache[packageName] = true;

      const packagePath = _path2.default.resolve(nodeModulesPath, packageName);
      try {
        const stats = yield utils.fsStat(packagePath);
        if (!stats.isDirectory()) throw new Error(`No such module ${ packagePath }`);
      } catch (e) {
        if (e.code === 'ENOENT') throw new Error(`No such module ${ packagePath }`);else throw e;
      }

      yield utils.walkDirectory(packagePath, (() => {
        var _ref = _asyncToGenerator(function* (file) {
          var _$exec = /^.*(node_modules.+)$/.exec(file);

          var _$exec2 = _slicedToArray(_$exec, 2);

          const _ = _$exec2[0];
          const match = _$exec2[1];

          const exportPath = _path2.default.join(_this.root, match);

          _this.memfs.mkdirpSync(_path2.default.dirname(exportPath));
          yield utils.fsPipe(_fs2.default.createReadStream(file), _this.memfs.createWriteStream(exportPath));

          // Also recursively load all dependencies of the loaded module.
          // TODO: optimize
          if (file === _path2.default.join(packagePath, 'package.json')) {
            const fileContent = yield utils.fsReadFile(file);

            var _JSON$parse = JSON.parse(fileContent.toString());

            const dependencies = _JSON$parse.dependencies;

            if (dependencies) {
              yield Promise.all(Object.keys(dependencies).map((() => {
                var _ref2 = _asyncToGenerator(function* (dependency) {
                  return yield _this.loadPackage(nodeModulesPath, dependency);
                });

                return function (_x2) {
                  return _ref2.apply(this, arguments);
                };
              })()));
            }
          }
        });

        return function (_x) {
          return _ref.apply(this, arguments);
        };
      })());
    })();
  }

  loadFile(inputPath, outputPath) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      const stats = yield utils.fsStat(inputPath);

      // If input is a file, load only this file.
      if (stats.isFile()) {
        const resolvedOutputPath = _path2.default.resolve(_this2.root, outputPath);
        _this2.memfs.mkdirpSync(_path2.default.dirname(resolvedOutputPath));
        yield utils.fsPipe(_fs2.default.createReadStream(inputPath), _this2.memfs.createWriteStream(resolvedOutputPath));
        return;
      }

      // Otherwise recursively load the directory.
      yield utils.walkDirectory(inputPath, (() => {
        var _ref3 = _asyncToGenerator(function* (file) {
          const relativeInputPath = _path2.default.relative(inputPath, file);
          const resolvedOutputPath = _path2.default.resolve(_this2.root, outputPath, relativeInputPath);

          _this2.memfs.mkdirpSync(_path2.default.dirname(resolvedOutputPath));
          yield utils.fsPipe(_fs2.default.createReadStream(file), _this2.memfs.createWriteStream(resolvedOutputPath));
        });

        return function (_x3) {
          return _ref3.apply(this, arguments);
        };
      })());
    })();
  }
}