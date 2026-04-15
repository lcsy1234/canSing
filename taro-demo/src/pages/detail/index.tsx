import { ScrollView, Slider, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'

import { resolveMediaUrl } from '../../constants/api'
import { fetchRecord, updateRecord } from '../../services/api'
import type { AudioRecord, LyricLine } from '../../types/record'
import { formatClock, getToneClass } from '../../utils/presentation'

import './index.scss'

type LyricDisplayMode =
  | 'minimal'
  | 'phonetic'
  | 'kana'
  | 'romaji'
  | 'full'
  | 'phoneticOnly'
  | 'romajiOnly'
  | 'kanaOnly'

const LYRIC_MODE_OPTIONS: { mode: LyricDisplayMode; label: string }[] = [
  { mode: 'phoneticOnly', label: '仅谐音' },
  { mode: 'romajiOnly', label: '仅罗马音' },
  { mode: 'kanaOnly', label: '仅假名' },
  { mode: 'minimal', label: '仅歌词' },
  { mode: 'phonetic', label: '谐音' },
  { mode: 'kana', label: '假名' },
  { mode: 'romaji', label: '罗马音' },
  { mode: 'full', label: '全部' }
]

const EDITABLE_MODE_LABEL: Partial<Record<LyricDisplayMode, string>> = {
  phoneticOnly: '仅谐音',
  minimal: '仅歌词',
  romajiOnly: '仅罗马音',
  kanaOnly: '仅假名'
}

function getActiveLineIndex(lines: LyricLine[], currentMs: number): number {
  if (lines.length === 0) {
    return 0
  }

  let activeIndex = 0

  for (let index = 0; index < lines.length; index += 1) {
    if (currentMs >= lines[index].startMs) {
      activeIndex = index
    }

    if (currentMs >= lines[index].startMs && currentMs <= lines[index].endMs + 260) {
      return index
    }
  }

  return activeIndex
}

function lyricScrollId(line: LyricLine): string {
  return `lyric-${line.id}`
}

export default function DetailPage() {
  const [recordId, setRecordId] = useState('')
  const [record, setRecord] = useState<AudioRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentSeconds, setCurrentSeconds] = useState(0)
  const [lyricDisplayMode, setLyricDisplayMode] = useState<LyricDisplayMode>('phoneticOnly')
  const [scrollIntoView, setScrollIntoView] = useState('')
  const [isSavingLyric, setIsSavingLyric] = useState(false)
  const audioRef = useRef<any>(null)
  const lastTapRef = useRef<{ lineId: string; at: number }>({ lineId: '', at: 0 })

  const loadRecord = async (nextRecordId: string) => {
    try {
      setLoading(true)
      setErrorMessage('')
      setRecord(await fetchRecord(nextRecordId))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '记录读取失败。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const current = Taro.getCurrentInstance().router?.params?.id ?? ''
    setRecordId(current)
  }, [])

  useEffect(() => {
    if (!recordId) {
      return
    }

    void loadRecord(recordId)
  }, [recordId])

  useEffect(() => {
    if (!record) {
      return
    }

    setCurrentSeconds(0)
    setIsPlaying(false)

    const audio = Taro.createInnerAudioContext()
    audio.src = resolveMediaUrl(record.audioUrl)
    audio.autoplay = false
    audio.obeyMuteSwitch = false
    audioRef.current = audio

    audio.onPlay(() => setIsPlaying(true))
    audio.onPause(() => setIsPlaying(false))
    audio.onStop(() => {
      setIsPlaying(false)
      setCurrentSeconds(0)
    })
    audio.onEnded(() => {
      setIsPlaying(false)
      setCurrentSeconds(record.durationMs / 1000)
    })
    audio.onTimeUpdate(() => {
      setCurrentSeconds(audio.currentTime)
    })
    audio.onError(() => {
      void Taro.showToast({
        title: '音频播放失败',
        icon: 'none'
      })
    })

    return () => {
      audio.destroy()
      audioRef.current = null
    }
  }, [record?.id])

  const activeIndex = record ? getActiveLineIndex(record.lyricLines, Math.round(currentSeconds * 1000)) : 0

  useEffect(() => {
    if (!record?.lyricLines.length) {
      return
    }

    const line = record.lyricLines[activeIndex]
    if (line) {
      setScrollIntoView(lyricScrollId(line))
    }
  }, [activeIndex, record?.id])

  const togglePlayback = () => {
    if (!audioRef.current) {
      return
    }

    if (isPlaying) {
      audioRef.current.pause()
      return
    }

    audioRef.current.play()
  }

  const seekToLine = (line: LyricLine) => {
    if (!audioRef.current) {
      return
    }

    const nextSeconds = line.startMs / 1000
    audioRef.current.seek(nextSeconds)
    setCurrentSeconds(nextSeconds)

    if (!isPlaying) {
      audioRef.current.play()
    }
  }

  const jumpLine = (offset: number) => {
    if (!record) {
      return
    }

    const targetLine = record.lyricLines[Math.max(0, Math.min(record.lyricLines.length - 1, activeIndex + offset))]

    if (targetLine) {
      seekToLine(targetLine)
    }
  }

  const handleSliderChange = (event) => {
    const nextSeconds = Number(event.detail.value ?? 0)
    audioRef.current?.seek(nextSeconds)
    setCurrentSeconds(nextSeconds)
  }

  const openLyricEditor = async () => {
    if (!record?.id) {
      return
    }

    await Taro.navigateTo({
      url: `/pages/lyrics-editor/index?id=${record.id}`
    })
  }

  const canEditCurrentMode = Boolean(EDITABLE_MODE_LABEL[lyricDisplayMode])

  const getEditableLineValue = (line: LyricLine): string => {
    if (lyricDisplayMode === 'phoneticOnly') {
      return line.chinesePhonetic
    }

    if (lyricDisplayMode === 'romajiOnly') {
      return line.romaji
    }

    if (lyricDisplayMode === 'kanaOnly') {
      return line.kana
    }

    return line.raw
  }

  const patchLineByMode = (line: LyricLine, value: string): LyricLine => {
    if (lyricDisplayMode === 'phoneticOnly') {
      return { ...line, chinesePhonetic: value }
    }

    if (lyricDisplayMode === 'romajiOnly') {
      return { ...line, romaji: value }
    }

    if (lyricDisplayMode === 'kanaOnly') {
      return { ...line, kana: value }
    }

    return { ...line, raw: value }
  }

  const persistLyricLines = async (nextLines: LyricLine[]) => {
    if (!record) {
      return
    }

    setIsSavingLyric(true)
    try {
      const nextRecord = await updateRecord(record.id, {
        title: record.title,
        artist: record.artist,
        lyricLines: nextLines.map((line) => ({
          id: line.id,
          startMs: line.startMs,
          endMs: line.endMs,
          raw: line.raw,
          kana: line.kana,
          romaji: line.romaji,
          chinesePhonetic: line.chinesePhonetic
        }))
      })
      setRecord(nextRecord)
      await Taro.showToast({ title: '已保存', icon: 'success' })
    } catch (error) {
      await Taro.showToast({
        title: error instanceof Error ? error.message : '保存失败',
        icon: 'none'
      })
    } finally {
      setIsSavingLyric(false)
    }
  }

  const editLineByMode = async (line: LyricLine) => {
    if (!record || !canEditCurrentMode || isSavingLyric) {
      return
    }

    const modalResult = (await Taro.showModal({
      title: `编辑${EDITABLE_MODE_LABEL[lyricDisplayMode] ?? '歌词'}`,
      editable: true,
      placeholderText: '请输入新的歌词内容',
      content: getEditableLineValue(line)
    } as any)) as { confirm?: boolean; content?: string }

    if (!modalResult.confirm) {
      return
    }

    const nextValue = (modalResult.content ?? '').trim()
    if (!nextValue) {
      await Taro.showToast({
        title: '内容不能为空',
        icon: 'none'
      })
      return
    }

    const nextLines = record.lyricLines.map((currentLine) =>
      currentLine.id === line.id ? patchLineByMode(currentLine, nextValue) : currentLine
    )
    await persistLyricLines(nextLines)
  }

  const handleLineClick = (line: LyricLine) => {
    seekToLine(line)

    if (!canEditCurrentMode || isSavingLyric) {
      return
    }

    // 小程序端没有稳定的 onDoubleClick，保留双击手势识别作为兜底。
    const now = Date.now()
    const isDoubleTap = lastTapRef.current.lineId === line.id && now - lastTapRef.current.at <= 320
    lastTapRef.current = { lineId: line.id, at: now }

    if (isDoubleTap) {
      // 双击后进入行内自定义编辑
      void editLineByMode(line)
    }
  }

  const buildExportContent = (): string => {
    if (!record) {
      return ''
    }

    const body = record.lyricLines
      .map((line, index) => {
        if (lyricDisplayMode === 'phoneticOnly') {
          return `${index + 1}. ${line.chinesePhonetic}`
        }

        if (lyricDisplayMode === 'romajiOnly') {
          return `${index + 1}. ${line.romaji}`
        }

        if (lyricDisplayMode === 'kanaOnly') {
          return `${index + 1}. ${line.kana}`
        }

        if (lyricDisplayMode === 'minimal') {
          return `${index + 1}. ${line.raw}`
        }

        if (lyricDisplayMode === 'phonetic') {
          return `${index + 1}. ${line.raw}\n${line.chinesePhonetic}`
        }

        if (lyricDisplayMode === 'kana') {
          return `${index + 1}. ${line.raw}\n${line.kana}`
        }

        if (lyricDisplayMode === 'romaji') {
          return `${index + 1}. ${line.raw}\n${line.romaji}`
        }

        return `${index + 1}. ${line.raw}\n${line.kana}\n${line.romaji}\n${line.chinesePhonetic}`
      })
      .join('\n\n')

    return `${record.title} - ${record.artist}\n模式：${
      LYRIC_MODE_OPTIONS.find((option) => option.mode === lyricDisplayMode)?.label ?? lyricDisplayMode
    }\n\n${body}\n`
  }

  const handleExportLyrics = async () => {
    if (!record) {
      return
    }

    try {
      const safeTitle = record.title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 24) || 'lyrics'
      const fileName = `${safeTitle}-${lyricDisplayMode}.txt`
      const filePath = `${Taro.env.USER_DATA_PATH}/${fileName}`
      const fileSystem = Taro.getFileSystemManager()

      await new Promise<void>((resolve, reject) => {
        fileSystem.writeFile({
          filePath,
          encoding: 'utf8',
          data: buildExportContent(),
          success: () => resolve(),
          fail: (error) => reject(error)
        })
      })

      await Taro.showModal({
        title: '导出成功',
        content: `已生成：${fileName}`,
        showCancel: false
      })
    } catch (error) {
      await Taro.showToast({
        title: error instanceof Error ? error.message : '导出失败',
        icon: 'none'
      })
    }
  }

  return (
    <View className='detail-page'>
      {loading ? (
        <View className='detail-empty'>正在载入歌词与音频...</View>
      ) : record ? (
        <>
          <View className='detail-hero'>
            <View className={`detail-hero__cover ${getToneClass(record.id)}`}>
              <Text className='detail-hero__cover-label'>{record.title.slice(0, 1).toUpperCase()}</Text>
            </View>

            <View className='detail-hero__meta'>
              <Text className='detail-hero__title'>{record.title}</Text>
              <Text className='detail-hero__artist'>{record.artist}</Text>
              <Text className='detail-hero__stats'>
                {record.durationLabel} · {record.lyricLines.length} 行歌词
              </Text>
            </View>
          </View>

          <View className='detail-lyric-modes'>
            {LYRIC_MODE_OPTIONS.map(({ mode, label }) => (
              <View
                key={mode}
                className={`detail-lyric-modes__chip ${lyricDisplayMode === mode ? 'detail-lyric-modes__chip--active' : ''}`}
                onClick={() => {
                  setLyricDisplayMode(mode)
                }}
              >
                <Text className='detail-lyric-modes__chip-text'>{label}</Text>
              </View>
            ))}
          </View>
          <Text className='detail-lyrics__hint'>
            {canEditCurrentMode ? '双击歌词行可直接编辑当前模式文本' : '切到“仅谐音 / 仅歌词 / 仅罗马音 / 仅假名”可双击编辑'}
          </Text>

          <ScrollView
            className='detail-lyrics'
            scrollY
            scrollIntoView={scrollIntoView}
            scrollWithAnimation
            scrollIntoViewAlignment='center'
          >
            {record.lyricLines.map((line, index) => {
              const isActive = index === activeIndex
              const showRaw = !['phoneticOnly', 'romajiOnly', 'kanaOnly'].includes(lyricDisplayMode)

              return (
                <View
                  key={line.id}
                  id={lyricScrollId(line)}
                  className={`detail-line ${isActive ? 'detail-line--active' : 'detail-line--inactive'}`}
                  onClick={() => handleLineClick(line)}
                >
                  {showRaw ? <Text className='detail-line__raw'>{line.raw}</Text> : null}
                  {lyricDisplayMode === 'minimal' ? null : lyricDisplayMode === 'phonetic' ? (
                    <Text className='detail-line__phonetic'>{line.chinesePhonetic}</Text>
                  ) : lyricDisplayMode === 'kana' ? (
                    <Text className='detail-line__kana'>{line.kana}</Text>
                  ) : lyricDisplayMode === 'romaji' ? (
                    <Text className='detail-line__romaji'>{line.romaji}</Text>
                  ) : lyricDisplayMode === 'phoneticOnly' ? (
                    <Text className='detail-line__phonetic'>{line.chinesePhonetic}</Text>
                  ) : lyricDisplayMode === 'romajiOnly' ? (
                    <Text className='detail-line__romaji'>{line.romaji}</Text>
                  ) : lyricDisplayMode === 'kanaOnly' ? (
                    <Text className='detail-line__kana'>{line.kana}</Text>
                  ) : (
                    <>
                      <Text className='detail-line__kana detail-line__aux--full'>{line.kana}</Text>
                      <Text className='detail-line__romaji detail-line__aux--full'>{line.romaji}</Text>
                      <Text className='detail-line__phonetic detail-line__aux--full'>{line.chinesePhonetic}</Text>
                    </>
                  )}
                </View>
              )
            })}
          </ScrollView>

          <View className='detail-player safe-bottom'>
            <Text className='detail-player__title'>
              {record.title} <Text className='detail-player__artist-inline'>{record.artist}</Text>
            </Text>

            <Slider
              className='detail-player__slider'
              min={0}
              max={Math.max(1, Math.ceil(record.durationMs / 1000))}
              value={currentSeconds}
              activeColor='#7b86ea'
              backgroundColor='#ecdce3'
              blockColor='#ef9cb7'
              onChange={handleSliderChange}
            />

            <View className='detail-player__time'>
              <Text>{formatClock(currentSeconds)}</Text>
              <Text>{formatClock(record.durationMs / 1000)}</Text>
            </View>

            <View className='detail-player__controls'>
              <View className='detail-player__ghost' onClick={() => jumpLine(-1)}>
                <Text>⏮</Text>
              </View>
              <View className='detail-player__play' onClick={togglePlayback}>
                <Text>{isPlaying ? '❚❚' : '▶'}</Text>
              </View>
              <View className='detail-player__ghost' onClick={() => jumpLine(1)}>
                <Text>⏭</Text>
              </View>
              <View className='detail-player__edit' onClick={() => void openLyricEditor()}>
                <Text>编辑歌词</Text>
              </View>
              <View className='detail-player__export' onClick={() => void handleExportLyrics()}>
                <Text>导出歌词</Text>
              </View>
            </View>
          </View>
        </>
      ) : (
        <View className='detail-empty'>
          <Text className='detail-empty__title'>记录暂时打不开</Text>
          <Text className='detail-empty__copy'>{errorMessage || '请返回历史记录重新选择。'}</Text>
          <View
            className='detail-empty__button'
            onClick={() => {
              void Taro.redirectTo({ url: '/pages/history/index' })
            }}
          >
            <Text>返回历史页</Text>
          </View>
        </View>
      )}
    </View>
  )
}
