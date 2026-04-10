declare module 'whisper-node' {
  const whisper: (
    filePath: string,
    options?: Record<string, unknown>
  ) => Promise<Array<{ start: string; end: string; speech: string }>>

  export default whisper
}

declare module 'kuroshiro' {
  export default class Kuroshiro {
    init(analyzer: unknown): Promise<void>
    convert(text: string, options?: Record<string, unknown>): Promise<string>
  }
}

declare module 'kuroshiro-analyzer-kuromoji' {
  export default class KuromojiAnalyzer {
    constructor(options?: Record<string, unknown>)
  }
}
