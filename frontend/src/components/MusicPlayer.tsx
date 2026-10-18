import { useEffect, useRef, useState } from 'react'
import api from '../api'

interface Track {
  id: number
  title: string
  url: string
  size: number
  createdAt: string
}

/** 切歌时在播放器周围爆开的粒子配色（沿用项目蓝/青/紫体系） */
const BURST = ['#4f8cff', '#22d3ee', '#9d4dff', '#eaf6ff']

/**
 * 首页背景音乐播放器 —— 「科幻古典 CD」质感。
 * - 中央一张旋转的镭射唱片（播放时转、暂停停），外圈轨道环 + 频谱条
 * - 切歌时唱片甩出 + 粒子爆开，换轨特效
 * - preload="metadata"：只加载元数据不整首下载，省带宽
 */
export default function MusicPlayer() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [burst, setBurst] = useState(0) // 递增触发切歌粒子
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
  }, [idx, tracks])

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
    setBurst((b) => b + 1)
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
    <div className="music-player">
      {/* 切歌粒子画布 */}
      <canvas className="music-burst" ref={canvasRef} aria-hidden="true" />

      {/* 科幻 CD：外圈轨道环 + 旋转唱片 */}
      <div className={`cd ${playing ? 'spinning' : ''}`} key={`cd-${idx}`} onClick={toggle}>
        <div className="cd-ring" />
        <div className="cd-disc">
          <div className="cd-grooves" />
          <div className="cd-label">
            <span className="cd-label-core" />
          </div>
        </div>
        <div className="cd-glint" />
      </div>

      {/* 频谱条 */}
      <div className="spectrum" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className={playing ? 'eq on' : 'eq'} style={{ animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>

      {/* 控制区 */}
      <div className="music-info">
        <span className="music-title">{track.title}</span>
        <span className="music-meta">{tracks.length} 首 · 背景音乐</span>
      </div>
      <div className="music-controls">
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

      <audio ref={audioRef} preload="metadata" onEnded={() => next(1)} />
    </div>
  )
}
