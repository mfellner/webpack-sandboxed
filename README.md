# webpack-sandboxed &nbsp; [![npm version](https://badge.fury.io/js/webpack-sandboxed.svg)](https://badge.fury.io/js/webpack-sandboxed) [![Build Status](https://travis-ci.org/mfellner/webpack-sandboxed.svg?branch=master)](https://travis-ci.org/mfellner/webpack-sandboxed) [![Coverage Status](https://coveralls.io/repos/github/mfellner/webpack-sandboxed/badge.svg?branch=master)](https://coveralls.io/github/mfellner/webpack-sandboxed?branch=master) [![Code Climate](https://codeclimate.com/github/mfellner/webpack-sandboxed/badges/gpa.svg)](https://codeclimate.com/github/mfellner/webpack-sandboxed)

Webpack in a Sandbox.

**Usage:**

```typescript
import WebpackSandbox = require('webpack-sandboxed')

const options = {
  config: { /* webpack configuration */ },
  packages: [ /* names of modules to load in the sandbox */ ],
  includes: [ /* local file paths to load in the sandbox */ ]
}
const sandbox = await WebpackSandbox.createInstance(options)
const [bundle, stats] = sandbox.run("exports = {foo: 'bar'};")
```

**References:**

* https://github.com/webpack/webpack/issues/1562
* https://github.com/christianalfoni/webpack-bin/issues/106
* https://github.com/christianalfoni/webpack-bin
