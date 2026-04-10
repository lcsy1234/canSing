export function getToneClass(seed: string): string {
  const total = seed.split('').reduce((sum, current) => sum + current.charCodeAt(0), 0)
  const tones = ['tone-rose', 'tone-indigo', 'tone-coral', 'tone-sky']

  return tones[total % tones.length]
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) {
    return '刚刚'
  }

  if (minutes < 60) {
    return `${minutes} 分钟前`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours} 小时前`
  }

  const days = Math.floor(hours / 24)

  if (days < 7) {
    return `${days} 天前`
  }

  return formatShortDate(iso)
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${month}/${day}`
}

export function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}
