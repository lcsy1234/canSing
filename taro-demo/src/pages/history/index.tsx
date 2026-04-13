import { Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { startTransition, useEffect, useRef, useState } from 'react'

import BottomNav from '../../components/BottomNav'
import { fetchHistory } from '../../services/api'
import type { AudioRecord } from '../../types/record'
import { formatRelativeTime, formatShortDate, getToneClass } from '../../utils/presentation'

import './index.scss'

export default function HistoryPage() {
  const [records, setRecords] = useState<AudioRecord[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const skipNextDidShowRef = useRef(true)

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

  const loadHistory = async (options?: { skipPendingState?: boolean }) => {
    try {
      if (!options?.skipPendingState) {
        setLoading(true)
        setErrorMessage('')
      }

      const nextRecords = await fetchHistory()

      startTransition(() => {
        setErrorMessage('')
        setRecords(nextRecords)
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '历史记录加载失败。')
    } finally {
      setLoading(false)
    }
  }

  const loweredKeyword = keyword.trim().toLowerCase()
  const filteredRecords = loweredKeyword
    ? records.filter((record) => {
        const haystack = [
          record.title,
          record.artist,
          record.excerpt,
          record.lyricLines[0]?.raw ?? '',
          record.lyricLines[0]?.romaji ?? '',
          record.lyricLines[0]?.chinesePhonetic ?? ''
        ]
          .join(' ')
          .toLowerCase()

        return haystack.includes(loweredKeyword)
      })
    : records

  const openRecord = async (recordId: string) => {
    await Taro.navigateTo({
      url: `/pages/detail/index?id=${recordId}`
    })
  }

  return (
    <View className='history-page'>
      <View className='history-header'>
        <Text className='history-header__title'>历史记录</Text>
        <Text className='history-header__copy'>查看你之前处理过的日语歌词和录音。</Text>
      </View>

      <View className='history-search'>
        <Input
          className='history-search__input'
          placeholder='搜索历史...'
          value={keyword}
          onInput={(event) => setKeyword(event.detail.value)}
        />
        <View className='history-search__filter'>⌕</View>
      </View>

      <View className='history-list'>
        {loading ? (
          <View className='history-empty'>正在加载记录...</View>
        ) : filteredRecords.length > 0 ? (
          filteredRecords.map((record) => (
            <View
              key={record.id}
              className='history-card'
              onClick={() => {
                void openRecord(record.id)
              }}
            >
              <View className={`history-card__cover ${getToneClass(record.id)}`}>
                <Text className='history-card__cover-label'>{record.title.slice(0, 1).toUpperCase()}</Text>
              </View>

              <View className='history-card__body'>
                <Text className='history-card__title'>{record.title}</Text>
                <Text className='history-card__artist'>{record.artist}</Text>

                <View className='history-card__tags'>
                  <Text className='history-card__tag'>原文</Text>
                  <Text className='history-card__tag'>假名</Text>
                  <Text className='history-card__tag'>Romaji</Text>
                  <Text className='history-card__tag'>
                    {record.sourceType === 'record' ? '已录音' : '已上传'}
                  </Text>
                </View>

                <Text className='history-card__excerpt'>{record.lyricLines[0]?.raw ?? record.excerpt}</Text>
              </View>

              <View className='history-card__meta'>
                <Text className='history-card__date'>{formatShortDate(record.createdAt)}</Text>
                <Text className='history-card__time'>{formatRelativeTime(record.createdAt)}</Text>
                <Text className='history-card__arrow'>›</Text>
              </View>
            </View>
          ))
        ) : (
          <View className='history-empty'>
            <Text className='history-empty__title'>没有匹配结果</Text>
            <Text className='history-empty__copy'>可以试试搜索歌曲名、罗马音，或者从首页再上传一段新音频。</Text>
          </View>
        )}
      </View>

      {errorMessage ? <View className='history-error'>{errorMessage}</View> : null}

      <BottomNav active='history' />
    </View>
  )
}
