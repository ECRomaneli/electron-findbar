const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const InlineCssPlugin = require('./inline-css-plugin');

const isDev = process.env.NODE_ENV === 'development';
const devtool = isDev ? 'source-map' : false;

module.exports = [
  // Entry 1: Main process
  {
    mode: isDev ? 'development' : 'production',
    devtool,
    entry: './src/main.ts',
    target: 'electron-main',
    output: {
      filename: 'main.js',
      path: path.resolve(__dirname, 'dist'),
      libraryTarget: 'commonjs2',
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    externals: {
      electron: 'commonjs2 electron',
    },
    optimization: {
      minimize: !isDev,
    },
  },

  // Entry 2: Preload script
  {
    mode: isDev ? 'development' : 'production',
    devtool,
    entry: './src/preload.ts',
    target: 'electron-preload',
    output: {
      filename: 'preload.js',
      path: path.resolve(__dirname, 'dist'),
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    externals: {
      electron: 'commonjs2 electron',
    },
    optimization: {
      minimize: !isDev,
    },
  },

  // Entry 3: Remote IPC module
  {
    mode: isDev ? 'development' : 'production',
    devtool,
    entry: './src/remote.ts',
    target: 'web',
    output: {
      filename: 'remote.js',
      path: path.resolve(__dirname, 'dist'),
      libraryTarget: 'commonjs2',
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    externals: {
      electron: 'commonjs2 electron',
    },
    resolve: {
      extensions: ['.ts', '.js'],
      fallback: {
        fs: false,
        path: false,
      },
    },
    optimization: {
      minimize: !isDev,
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/index.html',
        filename: 'index.html',
        inject: false,
        minify: isDev ? false : {
          removeComments: true,
          collapseWhitespace: true,
          removeRedundantAttributes: true,
          useShortDoctype: true,
          removeEmptyAttributes: true,
          removeStyleLinkTypeAttributes: true,
          keepClosingSlash: true,
          minifyJS: true,
          minifyCSS: true,
          minifyURLs: true,
        },
      }),
      new InlineCssPlugin(),
    ],
  },
];
