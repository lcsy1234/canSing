import { promises as fs } from 'fs'
import path from 'path'

import type { HistoryRecord } from '../types'
import { formatDuration } from '../utils/time'

const serverRoot = path.resolve(__dirname, '../..')
const dataDir = path.join(serverRoot, 'data')
const historyFilePath = path.join(dataDir, 'history.json')

export async function ensureHistoryStore(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true })

  try {
    await fs.access(historyFilePath)
  } catch {
    await fs.writeFile(historyFilePath, '[]\n', 'utf8')
  }
}

async function readHistory(): Promise<HistoryRecord[]> {
  await ensureHistoryStore()
  const raw = await fs.readFile(historyFilePath, 'utf8')
  const parsed = JSON.parse(raw)

  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed as HistoryRecord[]
}

async function writeHistory(records: HistoryRecord[]): Promise<void> {
  await fs.writeFile(historyFilePath, `${JSON.stringify(records, null, 2)}\n`, 'utf8')
}

export async function listHistory(): Promise<HistoryRecord[]> {
  const records = await readHistory()

  return records.sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  )
}

export async function getHistoryRecord(recordId: string): Promise<HistoryRecord | null> {
  const records = await readHistory()

  return records.find((record) => record.id === recordId) ?? null
}

export async function appendHistoryRecord(record: HistoryRecord): Promise<HistoryRecord> {
  const records = await readHistory()
  records.unshift(record)
  await writeHistory(records)

  return record
}

interface UpdateHistoryRecordPayload {
  title?: string
  artist?: string
  lyricLines?: HistoryRecord['lyricLines']
}

export async function updateHistoryRecord(
  recordId: string,
  payload: UpdateHistoryRecordPayload
): Promise<HistoryRecord | null> {
  const records = await readHistory()
  const targetIndex = records.findIndex((record) => record.id === recordId)

  if (targetIndex < 0) {
    return null
  }

  const current = records[targetIndex]
  const nextLyricLines = payload.lyricLines ?? current.lyricLines
  const durationMs = nextLyricLines[nextLyricLines.length - 1]?.endMs ?? 0
  const nextRecord: HistoryRecord = {
    ...current,
    title: payload.title ?? current.title,
    artist: payload.artist ?? current.artist,
    lyricLines: nextLyricLines,
    excerpt: nextLyricLines[0]?.raw ?? '',
    durationMs,
    durationLabel: formatDuration(durationMs)
  }

  records[targetIndex] = nextRecord
  await writeHistory(records)

  return nextRecord
}
