import ExtractTextPlugin = require('extract-text-webpack-plugin');
import fs = require('fs');
import path = require('path');
import webpack = require('webpack');
import { Plugin } from 'webpack';
import webpackSandboxed from '../lib';

// Script source to compile with webpack.
const source = `
import React from 'react';
import ReactDOM from 'react-dom';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import Paper from 'material-ui/Paper';
import Image from 'components/Image';

const Main = () => (
  <MuiThemeProvider>
    <div style={{ display: 'flex' }}>
      <div style={{ flex: '0 0 50%' }}>
        <Paper style={{ padding: '10px', textAlign: 'center' }}>
          <h1>Hello, world!</h1>
          <Image alt="Meow!" src="http://i.giphy.com/vFKqnCdLPNOKc.gif" />
        </Paper>
      </div>
    </div>
  </MuiThemeProvider>
);

ReactDOM.render(<Main />, document.getElementById('main'));
`;

// HTML template to inject compiled output into.
const html = ({ js, css }: { js: string; css: string }) =>
  `
<html>
  <head>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/react/16.0.0/umd/react.development.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/16.0.0/umd/react-dom.development.js"></script>
    <style>${css}</style>
  <head/>
  <body>
    <div id="main"></div>
  </body>
  <script>${js}</script>
</html>
`;

async function main() {
  console.info('Starting webpack-sandboxed…');
  console.time('Initialization time');

  // Optional webpack plugins for optimization.
  const productionPlugins: Plugin[] = [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production')
    }),
    new webpack.optimize.UglifyJsPlugin()
  ];

  const plugins: Plugin[] = [
    new ExtractTextPlugin('[name].[contenthash].css'),
    ...productionPlugins
  ];

  const webpackSandbox = await webpackSandboxed({
    config: {
      target: 'web',
      module: {
        rules: [
          {
            test: /\.js$/,
            exclude: /node_modules/,
            loader: 'babel-loader',
            options: {
              presets: ['es2015', 'react'],
              babelrc: false
            }
          },
          {
            test: /\.css$/,
            use: ExtractTextPlugin.extract({
              fallback: 'style-loader',
              use: {
                loader: 'css-loader',
                options: {
                  modules: true
                }
              }
            })
          }
        ]
      },
      externals: {
        react: 'React',
        'react-dom': 'ReactDOM'
      },
      plugins
    },
    // Packages to load into the virtual filesystem.
    packages: [
      'babel-loader',
      'style-loader',
      'css-loader',
      'extract-text-webpack-plugin',
      'material-ui'
    ],
    // Local files to load into the virtual filesystem.
    includes: [path.resolve(__dirname, 'components')],
    // For module resolution to work, the base directory needs to be equal to
    // the parent directory of node_modules where all necessary packages are installed.
    basedir: path.resolve(__dirname, '../')
  });

  console.timeEnd('Initialization time');
  // console.log('Webpack Sandbox: %s', webpackSandbox);

  const [bundle, stats] = await webpackSandbox.run(source);
  console.info(stats.toString({ colors: true }));

  const fileNames = Object.keys(bundle);
  console.info('Created files', fileNames);

  // Collect all source strings.
  const js = '\n'.concat(
    ...fileNames.filter(f => f.endsWith('.js')).map(f => bundle[f].toString())
  );
  const css = '\n'.concat(
    ...fileNames.filter(f => f.endsWith('.css')).map(f => bundle[f].toString())
  );

  // Generate markup from a string.
  const markup = html({ js, css });
  const file = path.resolve(__dirname, './index.html');
  fs.writeFileSync(file, markup);
  console.info('Wrote file %s', file);
}

main().catch(console.error);
