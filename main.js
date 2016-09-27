// @flow

import webpack from 'webpack'
import WebpackRunner from './src/index'

const source = 'var react = require("react");\nconsole.log("Hello!")'

async function main() {
  const runner = await WebpackRunner.createInstance(['process', 'react'], {
    target: 'web',
    plugins: [
      new webpack.DefinePlugin({'process.env.NODE_ENV': 'production'})
    ]
  })
  const [bundle, stats] = await runner.run(source)
  console.log(stats.toString())
  // console.log(JSON.stringify(bundle))
}

main().catch(err => console.error(err))

// function configToString(config) {
//   if (config instanceof RegExp) {
//     return config.toString()
//   } else if (Array.isArray(config)) {
//     return `[${config.map(e => configToString(e)).join(',')}]`
//   } else if (typeof config === 'object') {
//     let string = '{'
//     const keys = Object.keys(config)
//
//     for (let i = 0; i < keys.length; i += 1) {
//       const key = keys[i]
//       const value = config[key]
//       string += `${key}: ${configToString(value)}`
//       if (i < keys.length - 1) string += ', '
//     }
//     return string + '}'
//   } else {
//     return JSON.stringify(config)
//   }
// }
