// @flow

import webpack from 'webpack'
import WebpackRunner from '../src/index'

const source = 'var react = require("react");\nconsole.log("Hello!")'

async function main() {
  const runner = await WebpackRunner.createInstance({
    config: {
      target: 'web',
      plugins: [
        new webpack.DefinePlugin({process: {env: {NODE_ENV: '"production"'}}}),
        new webpack.optimize.UglifyJsPlugin(),
        new webpack.optimize.DedupePlugin()
      ]
    },
    packages: ['react']
  })
  const [bundle, stats] = await runner.run(source)
  console.log(stats.toString())
  // console.log(JSON.stringify(bundle))
}

main().catch(err => console.error(err))
