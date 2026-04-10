const baseSyllableMap: Record<string, string> = {
  a: '啊',
  i: '伊',
  u: '乌',
  e: '诶',
  o: '哦',
  ka: '卡',
  ki: '基',
  ku: '苦',
  ke: '科',
  ko: '口',
  sa: '萨',
  shi: '西',
  su: '苏',
  se: '塞',
  so: '搜',
  ta: '塔',
  chi: '七',
  tsu: '次',
  te: '忒',
  to: '托',
  na: '那',
  ni: '你',
  nu: '努',
  ne: '内',
  no: '诺',
  ha: '哈',
  hi: '嘻',
  fu: '福',
  he: '黑',
  ho: '吼',
  ma: '吗',
  mi: '米',
  mu: '木',
  me: '美',
  mo: '莫',
  ya: '呀',
  yu: '优',
  yo: '哟',
  ra: '啦',
  ri: '哩',
  ru: '鲁',
  re: '蕾',
  ro: '咯',
  wa: '哇',
  wo: '窝',
  n: '嗯',
  ga: '嘎',
  gi: '吉',
  gu: '古',
  ge: '给',
  go: '购',
  za: '杂',
  ji: '机',
  zu: '祖',
  ze: '贼',
  zo: '宗',
  da: '达',
  de: '得',
  do: '多',
  ba: '吧',
  bi: '比',
  bu: '不',
  be: '贝',
  bo: '波',
  pa: '啪',
  pi: '皮',
  pu: '普',
  pe: '配',
  po: '破',
  kya: '基呀',
  kyu: '基优',
  kyo: '基哟',
  gya: '吉呀',
  gyu: '吉优',
  gyo: '吉哟',
  sha: '夏',
  shu: '修',
  sho: '秀',
  ja: '嘉',
  ju: '玖',
  jo: '久',
  cha: '恰',
  chu: '啾',
  cho: '秋',
  nya: '娘呀',
  nyu: '妞',
  nyo: '纽',
  hya: '嘿呀',
  hyu: '休',
  hyo: '嘿哟',
  bya: '比呀',
  byu: '比优',
  byo: '比哟',
  pya: '皮呀',
  pyu: '皮优',
  pyo: '皮哟',
  mya: '咪呀',
  myu: '谬',
  myo: '咪哟',
  rya: '哩呀',
  ryu: '溜',
  ryo: '哩哟',
  fa: '发',
  fi: '菲',
  fe: '飞',
  fo: '佛',
  va: '哇',
  vi: '薇',
  vu: '乌',
  ve: '维',
  vo: '沃'
}

const punctuationPattern = /^[,.!?;:()'"-]$/

const syllables = Object.keys(baseSyllableMap).sort((left, right) => right.length - left.length)

function normalizeRomaji(value: string): string {
  return value
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/[^a-z\s,.!?;:()']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function mapWord(word: string): string {
  let cursor = 0
  let mapped = ''

  while (cursor < word.length) {
    const current = word[cursor]
    const next = word[cursor + 1]

    if (current && next && current === next && !'aeioun'.includes(current)) {
      mapped += '克'
      cursor += 1
      continue
    }

    const matched = syllables.find((syllable) => word.startsWith(syllable, cursor))

    if (matched) {
      mapped += baseSyllableMap[matched]
      cursor += matched.length
      continue
    }

    mapped += current
    cursor += 1
  }

  return mapped
}

export function romajiToChinesePhonetics(romaji: string): string {
  const normalized = normalizeRomaji(romaji)

  if (!normalized) {
    return ''
  }

  return normalized
    .split(' ')
    .map((word) => {
      if (!word) {
        return ''
      }

      if (word.length === 1 && punctuationPattern.test(word)) {
        return word
      }

      return mapWord(word)
    })
    .join(' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim()
}
