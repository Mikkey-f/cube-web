/**
 * LRC 歌词解析工具。
 * 支持 [mm:ss.xx] 与 [mm:ss.xxx] 两种时间标签，忽略元信息标签（[ti:] / [ar:] 等）。
 * 同一时间多行、行内多个时间标签都做兼容。
 */

export interface LyricLine {
  /** 毫秒时间戳 */
  time: number
  /** 该行文本 */
  text: string
}

/** 把 mm:ss.xx 转成毫秒 */
function tagToMs(tag: string): number | null {
  const m = tag.match(/^(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?$/)
  if (!m) return null
  const min = parseInt(m[1], 10)
  const sec = parseInt(m[2], 10)
  const fracStr = m[3] ?? '0'
  // 统一成毫秒：.x → x00, .xx → xx0, .xxx → xxx
  const frac = parseInt(fracStr.padEnd(3, '0').slice(0, 3), 10)
  return min * 60_000 + sec * 1000 + frac
}

/**
 * 解析 LRC 文本为按时间排序的歌词行数组。
 * 无有效歌词时返回空数组。
 */
export function parseLrc(raw: string): LyricLine[] {
  if (!raw) return []
  const lines: LyricLine[] = []
  const tagRe = /\[(\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?)\]/g

  for (const line of raw.split(/\r?\n/)) {
    const matches = [...line.matchAll(tagRe)]
    if (matches.length === 0) continue
    const text = line.replace(tagRe, '').trim()
    if (!text) continue
    for (const match of matches) {
      const ms = tagToMs(match[1])
      if (ms == null) continue
      lines.push({ time: ms, text })
    }
  }

  lines.sort((a, b) => a.time - b.time)
  return lines
}

/**
 * 根据当前播放时间（毫秒）返回应高亮的歌词行索引。
 * 返回 -1 表示尚未到第一句。
 */
export function activeLyricIndex(lines: LyricLine[], timeMs: number): number {
  let idx = -1
  for (let i = 0; i < lines.length; i++) {
    if (timeMs >= lines[i].time) idx = i
    else break
  }
  return idx
}
