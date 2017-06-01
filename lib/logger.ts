const prefix = 'webpack-sandboxed';
let debug: any;

try {
  debug = require('debug');
} catch (e) {
  debug = () => () => undefined;
}

export interface Logger {
  debug(...message: any[]): void;
  info(...message: any[]): void;
  warn(...message: any[]): void;
  error(...message: any[]): void;
};

export default function(name: string): Logger {
  return {
    debug: debug(`${prefix}:debug:${name}`),
    info: debug(`${prefix}:info:${name}`),
    warn: debug(`${prefix}:warn:${name}`),
    error: debug(`${prefix}:error:${name}`)
  };
}
