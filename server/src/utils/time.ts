export function parseTimestampToMs(value: string): number {
  const match = /^(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(value.trim())

  if (!match) {
    return 0
  }

  const [, hours, minutes, seconds] = match

  return (
    Number(hours) * 60 * 60 * 1000 +
    Number(minutes) * 60 * 1000 +
    Math.round(Number(seconds) * 1000)
  )
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return [hours, minutes, seconds]
      .map((part) => part.toString().padStart(2, '0'))
      .join(':')
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export function shortenText(text: string, limit = 32): string {
  const trimmed = text.trim()

  if (trimmed.length <= limit) {
    return trimmed
  }

  return `${trimmed.slice(0, limit).trim()}...`
}
