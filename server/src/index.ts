import cors from 'cors'
import express from 'express'
import multer from 'multer'
import path from 'path'

import { ensureHistoryStore, getHistoryRecord, listHistory } from './services/historyService'
import { ensureUploadsReady, getUploadsDir } from './services/audioService'
import { processTranscription } from './services/transcriptionService'
import type { SourceType } from './types'

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
