const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");
const TypescriptDeclarationPlugin = require('typescript-declaration-webpack-plugin');

module.exports = (env, options) => {
  const minify = !!env.minify;
  const isLibrary = !!env.library;
  return {
    entry: isLibrary ? {
      pixiApng: './src/index.ts'
    } : {
      demo: './demo/demo.ts'
    },
    output: {
      path: path.resolve(__dirname, `dist${isLibrary ? '/lib' : '/demo'}`),
      filename: '[name].js',
      assetModuleFilename: 'img/[name][ext][query]',
      clean: isLibrary,
      ...(isLibrary ? {
        library: {
          name: 'pixiApng',
          type: 'umd',
        }
      } : {}),
    },
    optimization: {
      chunkIds: 'named',
      minimize: minify,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            mangle: true, // Note `mangle.properties` is `false` by default.
          },
          extractComments: false
        }),
        new CssMinimizerPlugin(),
      ],
    },
    devtool: 'source-map',
    devServer: {
      compress: true,
      port: 9000,
    },
    module: {
      rules: [
        {
          test: /\.html$/,
          use: [
            {
              loader: 'html-loader', // replace img urls
            }
          ],
        },
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.(png|apng)$/i,
          type: 'asset/resource'
        }
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.d.ts'],
    },
    plugins: [
      ...(isLibrary ? [] : [
        new HtmlWebpackPlugin({
          template: 'demo/index.html',
          filename: 'index.html',
          chunks: ['demo'],
          chunksSortMode: 'manual',
          minify: minify
        }),
        new CopyPlugin({
          patterns: [
            { from: "demo/img", to: "img" },
          ],
        }),
      ]),
      new TypescriptDeclarationPlugin({
        out: 'pixiApng.d.ts',
        removeMergedDeclarations: false,
        removeComments: false
      }),
    ],
    ...(isLibrary ? { externals: /^(pixi.js)/i } : {}),

  };
};
