import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import api from '../api'
import { startVisiblePoll } from '../lib/poll'

/** 里程碑阶梯：数字跨过其中一档时触发一次粒子庆祝 */
const MILESTONES = [10, 25, 50, 100, 200, 500]

/** 轮询间隔：30s，够「实时」又不给 2C2G 的小服务器添负担 */
const POLL_MS = 30_000

const BURST_COLORS = ['#4f8cff', '#8fb4ff', '#22d3ee', '#f7f8f8']

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  decay: number
  size: number
  color: string
  rot: number
  vr: number
}

/**
 * 招新实时战报：已收到 N 份简历 + 里程碑进度条。
 * - 每 30s 轮询一次公开接口；数字上涨时弹「刚刚 +N」，跨过里程碑放一束粒子
 * - 接口失败 / 还没有任何投递时整体不渲染（0 份战报只会起反效果）
 */
export default function RecruitPulse() {
  const reduce = useReducedMotion()
  const cardRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const prevRef = useRef<number | null>(null)
  const shownRef = useRef(0)

  const [count, setCount] = useState<number | null>(null)
  const [displayed, setDisplayed] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  /* ---------- 数据：首屏拉一次 + 30s 轮询 ---------- */
  useEffect(() => {
    let dead = false
    const load = async () => {
      try {
        const { data } = await api.get<{ count: number }>('/stats/recruit')
        if (!dead) setCount(data.count)
      } catch {
        /* 静默失败：战报是锦上添花，绝不影响报名主流程 */
      }
    }
    load()
    // 页面在后台（切标签页/锁屏）时完全不发请求；回到前台立刻补拉一次
    const stop = startVisiblePoll(load, POLL_MS)
    return () => {
      dead = true
      stop()
    }
  }, [])

  /* ---------- 数字滚动：count 每次变化都从旧值滚到新值（首屏 0 → N，轮询 +N） ---------- */
  useEffect(() => {
    if (count === null) return
    if (reduce) {
      setDisplayed(count)
      shownRef.current = count
      return
    }
    const from = shownRef.current
    shownRef.current = count
    // 本项目 framer-motion 版本不支持 useTransform(mv, fn)，用 animate 回调驱动 state
    const ctrl = animate(from, count, {
      duration: from === 0 ? 1.8 : 0.8,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplayed(Math.round(v))
    })
    return () => ctrl.stop()
  }, [count, reduce])

  /* ---------- 上涨检测：+N 提示 / 跨里程碑庆祝 ---------- */
  useEffect(() => {
    if (count === null) return
    const prev = prevRef.current
    prevRef.current = count
    if (prev === null || count <= prev) return

    const crossed = MILESTONES.find((m) => prev < m && count >= m)
    if (crossed !== undefined) {
      setToast(`突破 ${crossed} 份`)
      if (!reduce && cardRef.current && canvasRef.current) {
        const r = cardRef.current.getBoundingClientRect()
        fireBurst(r.left + r.width / 2, r.top + r.height / 2)
      }
    } else {
      setToast(`刚刚 +${count - prev}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, reduce])

  /* ---------- 提示条 4s 后自动消失 ---------- */
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  /** 全屏 canvas 上放一束粒子烟花（重力 + 旋转小方块），播完自停 */
  const fireBurst = (cx: number, cy: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const ps: Particle[] = []
    for (let i = 0; i < 130; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 3 + Math.random() * 9
      ps.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 3.5,
        life: 1,
        decay: 0.008 + Math.random() * 0.012,
        size: 2 + Math.random() * 3.5,
        color: BURST_COLORS[(Math.random() * BURST_COLORS.length) | 0],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.25
      })
    }

    cancelAnimationFrame(rafRef.current)
    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      let alive = false
      for (const p of ps) {
        if (p.life <= 0) continue
        alive = true
        p.vy += 0.14
        p.vx *= 0.985
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        p.life -= p.decay
        ctx.save()
        ctx.globalAlpha = Math.max(p.life, 0)
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62)
        ctx.restore()
      }
      if (alive) rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  // 还没拿到数据 / 接口挂了 / 暂时没人投递：不渲染
  if (count === null || count === 0) return null

  const next = MILESTONES.find((m) => m > count) ?? null
  const prevM = [...MILESTONES].reverse().find((m) => m <= count) ?? 0
  // 保底 4%：刚起步时进度条也不至于看起来像空的
  const pct = next ? Math.min(1, Math.max(0.04, (count - prevM) / (next - prevM))) : 1
  const caption = next
    ? `${prevM > 0 ? `已破 ${prevM} · ` : ''}还差 ${next - count} 份到 ${next}`
    : '里程碑全部达成'

  return (
    <>
      <div className="pulse-card" ref={cardRef}>
        <div className="pulse-head">
          <span className="pulse-title">
            <span className="pulse-dot" aria-hidden="true" />
            招新实时战报
          </span>
          {toast && <span className="pulse-toast">{toast}</span>}
        </div>
        <div className="pulse-num-row">
          <b className="pulse-num">{displayed}</b>
          <span className="pulse-unit">份简历已投递</span>
        </div>
        <div
          className="pulse-bar"
          role="progressbar"
          aria-valuenow={count}
          aria-valuemin={0}
          aria-valuemax={next ?? count}
        >
          <div className="pulse-fill" style={{ width: `${pct * 100}%` }} />
        </div>
        <div className="pulse-foot">{caption}</div>
      </div>
      {/* 庆祝粒子画布：固定铺满视口，不挡点击 */}
      <canvas className="burst-canvas" ref={canvasRef} aria-hidden="true" />
    </>
  )
}
