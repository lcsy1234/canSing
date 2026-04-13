import Taro from '@tarojs/taro'

import { API_BASE } from '../constants/api'
import type { AudioRecord, PendingAudio } from '../types/record'

interface UploadHandle {
  abort: () => void
  promise: Promise<AudioRecord>
}

function normalizeClientError(error: unknown): Error {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : (error as { errMsg?: string } | undefined)?.errMsg ?? '请求失败。'

  if (/url not in domain list/i.test(message)) {
    return new Error(
      '当前小程序未通过域名校验。开发者工具里可关闭“校验合法域名”；真机或预览环境请改用已配置到微信后台的 HTTPS 域名。'
    )
  }

  if (
    /ECONNREFUSED 127\.0\.0\.1:3001/i.test(message) ||
    /fail connect to 127\.0\.0\.1:3001/i.test(message) ||
    /ERR_CONNECTION_REFUSED/i.test(message) ||
    /cronet_error_code:-102/i.test(message)
  ) {
    return new Error(
      '无法连接识别后端。请先确认 server 已启动；如果是真机调试，请把 TARO_APP_API_BASE_URL 改成电脑局域网 IP，例如 http://192.168.0.111:3001，并确保手机和电脑在同一 Wi-Fi 下。'
    )
  }

  if (/timeout/i.test(message)) {
    return new Error('连接后端超时。请确认 server 已启动，并且当前小程序环境可以访问这个地址。')
  }

  return new Error(message)
}

async function request<T>(url: string): Promise<T> {
  let response: Taro.request.SuccessCallbackResult<any>

  try {
    response = await Taro.request<T>({
      url: `${API_BASE}${url}`,
      method: 'GET'
    })
  } catch (error) {
    throw normalizeClientError(error)
  }

  if (response.statusCode >= 400) {
    throw new Error((response.data as { message?: string })?.message ?? '请求失败。')
  }

  return response.data as T
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
        reject(normalizeClientError(error))
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
