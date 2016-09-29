// @flow

import fs from 'fs'
import path from 'path'
import webpack from 'webpack'
import WebpackRunner from '../lib'

const source = `
import React from 'react'
import ReactDOM from 'react-dom'
import Container from './components/Container'
import Image from './components/Image'

ReactDOM.render(<Container>
  <Image src="http://i.giphy.com/vFKqnCdLPNOKc.gif"/>
  </Container>,
  document.getElementById('main'))
`

const html = code => `
<html>
  <body>
    <div id="main"></div>
  </body>
  <script>${code}</script>
</html>
`

async function main() {
  console.log('Starting...')
  console.time('WebpackRunner')

  const runner = await WebpackRunner.createInstance({
    config: {
      target: 'web',
      module: {
        loaders: [{
          test: /\.js$/, exclude: /node_modules/, loader: 'babel', query: {
            presets: ['es2015', 'react']
          }
        }]
      },
      // externals: {
      //   'react': 'React',
      //   'react-dom': 'ReactDOM'
      // },
      plugins: [
        new webpack.DefinePlugin({process: {env: {NODE_ENV: '"production"'}}}),
        new webpack.optimize.UglifyJsPlugin(),
        new webpack.optimize.DedupePlugin()
      ]
    },
    // Packages to load into the virtual filesystem.
    packages: [
      'react',
      'react-dom'
    ],
    // Local files to load into the virtual filesystem.
    includes: [
      path.resolve(__dirname, 'components')
    ]
  })

  console.log('Initialized WebpackRunner!')
  console.timeEnd('WebpackRunner')

  const [bundle, stats] = await runner.run(source)
  console.log(stats.toString())

  const bundleNames = Object.keys(bundle)
  console.log('Created bundle(s)', bundleNames)

  const markup = html(bundle[bundleNames[0]])
  const file = path.resolve(__dirname, './index.html')
  fs.writeFileSync(file, markup)
  console.log('Wrote file %s', file)
}

main().catch(err => console.error(err))
