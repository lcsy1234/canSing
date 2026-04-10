import type { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'

import './app.scss'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    console.log('Harmonic Precision launched.')
  })

  return children
}

export default App
