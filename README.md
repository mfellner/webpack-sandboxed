# webpack-sandboxed

Webpack in a Sandbox.

**Usage:**

```javascript
import WebpackSandbox from 'webpack-sandboxed'

const options = {
  config: { /* webpack configuration */ },
  packages: [ /* names of modules to load in the sandbox */ ]
}
const sandbox = await WebpackSandbox.createInstance(options)
const [bundle, stats] = sandbox.run("exports = {foo: 'bar'};")
```

**References:**

* https://github.com/webpack/webpack/issues/1562
* https://github.com/christianalfoni/webpack-bin/issues/106
* https://github.com/christianalfoni/webpack-bin
