const isWeapp = process.env.TARO_ENV === 'weapp'

module.exports = {
  presets: [
    [
      'taro',
      {
        framework: 'react',
        ts: true,
        compiler: 'webpack5',
        ...(isWeapp
          ? {
              // The package-level browserslist is tuned for H5 and leaves mini-program
              // bundles with modern syntax. Force weapp output down to older targets so
              // WeChat real-device debugging doesn't require the devtools ES5 rewriter.
              targets: {
                ios: '9',
                android: '5'
              },
              forceAllTransforms: true
            }
          : {})
      }
    ]
  ]
}
