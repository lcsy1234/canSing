export type SourceType = 'upload' | 'record'

export interface WhisperSegment {
  start: string
  end: string
  speech: string
}

export interface LyricLine {
  id: string
  index: number
  startMs: number
  endMs: number
  raw: string
  kana: string
  romaji: string
  chinesePhonetic: string
}

export interface HistoryRecord {
  id: string
  title: string
  artist: string
  sourceType: SourceType
  fileName: string
  audioUrl: string
  createdAt: string
  durationMs: number
  durationLabel: string
  excerpt: string
  lyricLines: LyricLine[]
}

export interface EnrichedLyricLine {
  raw: string
  kana: string
  romaji: string
  chinesePhonetic: string
}
