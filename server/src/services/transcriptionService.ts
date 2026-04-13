import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import path from 'path'

import whisper from 'whisper-node'

import { appendHistoryRecord } from './historyService'
import { enrichJapaneseText } from './japaneseService'
import { convertAudioToWav, removeFile } from './audioService'
import type { HistoryRecord, LyricLine, SourceType, WhisperSegment } from '../types'
import { formatDuration, parseTimestampToMs, shortenText } from '../utils/time'

const serverRoot = path.resolve(__dirname, '../..')

interface ProcessTranscriptionInput {
  file: Express.Multer.File
  sourceType: SourceType
  title?: string
  artist?: string
}

function deriveTitle(fileName: string, excerpt: string): string {
  const fromName = path
    .basename(fileName, path.extname(fileName))
    .replace(/[_-]+/g, ' ')
    .trim()

  if (fromName) {
    return fromName
  }

  if (excerpt) {
    return shortenText(excerpt, 18)
  }

  return '未命名音频'
}

function buildWhisperOptions(): Record<string, unknown> {
  const modelName = process.env.WHISPER_MODEL_NAME?.trim() || 'base'
  const modelPath = findAvailableWhisperModelPath()

  return {
    ...(modelPath
      ? { modelPath }
      : {
          modelName
        }),
    whisperOptions: {
      language: 'ja',
      gen_file_txt: false,
      gen_file_subtitle: false,
      gen_file_vtt: false,
      word_timestamps: false
    }
  }
}

function resolveWhisperModelName(): string {
  return process.env.WHISPER_MODEL_NAME?.trim() || 'base'
}

function getWhisperModelCandidates(): string[] {
  const customModelPath = process.env.WHISPER_MODEL_PATH?.trim()
  const modelName = resolveWhisperModelName()

  if (customModelPath) {
    return [customModelPath]
  }

  const whisperPackageRoot = path.dirname(require.resolve('whisper-node/package.json'))
  const projectModelPath = path.join(serverRoot, 'models', `ggml-${modelName}.bin`)
  const packageModelPath = path.join(
    whisperPackageRoot,
    'lib',
    'whisper.cpp',
    'models',
    `ggml-${modelName}.bin`
  )

  return [projectModelPath, packageModelPath]
}

function findAvailableWhisperModelPath(): string | null {
  return getWhisperModelCandidates().find((candidate) => existsSync(candidate)) ?? null
}

async function ensureWhisperModelReady(): Promise<void> {
  const resolvedModelPath = findAvailableWhisperModelPath()

  if (!resolvedModelPath) {
    const [projectModelPath, packageModelPath] = getWhisperModelCandidates()

    throw new Error(
      [
        'Whisper 模型文件不存在。',
        `建议把模型放到：${projectModelPath}`,
        '也可以在 server/.env 中设置 `WHISPER_MODEL_PATH=/你的/ggml-base.bin`。',
        `当前还检查过默认依赖目录：${packageModelPath}`,
        '如果你的网络能访问外网，也可以在 server 目录执行 `npm run download:model`。'
      ].join(' ')
    )
  }
}

function normalizeWhisperError(error: unknown): Error {
  const message = error instanceof Error ? error.message : 'Unknown error'

  if (/Whisper 模型文件不存在/.test(message)) {
    return new Error(message)
  }

  if (/model/i.test(message) || /download/i.test(message) || /ENOENT/i.test(message)) {
    return new Error(
      'Whisper 模型未准备好，请先在 server 目录执行 `npm run download:model` 下载模型，再重新启动服务。'
    )
  }

  return new Error(message)
}

export async function processTranscription({
  file,
  sourceType,
  title,
  artist
}: ProcessTranscriptionInput): Promise<HistoryRecord> {
  const recordId = randomUUID()
  const wavPath = await convertAudioToWav(file.path, recordId)

  try {
    await ensureWhisperModelReady()

    const transcript = await whisper(wavPath, buildWhisperOptions())

    if (!Array.isArray(transcript)) {
      throw new Error(
        'Whisper 没有返回可解析结果。请检查 server 终端中的 [whisper-node] Problem 日志，并确认模型已经下载完成。'
      )
    }

    const usableSegments = transcript.filter((segment) => segment.speech?.trim())

    if (usableSegments.length === 0) {
      throw new Error('Whisper 没有识别出可用歌词，请尝试更清晰的人声片段。')
    }

    const lyricLines: LyricLine[] = await Promise.all(
      usableSegments.map(async (segment, index) => {
        const enriched = await enrichJapaneseText(segment.speech)

        return {
          id: `${recordId}-${index + 1}`,
          index: index + 1,
          startMs: parseTimestampToMs(segment.start),
          endMs: parseTimestampToMs(segment.end),
          ...enriched
        }
      })
    )

    const durationMs = lyricLines[lyricLines.length - 1]?.endMs ?? 0
    const excerpt = lyricLines[0]?.raw ?? ''
    const record: HistoryRecord = {
      id: recordId,
      title: title?.trim() || deriveTitle(file.originalname, excerpt),
      artist: artist?.trim() || (sourceType === 'record' ? '即时录音' : '上传音频'),
      sourceType,
      fileName: file.originalname,
      audioUrl: `/uploads/${path.basename(file.path)}`,
      createdAt: new Date().toISOString(),
      durationMs,
      durationLabel: formatDuration(durationMs),
      excerpt,
      lyricLines
    }

    await appendHistoryRecord(record)

    return record
  } catch (error) {
    throw normalizeWhisperError(error)
  } finally {
    await removeFile(wavPath)
  }
}
