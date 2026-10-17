import { useEffect, useState, type FormEvent } from 'react'
import { useReducedMotion } from 'framer-motion'
import api, { errorMessage } from '../api'
import Reveal from './Reveal'

/** 跑马灯轮询间隔：留言更新不追求秒级，60s 足够 */
const POLL_MS = 60_000

const MAX_LEN = 140

interface Wish {
  id: number
  nickname: string
  content: string
}

/** 还没有审核通过的留言时的占位条目，避免墙面空着 */
const PLACEHOLDER: Wish[] = [
  { id: -1, nickname: '大四学长', content: '大四统筹、大三监管、大二执行、大一深耕' },
  { id: -2, nickname: '大二组长', content: '每天一道算法题，做完就提交' },
  { id: -3, nickname: 'CUBE', content: '一切进仓库，让四年的产出可被看见' },
  { id: -4, nickname: '学姐', content: 'project 才是课，看视频只是准备' },
  { id: -5, nickname: '学长', content: '从 C 语言开始，零基础也能跟上' },
  { id: -6, nickname: 'CUBE', content: '每周一次周会，人人汇报' },
  { id: -7, nickname: '大二组长', content: '帮助学弟解决问题，而不是替他解决问题' },
  { id: -8, nickname: '学长', content: '绩点是保研的入场券，任何一门课都不能挂' },
  { id: -9, nickname: 'CUBE', content: 'GitHub 提交记录，就是你最好的履历' },
  { id: -10, nickname: '学姐', content: '考试周可以调任务，但别长期停滞' }
]

/**
 * 留言祝福墙：底部跑马灯 + 一句话留言表单。
 * 提交后进入审核队列，管理员在后台通过后才上墙；
 * 跑马灯复用技术栈跑马灯的 .marquee 体系，悬停暂停。
 */
export default function WishWall() {
  const reduce = useReducedMotion()
  const [wishes, setWishes] = useState<Wish[]>([])
  const [nickname, setNickname] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [tip, setTip] = useState<{ ok: boolean; text: string } | null>(null)

  /* ---------- 拉取已审核留言：首屏一次 + 60s 轮询 ---------- */
  useEffect(() => {
    let dead = false
    const load = async () => {
      try {
        const { data } = await api.get<Wish[]>('/messages/approved')
        if (!dead) setWishes(data)
      } catch {
        /* 静默失败：祝福墙挂了就显示占位文案，不影响主流程 */
      }
    }
    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      dead = true
      clearInterval(timer)
    }
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const text = content.trim()
    if (!text || submitting) return
    setSubmitting(true)
    setTip(null)
    try {
      const { data } = await api.post<{ message: string }>('/messages', {
        nickname: nickname.trim() || undefined,
        content: text
      })
      setTip({ ok: true, text: data.message })
      setContent('')
    } catch (err) {
      setTip({ ok: false, text: errorMessage(err) })
    } finally {
      setSubmitting(false)
    }
  }

  // 真实留言优先，不足 10 条用演示弹幕补齐（去重：避免同屏出现两条一模一样）
  const MIN_ITEMS = 10
  const shown = wishes.length >= MIN_ITEMS
    ? wishes
    : [...wishes, ...PLACEHOLDER.filter((p) => !wishes.some((w) => w.content === p.content)).slice(0, MIN_ITEMS - wishes.length)]
  const real = wishes.length > 0

  return (
    <section className="wish-section" id="wishes">
      <div className="container">
        <Reveal>
          <div className="section-head">
            <span className="eyebrow">Wish wall</span>
            <h2 className="section-title">给彼此留一句话</h2>
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <form className="wish-form" onSubmit={submit}>
            <input
              className="wish-input wish-nick"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="昵称（可留空）"
              maxLength={32}
            />
            <div className="wish-content-wrap">
              <input
                className="wish-input"
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="写一句祝福、目标或吐槽，审核通过后就会上墙"
                maxLength={MAX_LEN}
                required
              />
              <span className="wish-count">{content.length}/{MAX_LEN}</span>
            </div>
            <button className="btn btn-primary wish-submit" type="submit" disabled={submitting || !content.trim()}>
              {submitting ? '提交中…' : '上墙'}
            </button>
          </form>
          {tip && <p className={`wish-tip ${tip.ok ? 'ok' : 'err'}`}>{tip.text}</p>}
        </Reveal>
      </div>

      {/* 三行弹幕：内容拆三段、错位反向、不同速度交错滚动（各自复制一份无缝衔接） */}
      <Reveal delay={0.1}>
        <div className="wish-marquee" aria-hidden={wishes.length === 0}>
          {[0, 1, 2].map((row) => {
            const seg = shown.filter((_, i) => i % 3 === row)
            const list = [...seg, ...seg]
            return (
              <div className={`wish-row wish-row-${row}`} key={row}>
                <div className="wish-track" style={reduce ? { animation: 'none' } : undefined}>
                  {list.map((w, i) => (
                    <span className={`wish-item ${real ? '' : 'ghost'}`} key={`${w.id}-${i}`} aria-hidden={i >= seg.length}>
                      <span className="wish-text">{w.content}</span>
                      <span className="wish-from">—— {w.nickname}</span>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Reveal>
    </section>
  )
}
