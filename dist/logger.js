'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (name) {
  return {
    debug: debug(`${ prefix }:debug:${ name }`),
    info: debug(`${ prefix }:info:${ name }`),
    warn: debug(`${ prefix }:warn:${ name }`),
    error: debug(`${ prefix }:error:${ name }`)
  };
};

const prefix = 'webpack-sandboxed';
let debug;

try {
  debug = require('debug');
} catch (e) {
  debug = () => () => undefined;
}