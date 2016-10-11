'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.findDirectory = exports.walkDirectory = undefined;

let walkDirectory = exports.walkDirectory = (() => {
  var _ref = _asyncToGenerator(function* (root, callback) {
    let files = [];
    try {
      files = yield fsReaddir(root);
      if (files.length === 0) return [];
    } catch (e) {
      if (e.code === 'ENOENT') return [];else throw e;
    }

    let filePaths = [];

    for (let file of files) {
      const filePath = _path2.default.resolve(root, file);
      const stats = yield fsStat(filePath);

      if (stats.isDirectory()) {
        yield walkDirectory(filePath, callback);
      } else {
        filePaths = filePaths.concat(filePath);
        if (callback) yield callback(filePath);
      }
    }
    return filePaths;
  });

  return function walkDirectory(_x, _x2) {
    return _ref.apply(this, arguments);
  };
})();

let findDirectory = exports.findDirectory = (() => {
  var _ref2 = _asyncToGenerator(function* (root, name, ignore = IGNORE_DEFAULT) {
    if (root.endsWith(_path2.default.basename(name))) return [root];

    let files = [];
    try {
      files = yield fsReaddir(root);
      if (files.length === 0) return [];
    } catch (e) {
      if (e.code === 'ENOENT') return [];else throw e;
    }

    const fileInfos = yield Promise.all(files.map(function (file) {
      return _path2.default.resolve(root, file);
    }).map((() => {
      var _ref3 = _asyncToGenerator(function* (file) {
        const stats = yield fsStat(file);
        const isDirectory = stats.isDirectory();
        return { file, isDirectory };
      });

      return function (_x6) {
        return _ref3.apply(this, arguments);
      };
    })()));

    const isNotIgnored = function (file) {
      return ignore.reduce(function (ignore, pattern) {
        return ignore && !pattern.test(file);
      }, true);
    };

    const subDirs = fileInfos.filter(function (info) {
      return info.isDirectory && isNotIgnored(info.file);
    }).map(function (info) {
      return info.file;
    });

    const moreDirs = yield Promise.all(subDirs.map((() => {
      var _ref4 = _asyncToGenerator(function* (dir) {
        return yield findDirectory(dir, name);
      });

      return function (_x7) {
        return _ref4.apply(this, arguments);
      };
    })()));

    return moreDirs.reduce(function (dirs, dir) {
      return dirs.concat(dir);
    }, []);
  });

  return function findDirectory(_x3, _x4, _x5) {
    return _ref2.apply(this, arguments);
  };
})();

exports.fsReaddir = fsReaddir;
exports.fsReadFile = fsReadFile;
exports.fsStat = fsStat;
exports.fsPipe = fsPipe;
exports.stringify = stringify;
exports.deepAssign = deepAssign;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function fsReaddir(dirpath) {
  return new Promise((resolve, reject) => {
    _fs2.default.readdir(dirpath, (error, files) => {
      if (error) return reject(error);else return resolve(files);
    });
  });
}

function fsReadFile(filepath) {
  return new Promise((resolve, reject) => {
    _fs2.default.readFile(filepath, (error, data) => {
      if (error) return reject(error);else return resolve(data);
    });
  });
}

function fsStat(dirpath) {
  return new Promise((resolve, reject) => {
    _fs2.default.stat(dirpath, (error, stats) => {
      if (error) return reject(error);else return resolve(stats);
    });
  });
}

function fsPipe(inStream, outStream) {
  return new Promise((resolve, reject) => {
    inStream.pipe(outStream);
    outStream.on('finish', () => resolve());
    outStream.on('error', error => reject(error));
  });
}

const IGNORE_DEFAULT = [/\.git/, /dist/];

function stringify(value, escape) {
  if (value === null || typeof value === 'undefined') {
    return '';
  } else if (value instanceof RegExp) {
    return value.toString();
  } else if (Array.isArray(value)) {
    return `[${ value.map(e => stringify(e, escape)).join(',') }]`;
  } else if (typeof value === 'object') {
    let string = '{';
    const keys = Object.keys(value);

    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      string += `${ key }: ${ stringify(value[key], escape) }`;
      if (i < keys.length - 1) string += ', ';
    }
    return string + '}';
  } else if (typeof value === 'string' && typeof escape === 'string' && value.startsWith(escape)) {
    return value.substring(escape.length);
  } else {
    return JSON.stringify(value);
  }
}

function deepAssign(...objects) {
  const obj = objects[0];
  for (let i = 1; i < objects.length; i += 1) {
    const other = objects[i];
    for (let key of Object.keys(other)) {
      const val = other[key];
      if (Array.isArray(val)) {
        if (Array.isArray(obj[key])) {
          const arr = [].concat(obj[key]);
          for (let x of val) {
            if (!arr.includes(x)) {
              arr.push(x);
            }
          }
          obj[key] = arr;
        } else {
          obj[key] = val;
        }
      } else if (typeof val === 'object') {
        obj[key] = deepAssign({}, obj[key] || {}, val);
      } else {
        obj[key] = val;
      }
    }
  }
  return obj;
}