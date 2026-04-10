import Kuroshiro from 'kuroshiro'
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji'

import type { EnrichedLyricLine } from '../types'
import { romajiToChinesePhonetics } from '../utils/chinesePhonetics'

let kuroshiroPromise: Promise<Kuroshiro> | null = null

function normalizeText(value: string): string {
  return value
    .replace(/\s+([、。！？,.!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

async function getKuroshiro(): Promise<Kuroshiro> {
  if (!kuroshiroPromise) {
    kuroshiroPromise = (async () => {
      const instance = new Kuroshiro()
      await instance.init(new KuromojiAnalyzer())
      return instance
    })()
  }

  return kuroshiroPromise
}

export async function enrichJapaneseText(text: string): Promise<EnrichedLyricLine> {
  const raw = text.trim()

  if (!raw) {
    return {
      raw: '',
      kana: '',
      romaji: '',
      chinesePhonetic: ''
    }
  }

  const kuroshiro = await getKuroshiro()
  const kana = normalizeText(
    await kuroshiro.convert(raw, {
      to: 'hiragana',
      mode: 'spaced'
    })
  )
  const romaji = normalizeText(
    await kuroshiro.convert(raw, {
      to: 'romaji',
      mode: 'spaced',
      romajiSystem: 'passport'
    })
  )

  return {
    raw,
    kana,
    romaji,
    chinesePhonetic: romajiToChinesePhonetics(romaji)
  }
}
