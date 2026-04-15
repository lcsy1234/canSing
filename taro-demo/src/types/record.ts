export type SourceType = 'upload' | 'record'

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

export interface AudioRecord {
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

export interface PendingAudio {
  filePath: string
  fileName: string
  sourceType: SourceType
  title?: string
}

export interface UpdateLyricLinePayload {
  id?: string
  startMs: number
  endMs: number
  raw: string
  kana: string
  romaji: string
  chinesePhonetic: string
}

export interface UpdateRecordPayload {
  title: string
  artist: string
  lyricLines: UpdateLyricLinePayload[]
}
