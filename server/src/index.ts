import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import multer from 'multer'
import path from 'path'

import { ensureHistoryStore, getHistoryRecord, listHistory, updateHistoryRecord } from './services/historyService'
import { ensureUploadsReady, getUploadsDir } from './services/audioService'
import { processTranscription } from './services/transcriptionService'
import type { LyricLine, SourceType } from './types'

dotenv.config({
  path: path.resolve(__dirname, '../.env')
})

const port = Number(process.env.PORT ?? 3001)
const app = express()

const allowedExtensions = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'])

function sanitizeSourceType(value: unknown): SourceType {
  return value === 'record' ? 'record' : 'upload'
}

function sanitizeFileName(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase()
  const baseName = path
    .basename(fileName, extension)
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)

  return `${Date.now()}-${baseName || 'audio'}${extension || '.wav'}`
}

interface UpdateLyricLineInput {
  id?: unknown
  raw?: unknown
  kana?: unknown
  romaji?: unknown
  chinesePhonetic?: unknown
  startMs?: unknown
  endMs?: unknown
}

function sanitizeTextField(value: unknown, field: string, maxLength: number): string {
  const nextValue = typeof value === 'string' ? value.trim() : ''
  if (!nextValue) {
    throw new Error(`${field} 不能为空。`)
  }

  return nextValue.slice(0, maxLength)
}

function sanitizeMs(value: unknown, field: string): number {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Error(`${field} 必须是大于等于 0 的数字。`)
  }

  return Math.floor(numberValue)
}

function sanitizeLyricLines(value: unknown, recordId: string): LyricLine[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('歌词行不能为空。')
  }

  const normalized = value.map((line, index) => {
    const input = (line ?? {}) as UpdateLyricLineInput
    const startMs = sanitizeMs(input.startMs, `第 ${index + 1} 行 startMs`)
    const endMs = sanitizeMs(input.endMs, `第 ${index + 1} 行 endMs`)

    if (endMs < startMs) {
      throw new Error(`第 ${index + 1} 行 endMs 不能小于 startMs。`)
    }

    const existingId = typeof input.id === 'string' && input.id.trim() ? input.id.trim() : ''

    return {
      id: existingId || `${recordId}-edit-${Date.now()}-${index + 1}`,
      index: index + 1,
      startMs,
      endMs,
      raw: sanitizeTextField(input.raw, `第 ${index + 1} 行原文`, 200),
      kana: typeof input.kana === 'string' ? input.kana.trim().slice(0, 200) : '',
      romaji: typeof input.romaji === 'string' ? input.romaji.trim().slice(0, 200) : '',
      chinesePhonetic:
        typeof input.chinesePhonetic === 'string' ? input.chinesePhonetic.trim().slice(0, 200) : ''
    } satisfies LyricLine
  })

  return normalized
    .sort((left, right) => left.startMs - right.startMs)
    .map((line, index) => ({
      ...line,
      index: index + 1
    }))
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, getUploadsDir())
    },
    filename: (_req, file, callback) => {
      callback(null, sanitizeFileName(file.originalname))
    }
  }),
  limits: {
    fileSize: 30 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase()

    if (!allowedExtensions.has(extension)) {
      callback(new Error('仅支持 mp3、wav、m4a、aac、ogg、flac 格式音频。'))
      return
    }

    callback(null, true)
  }
})

app.use(
  cors({
    origin: true,
    credentials: true
  })
)
app.use(express.json({ limit: '2mb' }))
app.use('/uploads', express.static(getUploadsDir()))

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'cansing-server'
  })
})

app.get('/api/history', async (_req, res, next) => {
  try {
    const records = await listHistory()
    res.json({ records })
  } catch (error) {
    next(error)
  }
})

app.get('/api/history/:id', async (req, res, next) => {
  try {
    const record = await getHistoryRecord(req.params.id)

    if (!record) {
      res.status(404).json({ message: '未找到对应记录。' })
      return
    }

    res.json({ record })
  } catch (error) {
    next(error)
  }
})

app.put('/api/history/:id', async (req, res, next) => {
  try {
    const title = sanitizeTextField(req.body?.title, '歌曲标题', 80)
    const artist = sanitizeTextField(req.body?.artist, '歌手', 80)
    const lyricLines = sanitizeLyricLines(req.body?.lyricLines, req.params.id)

    const record = await updateHistoryRecord(req.params.id, {
      title,
      artist,
      lyricLines
    })

    if (!record) {
      res.status(404).json({ message: '未找到对应记录。' })
      return
    }

    res.json({ record })
  } catch (error) {
    next(error)
  }
})

app.post('/api/transcriptions', upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: '请先上传音频文件。' })
      return
    }

    const record = await processTranscription({
      file: req.file,
      sourceType: sanitizeSourceType(req.body.sourceType),
      title: req.body.title,
      artist: req.body.artist
    })

    res.status(201).json({ record })
  } catch (error) {
    next(error)
  }
})

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : '服务器内部错误。'
  res.status(500).json({ message })
})

async function bootstrap(): Promise<void> {
  await Promise.all([ensureUploadsReady(), ensureHistoryStore()])

  app.listen(port, () => {
    console.log(`cansing-server listening on http://127.0.0.1:${port}`)
  })
}

void bootstrap().catch((error) => {
  console.error(error)
  process.exit(1)
})
