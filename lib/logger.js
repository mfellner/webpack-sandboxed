// @flow

const prefix = 'webpack-sandboxed'
let debug

try {
  debug = require('debug')
} catch(e) {
  debug = () => () => undefined
}

type Logger = {
  debug: (...message: Array<mixed>) => void;
  info: (...message: Array<mixed>) => void;
  warn: (...message: Array<mixed>) => void;
  error: (...message: Array<mixed>) => void;
}

export default function (name: string): Logger {
  return {
    debug: debug(`${prefix}:debug:${name}`),
    info: debug(`${prefix}:info:${name}`),
    warn: debug(`${prefix}:warn:${name}`),
    error: debug(`${prefix}:error:${name}`)
  }
}
