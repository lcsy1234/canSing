import Taro from '@tarojs/taro'

import type { PendingAudio } from '../types/record'

const storageKey = 'cansing-pending-audio'

let pendingAudio: PendingAudio | null = null

export function setPendingAudio(value: PendingAudio): void {
  pendingAudio = value
  Taro.setStorageSync(storageKey, value)
}

export function getPendingAudio(): PendingAudio | null {
  if (pendingAudio) {
    return pendingAudio
  }

  const stored = Taro.getStorageSync(storageKey)
  pendingAudio = stored || null

  return pendingAudio
}

export function clearPendingAudio(): void {
  pendingAudio = null
  Taro.removeStorageSync(storageKey)
}
