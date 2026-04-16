import { Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'

import { fetchRecord, updateRecord } from '../../services/api'
import type { AudioRecord, UpdateLyricLinePayload } from '../../types/record'

import './index.scss'

interface EditorLine extends UpdateLyricLinePayload {
  localId: string
}

function parseMsInput(value: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }

  return Math.floor(parsed)
}

export default function LyricsEditorPage() {
  const [recordId, setRecordId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [lines, setLines] = useState<EditorLine[]>([])
  const [expandedLineIds, setExpandedLineIds] = useState<string[]>([])
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const allowAutoSaveRef = useRef(false)
  const skipNextAutoSaveRef = useRef(true)
  const savingRef = useRef(false)
  const saveQueuedRef = useRef(false)

  useEffect(() => {
    const id = Taro.getCurrentInstance().router?.params?.id ?? ''
    setRecordId(id)

    if (!id) {
      setLoading(false)
      setErrorMessage('缺少记录 ID，请返回跟唱页后重试。')
      return
    }

    void (async () => {
      allowAutoSaveRef.current = false
      skipNextAutoSaveRef.current = true
      try {
        setLoading(true)
        setErrorMessage('')
        const record = await fetchRecord(id)
        hydrateFromRecord(record)
        allowAutoSaveRef.current = true
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '加载歌词失败。')
        allowAutoSaveRef.current = false
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const hydrateFromRecord = (record: AudioRecord) => {
    setTitle(record.title)
    setArtist(record.artist)
    setExpandedLineIds([])
    setLines(
      record.lyricLines.map((line, index) => ({
        id: line.id,
        localId: `${line.id}-${index}`,
        startMs: line.startMs,
        endMs: line.endMs,
        raw: line.raw,
        kana: line.kana,
        romaji: line.romaji,
        chinesePhonetic: line.chinesePhonetic
      }))
    )
  }

  const updateLine = (localId: string, patch: Partial<EditorLine>) => {
    setLines((current) => current.map((line) => (line.localId === localId ? { ...line, ...patch } : line)))
  }

  const appendLine = () => {
    const lastEndMs = lines[lines.length - 1]?.endMs ?? 0
    const base = lastEndMs + 800
    const nextIndex = lines.length + 1

    setLines((current) => [
      ...current,
      {
        localId: `new-${Date.now()}-${nextIndex}`,
        startMs: base,
        endMs: base + 1800,
        raw: '',
        kana: '',
        romaji: '',
        chinesePhonetic: ''
      }
    ])
  }

  const removeLine = (localId: string) => {
    setLines((current) => current.filter((line) => line.localId !== localId))
    setExpandedLineIds((current) => current.filter((id) => id !== localId))
  }

  const insertLineAbove = (localId: string) => {
    setLines((current) => {
      const targetIndex = current.findIndex((line) => line.localId === localId)
      if (targetIndex < 0) {
        return current
      }

      const targetLine = current[targetIndex]
      const previousLine = current[targetIndex - 1]
      const fallbackStart = Math.max(0, targetLine.startMs - 1800)
      const startMs = previousLine ? previousLine.endMs : fallbackStart
      const endMs = Math.max(startMs, targetLine.startMs)
      const nextLine: EditorLine = {
        localId: `new-${Date.now()}-${targetIndex}`,
        startMs,
        endMs,
        raw: '',
        kana: '',
        romaji: '',
        chinesePhonetic: ''
      }

      return [...current.slice(0, targetIndex), nextLine, ...current.slice(targetIndex)]
    })
  }

  const buildSavePayload = (): { title: string; artist: string; lyricLines: UpdateLyricLinePayload[] } => {
    const sortedLines = [...lines]
      .sort((a, b) => a.startMs - b.startMs)
      .map(({ id, startMs, endMs, raw, kana, romaji, chinesePhonetic }) => ({
        id,
        startMs,
        endMs,
        raw: raw.trim(),
        kana: kana.trim(),
        romaji: romaji.trim(),
        chinesePhonetic: chinesePhonetic.trim()
      }))

    return {
      title: title.trim(),
      artist: artist.trim(),
      lyricLines: sortedLines
    }
  }

  const validateBeforeSave = () => {
    if (!recordId) {
      return { ok: false, message: '缺少记录 ID，请返回跟唱页后重试。' }
    }
    if (lines.length === 0) {
      return { ok: false, message: '歌词行不能为空，请至少保留一行。' }
    }
    if (lines.some((line) => line.endMs < line.startMs)) {
      return { ok: false, message: '请先修正时间轴：endMs 不能小于 startMs。' }
    }
    return { ok: true, message: '' }
  }

  const persistToServer = async (options?: { navigateBack?: boolean; showSuccessToast?: boolean }) => {
    const { ok, message } = validateBeforeSave()
    if (!ok) {
      if (options?.showSuccessToast) {
        await Taro.showToast({ title: message, icon: 'none' })
      }
      return
    }

    if (savingRef.current) {
      // 正在保存时用户继续编辑，记录一下，保存结束后再补一次
      saveQueuedRef.current = true
      return
    }

    savingRef.current = true
    setSaving(true)

    try {
      await updateRecord(recordId, buildSavePayload())

      if (options?.showSuccessToast) {
        await Taro.showToast({ title: '保存成功', icon: 'success' })
      }

      if (options?.navigateBack) {
        await Taro.navigateBack()
      }
    } catch (error) {
      // 自动保存失败只做提示，不会中断编辑
      await Taro.showToast({
        title: error instanceof Error ? error.message : '保存失败',
        icon: 'none'
      })
    } finally {
      savingRef.current = false
      setSaving(false)

      // 如果保存期间用户又改了东西，补一次
      if (saveQueuedRef.current && !options?.navigateBack) {
        saveQueuedRef.current = false
        void persistToServer({ showSuccessToast: false })
      } else {
        saveQueuedRef.current = false
      }
    }
  }

  const handleSave = async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }

    saveQueuedRef.current = false
    await persistToServer({ navigateBack: true, showSuccessToast: true })
  }

  useEffect(() => {
    if (!allowAutoSaveRef.current) return
    if (!recordId) return
    if (loading) return
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false
      return
    }
    if (lines.length === 0) return
    if (lines.some((line) => line.endMs < line.startMs)) return

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = setTimeout(() => {
      void persistToServer({ navigateBack: false, showSuccessToast: false })
    }, 900)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
    }
  }, [title, artist, lines, recordId, loading])

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  const toggleLineExpanded = (localId: string) => {
    setExpandedLineIds((current) =>
      current.includes(localId) ? current.filter((id) => id !== localId) : [...current, localId]
    )
  }

  return (
    <View className='lyrics-editor-page'>
      {loading ? (
        <View className='lyrics-editor-page__empty'>正在加载歌词...</View>
      ) : errorMessage ? (
        <View className='lyrics-editor-page__empty'>{errorMessage}</View>
      ) : (
        <>
          <View className='lyrics-editor-page__header'>
            <Text className='lyrics-editor-page__title'>歌词编辑</Text>
            <Text className='lyrics-editor-page__subtitle'>可修改标题、歌手、歌词内容与时间轴</Text>
          </View>

          <View className='lyrics-editor-page__card'>
            <Text className='lyrics-editor-page__label'>歌曲标题</Text>
            <Input className='lyrics-editor-page__input' value={title} onInput={(event) => setTitle(event.detail.value)} />

            <Text className='lyrics-editor-page__label'>歌手</Text>
            <Input
              className='lyrics-editor-page__input'
              value={artist}
              onInput={(event) => setArtist(event.detail.value)}
            />
          </View>

          <View className='lyrics-editor-page__section-title'>歌词行</View>
          {lines.map((line, index) => (
            <View className='lyrics-line-card' key={line.localId}>
              {(() => {
                const isExpanded = expandedLineIds.includes(line.localId)

                return (
                  <>
                    <View className='lyrics-line-card__header'>
                      <Text className='lyrics-line-card__index'>{String(index + 1).padStart(2, '0')}</Text>
                      <View className='lyrics-line-card__actions'>
                        <View className='lyrics-line-card__toggle' onClick={() => toggleLineExpanded(line.localId)}>
                          <Text>{isExpanded ? '收起' : '展开'}</Text>
                        </View>
                        <View className='lyrics-line-card__insert' onClick={() => insertLineAbove(line.localId)}>
                          <Text>上方新增</Text>
                        </View>
                        <View className='lyrics-line-card__remove' onClick={() => removeLine(line.localId)}>
                          <Text>删除</Text>
                        </View>
                      </View>
                    </View>

                    <Text className='lyrics-editor-page__label'>中文谐音</Text>
                    <Input
                      className='lyrics-editor-page__input'
                      value={line.chinesePhonetic}
                      onInput={(event) => updateLine(line.localId, { chinesePhonetic: event.detail.value })}
                    />

                    {isExpanded ? (
                      <>
                        <Text className='lyrics-editor-page__label'>原文</Text>
                        <Input
                          className='lyrics-editor-page__input'
                          value={line.raw}
                          onInput={(event) => updateLine(line.localId, { raw: event.detail.value })}
                        />

                        <Text className='lyrics-editor-page__label'>假名</Text>
                        <Input
                          className='lyrics-editor-page__input'
                          value={line.kana}
                          onInput={(event) => updateLine(line.localId, { kana: event.detail.value })}
                        />

                        <Text className='lyrics-editor-page__label'>Romaji</Text>
                        <Input
                          className='lyrics-editor-page__input'
                          value={line.romaji}
                          onInput={(event) => updateLine(line.localId, { romaji: event.detail.value })}
                        />

                        <View className='lyrics-line-card__times'>
                          <View className='lyrics-line-card__time-field'>
                            <Text className='lyrics-editor-page__label'>startMs</Text>
                            <Input
                              className='lyrics-editor-page__input'
                              type='number'
                              value={String(line.startMs)}
                              onInput={(event) => updateLine(line.localId, { startMs: parseMsInput(event.detail.value) })}
                            />
                          </View>
                          <View className='lyrics-line-card__time-field'>
                            <Text className='lyrics-editor-page__label'>endMs</Text>
                            <Input
                              className='lyrics-editor-page__input'
                              type='number'
                              value={String(line.endMs)}
                              onInput={(event) => updateLine(line.localId, { endMs: parseMsInput(event.detail.value) })}
                            />
                          </View>
                        </View>
                      </>
                    ) : null}
                  </>
                )
              })()}
            </View>
          ))}

          <View className='lyrics-editor-page__add' onClick={appendLine}>
            <Text>+ 新增歌词行</Text>
          </View>

          <View
            className={`lyrics-editor-page__save ${saving ? 'lyrics-editor-page__save--disabled' : ''}`}
            onClick={() => {
              if (!saving) {
                void handleSave()
              }
            }}
          >
            <Text>{saving ? '保存中...' : '保存到服务端'}</Text>
          </View>
        </>
      )}
    </View>
  )
}
