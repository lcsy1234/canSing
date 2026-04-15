import { Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'

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

  useEffect(() => {
    const id = Taro.getCurrentInstance().router?.params?.id ?? ''
    setRecordId(id)

    if (!id) {
      setLoading(false)
      setErrorMessage('缺少记录 ID，请返回跟唱页后重试。')
      return
    }

    void (async () => {
      try {
        setLoading(true)
        setErrorMessage('')
        const record = await fetchRecord(id)
        hydrateFromRecord(record)
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '加载歌词失败。')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const hydrateFromRecord = (record: AudioRecord) => {
    setTitle(record.title)
    setArtist(record.artist)
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

  const isSubmittable = useMemo(() => {
    if (!title.trim() || !artist.trim() || lines.length === 0) {
      return false
    }

    return lines.every((line) => line.raw.trim() && line.startMs >= 0 && line.endMs >= line.startMs)
  }, [artist, lines, title])

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
  }

  const handleSave = async () => {
    if (!recordId) {
      return
    }

    if (!isSubmittable) {
      await Taro.showToast({
        title: '请完善标题、歌手和歌词时间轴',
        icon: 'none'
      })
      return
    }

    try {
      setSaving(true)
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

      await updateRecord(recordId, {
        title: title.trim(),
        artist: artist.trim(),
        lyricLines: sortedLines
      })

      await Taro.showToast({
        title: '保存成功',
        icon: 'success'
      })

      await Taro.navigateBack()
    } catch (error) {
      await Taro.showToast({
        title: error instanceof Error ? error.message : '保存失败',
        icon: 'none'
      })
    } finally {
      setSaving(false)
    }
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
              <View className='lyrics-line-card__header'>
                <Text className='lyrics-line-card__index'>{String(index + 1).padStart(2, '0')}</Text>
                <View className='lyrics-line-card__remove' onClick={() => removeLine(line.localId)}>
                  <Text>删除</Text>
                </View>
              </View>

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

              <Text className='lyrics-editor-page__label'>中文谐音</Text>
              <Input
                className='lyrics-editor-page__input'
                value={line.chinesePhonetic}
                onInput={(event) => updateLine(line.localId, { chinesePhonetic: event.detail.value })}
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
