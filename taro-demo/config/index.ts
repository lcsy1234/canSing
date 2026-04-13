import fs from 'fs'
import path from 'path'
import { defineConfig, type UserConfigExport } from '@tarojs/cli'
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'
import devConfig from './dev'
import prodConfig from './prod'

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const entries = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separatorIndex = line.indexOf('=')

      if (separatorIndex === -1) {
        return null
      }

      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim()

      return key ? [key, value] : null
    })
    .filter((entry): entry is [string, string] => Boolean(entry))

  return Object.fromEntries(entries)
}

function resolveMiniProgramApiBaseUrl(): string {
  const nodeEnv = process.env.NODE_ENV === 'development' ? 'development' : 'production'
  const projectRoot = path.resolve(__dirname, '..')
  const env = {
    ...readEnvFile(path.resolve(projectRoot, '.env')),
    ...readEnvFile(path.resolve(projectRoot, `.env.${nodeEnv}`))
  }

  return env.TARO_APP_API_BASE_URL ?? process.env.TARO_APP_API_BASE_URL ?? 'http://127.0.0.1:3001'
}

export default defineConfig<'webpack5'>(async (merge) => {
  const apiBaseUrl = resolveMiniProgramApiBaseUrl()

  const baseConfig: UserConfigExport<'webpack5'> = {
    projectName: 'taro-demo',
    date: '2026-04-10',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: ['@tarojs/plugin-generator'],
    defineConstants: {
      'process.env.TARO_APP_API_BASE_URL': JSON.stringify(apiBaseUrl)
    },
    copy: {
      patterns: [],
      options: {}
    },
    framework: 'react',
    compiler: 'webpack5',
    cache: {
      enable: false
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
      webpackChain(chain) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin)
      }
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      output: {
        filename: 'js/[name].[contenthash:8].js',
        chunkFilename: 'js/[name].[contenthash:8].js'
      },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[contenthash:8].css',
        chunkFilename: 'css/[name].[contenthash:8].css'
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
      webpackChain(chain) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin)
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, devConfig)
  }

  return merge({}, baseConfig, prodConfig)
})
