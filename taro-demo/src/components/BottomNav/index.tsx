import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'

import './index.scss'

type BottomNavTab = 'home' | 'processing' | 'history'

interface BottomNavProps {
  active: BottomNavTab
}

const items: Array<{
  key: BottomNavTab
  label: string
  icon: string
  url?: string
}> = [
  {
    key: 'home',
    label: '学唱',
    icon: '♪',
    url: '/pages/index/index'
  },
  {
    key: 'processing',
    label: '识别',
    icon: '◉'
  },
  {
    key: 'history',
    label: '历史',
    icon: '↺',
    url: '/pages/history/index'
  }
]

export default function BottomNav({ active }: BottomNavProps) {
  const handleClick = async (item: (typeof items)[number]) => {
    if (item.key === active) {
      return
    }

    if (item.key === 'processing') {
      await Taro.showToast({
        title: '从首页上传或录音后，会自动进入识别页',
        icon: 'none'
      })
      return
    }

    if (item.url) {
      await Taro.redirectTo({ url: item.url })
    }
  }

  return (
    <View className='bottom-nav safe-bottom'>
      {items.map((item) => {
        const isActive = item.key === active

        return (
          <View
            key={item.key}
            className={`bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}
            onClick={() => {
              void handleClick(item)
            }}
          >
            <Text className='bottom-nav__icon'>{item.icon}</Text>
            <Text className='bottom-nav__label'>{item.label}</Text>
          </View>
        )
      })}
    </View>
  )
}
