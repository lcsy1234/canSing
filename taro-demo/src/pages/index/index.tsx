import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { startTransition, useEffect, useRef, useState } from 'react'

import BottomNav from '../../components/BottomNav'
import { fetchHistory } from '../../services/api'
import { setPendingAudio } from '../../store/pendingAudio'
import type { AudioRecord } from '../../types/record'
import { formatRelativeTime, getToneClass } from '../../utils/presentation'

import './index.scss'

const supportedExtensions = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac']

export default function IndexPage() {
  const [records, setRecords] = useState<AudioRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const recorderRef = useRef<any>(null)
  const recordingStartedAtRef = useRef(0)
  const skipNextDidShowRef = useRef(true)

  const totalLines = records.reduce((sum, record) => sum + record.lyricLines.length, 0)
  const recentRecords = records.slice(0, 3)

  useDidShow(() => {
    if (skipNextDidShowRef.current) {
      skipNextDidShowRef.current = false
      return
    }

    void loadHistory()
  })

  useEffect(() => {
    void loadHistory({ skipPendingState: true })
  }, [])

  useEffect(() => {
    if (process.env.TARO_ENV !== 'weapp' || typeof Taro.getRecorderManager !== 'function') {
      return
    }

    const recorder = Taro.getRecorderManager() as any
    recorderRef.current = recorder
    recorder.offStop?.()
    recorder.offError?.()

    recorder.onStop((result: any) => {
      setIsRecording(false)
      setRecordingSeconds(0)

      if (!result?.tempFilePath) {
        void Taro.showToast({
          title: '录音文件生成失败，请重试',
          icon: 'none'
        })
        return
      }

      setPendingAudio({
        filePath: result.tempFilePath,
        fileName: `record-${Date.now()}.mp3`,
        sourceType: 'record',
        title: `即时录音 ${new Date().toLocaleTimeString()}`
      })

      void Taro.navigateTo({
        url: '/pages/processing/index'
      })
    })

    recorder.onError(() => {
      setIsRecording(false)
      setRecordingSeconds(0)
      void Taro.showToast({
        title: '录音失败，请检查麦克风权限',
        icon: 'none'
      })
    })
  }, [])

  useEffect(() => {
    if (!isRecording) {
      return
    }

    const timer = setInterval(() => {
      setRecordingSeconds(Math.max(0, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)))
    }, 1000)

    return () => {
      clearInterval(timer)
    }
  }, [isRecording])

  const loadHistory = async (options?: { skipPendingState?: boolean }) => {
    try {
      if (!options?.skipPendingState) {
        setLoading(true)
        setErrorMessage('')
      }

      const history = await fetchHistory()
      startTransition(() => {
        setErrorMessage('')
        setRecords(history)
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '历史记录读取失败。')
    } finally {
      setLoading(false)
    }
  }

  const handleChooseAudio = async () => {
    try {
      if (typeof Taro.chooseMessageFile !== 'function') {
        throw new Error('当前环境暂不支持选择音频文件。')
      }

      const response = await Taro.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: supportedExtensions
      })
      const selected = response.tempFiles?.[0] as any

      if (!selected?.path) {
        return
      }

      setPendingAudio({
        filePath: selected.path,
        fileName: selected.name ?? `audio-${Date.now()}.mp3`,
        sourceType: 'upload',
        title: (selected.name ?? '上传音频').replace(/\.[^/.]+$/, '')
      })

      await Taro.navigateTo({
        url: '/pages/processing/index'
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''

      if (message.includes('cancel')) {
        return
      }

      await Taro.showToast({
        title: message || '选择音频失败',
        icon: 'none'
      })
    }
  }

  const handleRecordPress = async () => {
    if (process.env.TARO_ENV !== 'weapp') {
      await Taro.showToast({
        title: '录音功能请在微信小程序中使用',
        icon: 'none'
      })
      return
    }

    if (isRecording) {
      recorderRef.current?.stop?.()
      return
    }

    try {
      await Taro.authorize({
        scope: 'scope.record'
      })

      recordingStartedAtRef.current = Date.now()
      setRecordingSeconds(0)
      setIsRecording(true)

      recorderRef.current?.start?.({
        duration: 120000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 96000,
        format: 'mp3'
      })
    } catch (error) {
      setIsRecording(false)
      await Taro.showToast({
        title: error instanceof Error ? error.message : '未能开启录音',
        icon: 'none'
      })
    }
  }

  const openRecord = async (recordId: string) => {
    await Taro.navigateTo({
      url: `/pages/detail/index?id=${recordId}`
    })
  }

  return (
    <View className='home-page'>
      <View className='home-hero'>
        <Text className='home-hero__eyebrow'>Harmonic Precision</Text>
        <Text className='home-hero__title'>掌握你最爱的 J-Pop</Text>
        <Text className='home-hero__subtitle'>
          上传日语歌曲片段或当场录制，自动生成原文、平假名、罗马音和中文谐音。
        </Text>

        <View className='home-hero__badge'>
          <Text className='home-hero__badge-number'>{records.length}</Text>
          <Text className='home-hero__badge-label'>首已处理片段</Text>
        </View>
      </View>

      <View className='action-grid'>
        <View className='action-card action-card--upload' onClick={() => void handleChooseAudio()}>
          <Text className='action-card__icon'>⇪</Text>
          <Text className='action-card__title'>上传音频</Text>
          <Text className='action-card__subtitle'>MP3, WAV, M4A</Text>
        </View>

        <View
          className={`action-card action-card--record ${isRecording ? 'action-card--recording' : ''}`}
          onClick={() => void handleRecordPress()}
        >
          <Text className='action-card__icon'>{isRecording ? '■' : '●'}</Text>
          <Text className='action-card__title'>{isRecording ? '停止录制' : '立即录制'}</Text>
          <Text className='action-card__subtitle'>
            {isRecording ? `${recordingSeconds}s 正在捕捉人声` : '录一段想练的副歌'}
          </Text>
        </View>
      </View>

      <View className='panel-header'>
        <Text className='panel-header__title'>最近记录</Text>
        <Text className='panel-header__link' onClick={() => void Taro.redirectTo({ url: '/pages/history/index' })}>
          查看全部
        </Text>
      </View>

      <View className='record-list'>
        {loading ? (
          <View className='record-list__placeholder'>正在载入识别历史...</View>
        ) : recentRecords.length > 0 ? (
          recentRecords.map((record) => (
            <View
              key={record.id}
              className='record-card'
              onClick={() => {
                void openRecord(record.id)
              }}
            >
              <View className={`record-card__cover ${getToneClass(record.id)}`}>
                <Text className='record-card__cover-label'>{record.title.slice(0, 1).toUpperCase()}</Text>
              </View>

              <View className='record-card__body'>
                <Text className='record-card__title'>{record.title}</Text>
                <Text className='record-card__artist'>{record.artist}</Text>
                <Text className='record-card__romaji'>{record.lyricLines[0]?.romaji ?? '等待首句识别...'}</Text>
              </View>

              <View className='record-card__meta'>
                <Text className='record-card__badge'>
                  {Math.min(99, 68 + record.lyricLines.length * 5)}%
                </Text>
                <Text className='record-card__time'>{formatRelativeTime(record.createdAt)}</Text>
              </View>
            </View>
          ))
        ) : (
          <View className='record-list__empty'>
            <Text className='record-list__empty-title'>还没有练习记录</Text>
            <Text className='record-list__empty-copy'>上传一段日语音频后，这里会出现可跟唱的历史记录。</Text>
          </View>
        )}
      </View>

      <View className='summary-card'>
        <View className='summary-card__header'>
          <Text className='summary-card__title'>每周进度</Text>
          <Text className='summary-card__icon'>↗</Text>
        </View>
        <Text className='summary-card__copy'>
          本周已经累计整理 {totalLines} 行歌词
          {records[0] ? `，最近一段来自 ${formatRelativeTime(records[0].createdAt)}。` : '，等你的第一段上传。'}
        </Text>

        <View className='summary-card__progress'>
          <View
            className='summary-card__progress-bar'
            style={{
              width: `${Math.min(100, 18 + totalLines * 8)}%`
            }}
          />
        </View>

        <View className='summary-card__footer'>
          <Text>学唱 4 小节</Text>
          <Text>待练 {Math.max(0, 14 - records.length)}</Text>
        </View>
      </View>

      {errorMessage ? <View className='error-banner'>{errorMessage}</View> : null}

      <BottomNav active='home' />
    </View>
  )
}
