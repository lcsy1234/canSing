import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'

import BottomNav from '../../components/BottomNav'
import { uploadAudioForTranscription } from '../../services/api'
import { clearPendingAudio, getPendingAudio } from '../../store/pendingAudio'
import type { PendingAudio } from '../../types/record'

import './index.scss'

const steps = [
  {
    title: '音频上传',
    description: '正在把录音和歌曲片段发送到本地识别服务。'
  },
  {
    title: 'Whisper 转写',
    description: '正在识别日语歌词文本，并按时间切分段落。'
  },
  {
    title: '平假名 / Romaji',
    description: '正在补全假名和罗马音，方便逐句跟唱。'
  },
  {
    title: '中文谐音',
    description: '正在生成中文谐音提示，即将跳转到练唱页。'
  }
]

export default function ProcessingPage() {
  const [pendingAudio, setPendingAudioState] = useState<PendingAudio | null>(null)
  const [activeStep, setActiveStep] = useState(0)
  const [progress, setProgress] = useState(8)
  const [errorMessage, setErrorMessage] = useState('')
  const uploadRef = useRef<ReturnType<typeof uploadAudioForTranscription> | null>(null)
  const completedRef = useRef(false)

  useEffect(() => {
    const pending = getPendingAudio()
    setPendingAudioState(pending)

    if (!pending) {
      setErrorMessage('未找到待处理音频，请返回首页重新选择上传文件或录音。')
      return
    }

    void startProcessing(pending)

    return () => {
      if (!completedRef.current) {
        uploadRef.current?.abort()
      }
    }
  }, [])

  useEffect(() => {
    if (errorMessage || completedRef.current) {
      return
    }

    const timer = setInterval(() => {
      setActiveStep((current) => Math.min(current + 1, steps.length - 2))
      setProgress((current) => Math.min(92, current + 5))
    }, 1400)

    return () => {
      clearInterval(timer)
    }
  }, [errorMessage])

  const startProcessing = async (pending: PendingAudio) => {
    try {
      setErrorMessage('')
      setProgress(12)
      setActiveStep(0)

      const uploadHandle = uploadAudioForTranscription(pending, (nextProgress) => {
        setProgress((current) => Math.max(current, Math.min(96, nextProgress)))

        if (nextProgress > 25) {
          setActiveStep((current) => Math.max(current, 1))
        }

        if (nextProgress > 60) {
          setActiveStep((current) => Math.max(current, 2))
        }
      })

      uploadRef.current = uploadHandle

      const record = await uploadHandle.promise

      completedRef.current = true
      clearPendingAudio()
      setActiveStep(steps.length - 1)
      setProgress(100)

      setTimeout(() => {
        void Taro.redirectTo({
          url: `/pages/detail/index?id=${record.id}`
        })
      }, 700)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '识别失败，请稍后再试。')
    }
  }

  return (
    <View className='processing-page'>
      <View className='processing-stage'>
        <View className='processing-wave'>
          {Array.from({ length: 7 }).map((_, index) => (
            <View key={index} className={`processing-wave__bar processing-wave__bar--${index + 1}`} />
          ))}
        </View>

        <Text className='processing-stage__title'>
          {errorMessage ? '处理被中断了' : '正在解析旋律与歌词...'}
        </Text>
        <Text className='processing-stage__subtitle'>
          {pendingAudio?.fileName ? `文件：${pendingAudio.fileName}` : '正在生成可跟唱文本流...'}
        </Text>

        <View className='processing-progress'>
          <View className='processing-progress__bar' style={{ width: `${progress}%` }} />
        </View>
        <Text className='processing-progress__text'>{progress}%</Text>
      </View>

      <View className='processing-steps'>
        {steps.map((step, index) => {
          const isActive = index === activeStep
          const isDone = index < activeStep || (completedRef.current && index === activeStep)

          return (
            <View
              key={step.title}
              className={`processing-step ${isActive ? 'processing-step--active' : ''} ${
                isDone ? 'processing-step--done' : ''
              }`}
            >
              <View className='processing-step__icon'>{isDone ? '✓' : index + 1}</View>
              <View className='processing-step__content'>
                <Text className='processing-step__title'>{step.title}</Text>
                <Text className='processing-step__copy'>{step.description}</Text>
              </View>
            </View>
          )
        })}
      </View>

      {errorMessage ? (
        <View className='processing-error'>
          <Text className='processing-error__title'>识别失败</Text>
          <Text className='processing-error__copy'>{errorMessage}</Text>

          <View className='processing-error__actions'>
            <View
              className='processing-button processing-button--primary'
              onClick={() => {
                if (pendingAudio) {
                  completedRef.current = false
                  void startProcessing(pendingAudio)
                }
              }}
            >
              <Text>重新尝试</Text>
            </View>
            <View
              className='processing-button'
              onClick={() => {
                void Taro.redirectTo({ url: '/pages/index/index' })
              }}
            >
              <Text>返回首页</Text>
            </View>
          </View>
        </View>
      ) : null}

      <BottomNav active='processing' />
    </View>
  )
}
