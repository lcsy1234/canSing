import Taro from '@tarojs/taro'

import { API_BASE } from '../constants/api'
import type { AudioRecord, PendingAudio } from '../types/record'

interface UploadHandle {
  abort: () => void
  promise: Promise<AudioRecord>
}

async function request<T>(url: string): Promise<T> {
  const response = await Taro.request<T>({
    url: `${API_BASE}${url}`,
    method: 'GET'
  })

  if (response.statusCode >= 400) {
    throw new Error((response.data as { message?: string })?.message ?? '请求失败。')
  }

  return response.data
}

function parseUploadResponse(payload: string): { message?: string; record?: AudioRecord } {
  try {
    return JSON.parse(payload) as { message?: string; record?: AudioRecord }
  } catch {
    return {
      message: '服务返回了无法解析的结果。'
    }
  }
}

export async function fetchHistory(): Promise<AudioRecord[]> {
  const response = await request<{ records: AudioRecord[] }>('/history')
  return response.records ?? []
}

export async function fetchRecord(recordId: string): Promise<AudioRecord> {
  const response = await request<{ record: AudioRecord }>(`/history/${recordId}`)
  return response.record
}

export function uploadAudioForTranscription(
  pendingAudio: PendingAudio,
  onProgress?: (progress: number) => void
): UploadHandle {
  let uploadTask: Taro.UploadTask | null = null

  const promise = new Promise<AudioRecord>((resolve, reject) => {
    uploadTask = Taro.uploadFile({
      url: `${API_BASE}/transcriptions`,
      filePath: pendingAudio.filePath,
      name: 'audio',
      formData: {
        sourceType: pendingAudio.sourceType,
        title: pendingAudio.title ?? pendingAudio.fileName.replace(/\.[^/.]+$/, '')
      },
      success: (response) => {
        const payload = parseUploadResponse(response.data)

        if (response.statusCode >= 400 || !payload.record) {
          reject(new Error(payload.message ?? '音频识别失败。'))
          return
        }

        resolve(payload.record)
      },
      fail: (error) => {
        reject(new Error(error.errMsg || '音频上传失败。'))
      }
    })

    if (typeof uploadTask.onProgressUpdate === 'function') {
      uploadTask.onProgressUpdate((detail) => {
        onProgress?.(detail.progress)
      })
    }
  })

  return {
    abort: () => {
      uploadTask?.abort()
    },
    promise
  }
}
