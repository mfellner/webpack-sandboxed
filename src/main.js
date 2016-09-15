const runWebpack = require('./webpack-sandboxed')

const source = 'console.log("Hello!")'

runWebpack(source)
  .then(([bundle, stats]) => {
    console.log(stats.toString())
    console.log(JSON.stringify(bundle))
  })
  .catch(err => console.error(err))
