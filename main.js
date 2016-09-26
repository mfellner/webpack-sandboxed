// @flow

import WebpackRunner from './src/index'

const source = 'var react = require("react");\nconsole.log("Hello!")'

async function main() {
  const runner = await WebpackRunner.createInstance(['react'])
  const [bundle, stats] = await runner.run(source)
  console.log(stats.toString())
  // console.log(JSON.stringify(bundle))
}

main().catch(err => console.error(err))
