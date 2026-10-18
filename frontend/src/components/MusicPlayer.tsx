import { useEffect, useRef, useState } from 'react'
import api from '../api'
import { parseLrc, activeLyricIndex, type LyricLine } from '../lib/lrc'

interface Track {
  id: number
  title: string
  url: string
  size: number
  coverUrl: string | null
  lyricsUrl: string | null
  createdAt: string
}

/** 切歌时在播放器周围爆开的粒子配色（沿用项目蓝/青/紫体系） */
const BURST = ['#4f8cff', '#22d3ee', '#9d4dff', '#eaf6ff']

/**
 * 首页背景音乐播放器 —— 「科幻古典 CD」质感，内嵌版。
 * 固定在首页 logo 区域下方的独立区块，两栏结构：左歌词 / 右黑胶（带封面）。
 * 歌词、封面均为可选；无歌词时左侧显示歌名大字占位。
 */
export default function MusicPlayer() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [lyrics, setLyrics] = useState<LyricLine[]>([])
  const [activeLyric, setActiveLyric] = useState(-1)
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lyricBoxRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    let dead = false
    api.get<Track[]>('/music')
      .then((res) => { if (!dead) setTracks(res.data) })
      .catch(() => { /* 静默失败：没有曲目就不显示 */ })
    return () => { dead = true }
  }, [])

  // 曲目变化时加载新音频（不自动播放，等用户点）
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || tracks.length === 0) return
    audio.src = tracks[idx].url
    audio.load()
    setPlaying(false)
    setActiveLyric(-1)
  }, [idx, tracks])

  // 加载当前曲目的歌词（可选）
  useEffect(() => {
    if (tracks.length === 0) { setLyrics([]); return }
    const lrcUrl = tracks[idx].lyricsUrl
    if (!lrcUrl) { setLyrics([]); return }
    let dead = false
    fetch(lrcUrl)
      .then((r) => r.text())
      .then((txt) => { if (!dead) setLyrics(parseLrc(txt)) })
      .catch(() => { if (!dead) setLyrics([]) })
    return () => { dead = true }
  }, [idx, tracks])

  // 播放进度 → 歌词高亮
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => {
      const cur = activeLyricIndex(lyrics, audio.currentTime * 1000)
      setActiveLyric((prev) => (prev === cur ? prev : cur))
    }
    audio.addEventListener('timeupdate', onTime)
    return () => audio.removeEventListener('timeupdate', onTime)
  }, [lyrics])

  // 当前行滚动到可视区中间
  useEffect(() => {
    const box = lyricBoxRef.current
    if (!box) return
    const el = box.querySelector<HTMLElement>('.lyric-line.active')
    if (!el) return
    box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' })
  }, [activeLyric])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().catch(() => setPlaying(false))
      setPlaying(true)
    }
  }

  const next = (dir: 1 | -1) => {
    if (tracks.length === 0) return
    setIdx((i) => (i + dir + tracks.length) % tracks.length)
    fireBurst()
  }

  /** 切歌粒子：在播放器周围爆一圈彩点 */
  const fireBurst = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const cx = window.innerWidth / 2
    const cy = window.innerHeight - 80
    const ps = Array.from({ length: 60 }, () => {
      const a = Math.random() * Math.PI * 2
      const sp = 2 + Math.random() * 5
      return {
        x: cx, y: cy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
        life: 1, decay: 0.02 + Math.random() * 0.02,
        size: 1.5 + Math.random() * 2.5,
        color: BURST[(Math.random() * BURST.length) | 0]
      }
    })
    cancelAnimationFrame(rafRef.current)
    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      let alive = false
      for (const p of ps) {
        if (p.life <= 0) continue
        alive = true
        p.vy += 0.06
        p.x += p.vx; p.y += p.vy
        p.life -= p.decay
        ctx.globalAlpha = Math.max(p.life, 0)
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
      if (alive) rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  if (tracks.length === 0) return null

  const track = tracks[idx]

  return (
    <section className="player-section">
      {/* 切歌粒子画布（铺满视口） */}
      <canvas className="music-burst" ref={canvasRef} aria-hidden="true" />

      <div className="container">
        <div className="player-shell">
          {/* 左：歌词 */}
          <div className="vinyl-lyrics">
            {lyrics.length > 0 ? (
              <div className="lyric-box" ref={lyricBoxRef}>
                {lyrics.map((l, i) => (
                  <p key={i} className={`lyric-line ${i === activeLyric ? 'active' : ''}`}>{l.text}</p>
                ))}
              </div>
            ) : (
              <div className="lyric-empty">
                <span className="lyric-empty-title">{track.title}</span>
                <span className="lyric-empty-sub">暂无歌词 · 点击右侧黑胶播放</span>
              </div>
            )}
          </div>

          {/* 右：黑胶 + 封面 + 控制 */}
          <div className="vinyl-right">
            <div className={`vinyl-cd ${playing ? 'spinning' : ''}`} key={`vinyl-${idx}`} onClick={toggle}>
              <div className="vinyl-cd-ring" />
              <div className="vinyl-cd-disc">
                <div className="vinyl-cd-grooves" />
                <div className="vinyl-cd-label">
                  {track.coverUrl ? <img src={track.coverUrl} alt={track.title} /> : <span className="cd-label-core" />}
                </div>
              </div>
              <div className="vinyl-cd-glint" />
            </div>
            <div className="vinyl-title">{track.title}</div>
            <div className="vinyl-controls">
              <button className="music-btn" onClick={() => next(-1)} aria-label="上一首">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zM18 6l-8 6 8 6z" /></svg>
              </button>
              <button className="music-btn play" onClick={toggle} aria-label={playing ? '暂停' : '播放'}>
                {playing ? (
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>
              <button className="music-btn" onClick={() => next(1)} aria-label="下一首">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM6 6l8 6-8 6z" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <audio ref={audioRef} preload="metadata" onEnded={() => next(1)} />
    </section>
  )
}
