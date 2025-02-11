/**
 * @license
 *
 * Copyright IBM Corp. 2020, 2023
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

const path = require('path');
const sass = require('sass');
const rtlcss = require('rtlcss');
const deepReplace = require('../tools/deep-replace');

const { getPaths } = deepReplace;
const useRtl = process.env.STORYBOOK_CARBON_CUSTOM_ELEMENTS_USE_RTL === 'true';

const arrayify = (value) =>
  Array.isArray(value) ? value : value != null ? [value] : []; // eslint-disable-line no-nested-ternary

module.exports = {
  stories: [
    './bootstrap-story.ts',
    '../docs/**/*-story.mdx',
    '../src/**/*-story.ts',
  ],
  addons: [
    '@storybook/addon-actions',
    '@storybook/addon-docs',
    {
      name: '@storybook/addon-essentials',
      options: {
        actions: true,
        backgrounds: false,
        controls: true,
        docs: true,
        toolbars: true,
        viewport: true,
      },
    },
    '@storybook/addon-knobs',
    '@storybook/addon-storysource',
    path.resolve(__dirname, 'addon-knobs-args'),
  ],
  managerWebpack(config) {
    // Ignores our `.babelrc` for manager
    config.module.rules = deepReplace(
      config.module.rules,
      (value, key, parent) =>
        key === 'options' && /babel-loader/i.test(parent.loader),
      (value) => ({
        ...value,
        babelrc: false,
        configFile: false,
      })
    );
    return config;
  },
  webpackFinal(config) {
    // Uses `@babel/plugin-proposal-decorators` configuration in our `.babelrc`
    config.module.rules = deepReplace(
      config.module.rules,
      (value, key, parent, parents) =>
        getPaths(parents) === 'use.options.plugins' &&
        Array.isArray(value) &&
        /@babel\/plugin-proposal-decorators/i.test(value[0]),
      () => deepReplace.DELETE
    );
    // Normalizes several plugins with `loose: false` option
    config.module.rules = deepReplace(
      config.module.rules,
      (value, key, parent, parents) =>
        getPaths(parents) === 'use.options.plugins' &&
        Array.isArray(value) &&
        value[1] &&
        value[1].loose,
      (value) => [
        value[0],
        {
          ...value[1],
          loose: false,
        },
      ]
    );

    config.module.rules.push(
      {
        test: /@carbon[\\/]icons[\\/]/i,
        use: [
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              presets: [
                [
                  '@babel/preset-env',
                  {
                    modules: false,
                    targets: ['last 1 version', 'Firefox ESR'],
                  },
                ],
              ],
            },
          },
          require.resolve('../tools/svg-result-carbon-icon-loader'),
        ],
      },
      {
        test: /\.scss$/,
        sideEffects: true,
        use: [
          'cache-loader',
          require.resolve('../tools/css-result-loader'),
          {
            loader: 'postcss-loader',
            options: {
              plugins: () => [
                require('../tools/postcss-fix-host-pseudo')(),
                require('autoprefixer')(),
                ...(useRtl ? [rtlcss] : []),
              ],
            },
          },
          {
            loader: 'sass-loader',
            options: {
              additionalData: `
                $feature-flags: (
                  enable-css-custom-properties: true,
                );
              `,
              implementation: sass,
              webpackImporter: false,
              sassOptions: {
                includePaths: [
                  path.resolve(__dirname, '..', 'node_modules'),
                  path.resolve(__dirname, '../../../', 'node_modules'),
                ],
              },
            },
          },
        ],
      },
      {
        test: /\.html$/,
        use: 'file-loader',
      }
    );

    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }
    // In our development environment (where `@carbon/web-components/es/icons` may not have been built yet),
    // we load icons from `@carbon/icons` and use a WebPack loader to convert the icons to `lit-html` version
    config.resolve.alias['@carbon/web-components/es/icons'] =
      '@carbon/icons/lib';

    return config;
  },
};
