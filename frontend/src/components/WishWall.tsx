import { useEffect, useState, type FormEvent } from 'react'
import { useReducedMotion } from 'framer-motion'
import api, { errorMessage } from '../api'
import { startVisiblePoll } from '../lib/poll'
import Reveal from './Reveal'

/** 跑马灯轮询间隔：留言更新不追求秒级，60s 足够 */
const POLL_MS = 60_000

const MAX_LEN = 140

interface Wish {
  id: number
  nickname: string
  content: string
}

/**
 * 演示弹幕池：还没有审核通过的留言时占位用，避免墙面空着。
 * 只留 3 条（培养体系 / 理念 / 入门），后续换成真人留言时直接替换这里的文案即可；
 * 数量少也要能撑满三行，靠下面的「循环补齐」逻辑，不需要在这里复制多份。
 */
const PLACEHOLDER: Wish[] = [
  { id: -1, nickname: '大四学长', content: '大四统筹、大三监管、大二执行、大一深耕' },
  { id: -2, nickname: 'CUBE', content: '一切进仓库，让四年的产出可被看见' },
  { id: -3, nickname: '学姐', content: 'project 才是课，看视频只是准备' }
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
    // 页面在后台（切标签页/锁屏）时完全不发请求；回到前台立刻补拉一次
    const stop = startVisiblePoll(load, POLL_MS)
    return () => {
      dead = true
      stop()
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

  /* ---------- 分配弹幕：真实留言优先，不足时用演示池循环补齐 ---------- */
  const ROWS = 3
  // 每行至少 4 条：轨道位移一整段 seg 后，右侧还剩 2×seg 的内容，
  // 所以只要 2×seg ≥ 行宽就不会露空档；4 条（约 1400px/段）能覆盖到 2800px 的屏宽。
  const MIN_PER_ROW = 4
  const MIN_ITEMS = ROWS * MIN_PER_ROW
  const real = wishes.length > 0
  // 去重：真实留言里已经有的内容，演示池里就不再出现
  const pool = PLACEHOLDER.filter((p) => !wishes.some((w) => w.content === p.content))

  // 真实留言按顺序轮流落行，保证三行都有内容
  const rows: Wish[][] = Array.from({ length: ROWS }, () => [])
  wishes.forEach((w, i) => rows[i % ROWS].push(w))
  // 演示池只有 3 条：每行从不同起点循环取，三行内容自然错开（不会三行同时出现同一句），
  // 同时把每行补到 MIN_PER_ROW 条，跑马灯才不会露出空白
  if (wishes.length < MIN_ITEMS && pool.length > 0) {
    rows.forEach((row, r) => {
      for (let k = r; row.length < MIN_PER_ROW; k++) {
        row.push(pool[k % pool.length])
      }
    })
  }

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

      {/* 三行弹幕：内容拆三段、错位反向、不同速度交错滚动（各自复制 3 份无缝衔接） */}
      <Reveal delay={0.1}>
        <div className="wish-marquee" aria-hidden={wishes.length === 0}>
          {rows.map((seg, row) => {
            // 复制 3 份、位移 -33.333%（见 index.css 的 wish-scroll）：
            // 位移一整个 seg 就回到起点，所以滚动速度与「复制 2 份 + -50%」完全一致，
            // 但循环末尾轨道还剩 2×seg 的内容在右侧，宽屏（直到 2×seg）都不会露出空档。
            const list = [...seg, ...seg, ...seg]
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
