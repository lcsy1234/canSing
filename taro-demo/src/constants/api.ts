export const API_ORIGIN = process.env.TARO_APP_API_BASE_URL ?? 'http://127.0.0.1:3001'
export const API_BASE = `${API_ORIGIN}/api`

export function resolveMediaUrl(url: string): string {
  if (!url) {
    return ''
  }

  if (/^https?:\/\//.test(url)) {
    return url
  }

  return `${API_ORIGIN}${url}`
}
