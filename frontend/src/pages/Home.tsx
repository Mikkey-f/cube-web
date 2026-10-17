import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants
} from 'framer-motion'
import CubeScene from '../components/CubeScene'
import Reveal from '../components/Reveal'
import RecruitPulse from '../components/RecruitPulse'
import WishWall from '../components/WishWall'
import { HexBadge, HexDivider } from '../components/Hex'
import { DirectionArt, StepPanel } from '../components/MiniUI'

/* ============================================================
   内容数据
   口径已对齐《组织运行管理条例》《培养方案》《大一、大二考核要求》，
   修改招新、培养、考核相关表述前请先核对这三份文档。
   ============================================================ */

/** 跑马灯：培养方案里的主线技术 */
const STACK = [
  'C/C++',
  'Python',
  'Java',
  'Go',
  '数据结构与算法',
  'Linux',
  'Git',
  'GitHub',
  'CS 公开课',
  'AI Agent'
]

const PRINCIPLES = [
  {
    title: '梯队传帮带',
    desc: '大四统筹、大三监管、大二执行、大一深耕。每名大二组长带 2~3 名新生，从入门开始手把手带。'
  },
  {
    title: '持续学习',
    desc: '每天一道算法题、每周一次周会、每月一次阶段考核。不追求学得多，追求“每周都在动”。'
  },
  {
    title: '一切进仓库',
    desc: '代码、题解、笔记、项目全部推上 GitHub。提交记录就是学习轨迹，也是保研、求职的履历。'
  }
]

type ArtKind = 'infra' | 'backend' | 'ai' | 'oss'

interface Direction {
  title: string
  desc: string
  tags: string[]
  art: ArtKind
  /** 6 栏网格里占几栏 */
  span: 2 | 3 | 4
}

const DIRECTIONS: Direction[] = [
  {
    title: '基础与算法',
    desc: 'C 语言速通、Python 必学，每天一道算法题保持手感——地基打得牢，后面才走得快。',
    tags: ['C/C++', 'Python', '数据结构与算法'],
    art: 'infra',
    span: 3
  },
  {
    title: '后端与系统',
    desc: '就业市场的主流路线。Java、C++、Go 任选一门深入，再配 CSAPP、CS144 这样的硬课打通系统。',
    tags: ['Java', 'C++', 'Go'],
    art: 'backend',
    span: 3
  },
  {
    title: '人工智能',
    desc: '从 Python 打底到 CS224n 深入，再把 AI Agent 当成日常工具：读代码、查文档、写脚本、排错。',
    tags: ['Python', 'CS224n', 'Agent'],
    art: 'ai',
    span: 3
  },
  {
    title: '开源与履历',
    desc: '学会 Git 协作，一切进 GitHub 仓库——让每一分努力都沉淀成看得见的履历。',
    tags: ['Git', 'GitHub', '学习档案'],
    art: 'oss',
    span: 3
  }
]

type StepKind = 'spec' | 'agenda' | 'review'

interface Step {
  title: string
  desc: string
  checks: string[]
  panel: StepKind
}

const HOW: Step[] = [
  {
    title: '一份跟得上的培养计划',
    desc: '不追求学得多，追求每周都在动。C 语言、算法题、Python、Git……按阶段推进即可，考试周可以提前说明、调整任务。',
    checks: ['每天一道算法题', '阶段任务清晰可查'],
    panel: 'spec'
  },
  {
    title: '每周周会，人人汇报',
    desc: '每周到实验室线下参加周会：本周学了什么、卡在哪里、下周做什么。大二组长跟进指导，问题现场定位。',
    checks: ['大二组长每人带 2~3 名新生', '下周计划每周更新'],
    panel: 'agenda'
  },
  {
    title: 'GitHub 档案 + 月度考核',
    desc: '代码、题解、笔记全部进仓库，形成长期学习档案。实验室每月进行阶段考核，结果分正常推进、警告、淘汰。',
    checks: ['做完就提交，成长有迹可循', '先警告、再淘汰，规则透明'],
    panel: 'review'
  }
]

const BELIEFS = [
  { text: '绩点是保研的入场券，任何一门课都不能挂。', label: '关于底线' },
  { text: '连续性优先：每天一题，做完就提交。', label: '关于节奏' },
  { text: 'project 才是课，看视频、抄笔记都只是准备。', label: '关于学习' },
  { text: '帮助学弟解决问题，而不是替他解决问题。', label: '关于带教', accent: true },
  { text: '提前对表：加分和实习，都按官方规则的清单准备。', label: '关于规划' },
  { text: '一切进仓库，让四年的产出可被看见。', label: '关于履历' }
]

const FAQ = [
  {
    q: '完全没有基础，可以报名吗？',
    a: '可以。实验室本来就是零基础技术赋能的路线：从 C 语言和算法开始，由大二组长手把手带教。比起你现在会多少，我们更看重你愿不愿意坚持学。'
  },
  {
    q: '需要投入多少时间？',
    a: '稳定投入比时长更重要：每天一道算法题、每周参加一次周会，再推进阶段学习任务。考试周可以提前说明、调整任务，但实验室每月有阶段考核，长期停滞会先警告、后淘汰。'
  },
  {
    q: '报名之后是什么流程？',
    a: '提交报名并通过筛选后，你会进入线上预备阶段：学习任务与资料在飞书同步，每周到实验室线下参加周会，由对应的大二组长带教；大二上学期考核合格后入驻线下实验室。'
  },
  {
    q: '一定要会写代码才能加入吗？',
    a: '不必。招新面向零基础新生，起点就是 C 语言和算法基础，跟着培养计划一步步走就行。'
  },
  {
    q: '有年级或专业限制吗？',
    a: '招新范围覆盖所有计算机类相关专业的大一新生，不限细分专业方向。大二及以上不再招收空降成员。'
  }
]

const CHECK_PATH = 'M3 8.5 6.5 12 13 4.5'

/* ============================================================
   小组件
   ============================================================ */

/**
 * 滚动填充的一行文字：未读到时是暗的，滚到视口里从右往左「点亮」。
 * 手法抄自 Lumen 的 statement，但不用 GSAP，改成 framer-motion 驱动
 * background-position。
 */
function FillLine({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end center'] })
  const x = useTransform(scrollYProgress, [0, 1], ['100%', '0%'])

  return (
    <motion.span
      ref={ref}
      className={`fill-line ${className}`}
      style={reduce ? { backgroundPositionX: '0%' } : { backgroundPositionX: x }}
    >
      {children}
    </motion.span>
  )
}

/** 技术栈跑马灯：内容复制一份，位移 -50% 后正好无缝衔接 */
function Marquee() {
  return (
    <div className="marquee">
      <div className="marquee-track">
        {[...STACK, ...STACK].map((s, i) => (
          <span className="marquee-item" key={`${s}-${i}`} aria-hidden={i >= STACK.length}>
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}

/** 方向卡：鼠标经过时在卡片内落一小片蓝色柔光（Lumen 的 bento 手法） */
function BentoCell({ dir, delay }: { dir: Direction; delay: number }) {
  // 缓存卡片矩形：pointermove 里每次读 getBoundingClientRect 会强制同步布局，
  // 快速滑动经过卡片时造成抖动。改为 pointerenter/scroll 时测量一次。
  const rectRef = useRef<DOMRect | null>(null)
  const cacheRect = (e: React.PointerEvent<HTMLDivElement>) => {
    rectRef.current = e.currentTarget.getBoundingClientRect()
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const r = rectRef.current ?? el.getBoundingClientRect()
    el.style.setProperty('--x', `${e.clientX - r.left}px`)
    el.style.setProperty('--y', `${e.clientY - r.top}px`)
  }

  return (
    <Reveal delay={delay} className={`span${dir.span}`}>
      <div className="bcell" onPointerEnter={cacheRect} onPointerMove={onMove}>
        <div className="bcell-art">
          <DirectionArt kind={dir.art} />
        </div>
        <div className="bcell-txt">
          <h3>{dir.title}</h3>
          <p>{dir.desc}</p>
          <div className="tag-row">
            {dir.tags.map((t) => (
              <span className="tag" key={t}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  )
}

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x))
}

/** 粘性堆叠卡里的一张：被下一张盖住时缩一点、暗下去 */
function StackCard({
  i,
  total,
  container,
  reduce,
  step
}: {
  i: number
  total: number
  container: RefObject<HTMLDivElement>
  reduce: boolean
  step: Step
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const scale = useMotionValue(1)
  const dim = useMotionValue(1)

  // 直接监听 window 滚动，往 MotionValue 里写（不触发 React 重渲染）。
  // 刻意不用 target 版 useScroll：实测在含 sticky 子元素的容器上拿不到进度。
  //
  // 变暗/缩小的驱动来自真实几何而不是虚构的等分进度：每张卡只在
  // 「下一张卡从视口底部滑上来、直到吸附到位」的过程中被盖住；最后一张
  // 卡没有下一张来盖，全程保持不透明，只在真正被推出屏幕时贴动作淡出。
  useEffect(() => {
    if (reduce) return
    let stuckTop = 96
    let stuckNext = 112
    let relTop = 0
    let cardH = 0
    let marginBottom = 26
    // 滚动期间不变的几何量全部缓存：容器文档级 top、卡片高度、视口高度。
    // 之前在每次 scroll 事件里读 getBoundingClientRect/offsetHeight，
    // 会强制同步布局（layout thrashing），是滚动掉帧的主要来源。
    let containerDocTop = 0
    let containerH = 0
    let winH = window.innerHeight
    const measure = () => {
      const card = cardRef.current
      const el = container.current
      if (!card || !el) return
      stuckTop = parseFloat(getComputedStyle(card).top) || 96
      stuckNext = stuckTop + 16
      marginBottom = parseFloat(getComputedStyle(card).marginBottom) || 26
      const cardRect = card.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      relTop = cardRect.top - elRect.top
      cardH = card.offsetHeight
      containerDocTop = elRect.top + window.scrollY
      containerH = el.offsetHeight
      winH = window.innerHeight
    }
    measure()
    const apply = (v: number) => {
      const el = container.current
      const card = cardRef.current
      if (!el || !card) return
      let dimTarget = 1
      if (i < total - 1) {
        const nextDocTop = containerDocTop + relTop + cardH + marginBottom
        const enter = nextDocTop - winH
        const arrive = nextDocTop - stuckNext
        dimTarget = 1 - 0.5 * clamp01((v - enter) / Math.max(1, arrive - enter))
      }
      // 退场淡出贴着真实释放点（容器底边碰到卡片下边缘），静止时保持可读
      const releaseV = containerDocTop + containerH - (stuckTop + cardH + marginBottom)
      const fadeStart = releaseV - 80
      const fadeEnd = releaseV + cardH * 0.35
      const exit = clamp01((v - fadeStart) / (fadeEnd - fadeStart))
      dim.set(dimTarget * (1 - exit))
      scale.set(1 - 0.06 * (1 - dimTarget))
    }
    apply(window.scrollY)
    // rAF 节流：滚动事件可能高于帧率（高刷鼠标滚轮），合并到每帧最多一次
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        apply(window.scrollY)
      })
    }
    const onResize = () => {
      measure()
      apply(window.scrollY)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [reduce, container, i, total, scale, dim])

  return (
    <motion.div ref={cardRef} className="stack-block" style={reduce ? undefined : { scale, opacity: dim }}>
      <div>
        <span className="stack-idx">{`Step 0${i + 1}`}</span>
        <h3>{step.title}</h3>
        <p>{step.desc}</p>
        <ul className="check-list">
          {step.checks.map((c) => (
            <li key={c}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d={CHECK_PATH} />
              </svg>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="stack-visual">
        <StepPanel kind={step.panel} />
      </div>
    </motion.div>
  )
}

function StackCards() {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  return (
    <div className="stack-cards" ref={ref}>
      {HOW.map((h, i) => (
        <StackCard
          key={h.title}
          i={i}
          total={HOW.length}
          container={ref}
          reduce={!!reduce}
          step={h}
        />
      ))}
      <div className="stack-end" aria-hidden="true" />
    </div>
  )
}

function Faq() {
  const [open, setOpen] = useState(0)

  return (
    <div className="faq-grid">
      <Reveal>
        <div className="section-head">
          <span className="eyebrow">FAQ</span>
          <h2 className="section-title">报名前，你可能想问</h2>
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <div>
          {FAQ.map((f, i) => (
            <div className={`qa ${open === i ? 'open' : ''}`} key={f.q}>
              <button
                type="button"
                className="qa-btn"
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? -1 : i)}
              >
                <span>{f.q}</span>
                <span className="qa-pm" aria-hidden="true" />
              </button>
              <div className="qa-ans">
                <div>
                  <p>{f.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  )
}

/* ============================================================
   Hero 入场动画
   ============================================================ */

const heroContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.12 } }
}

const heroItem: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }
}

/* ============================================================
   页面
   ============================================================ */

export default function Home() {
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()

  // 滚动时：右侧立方体淡出后退，左侧文案上移淡出
  const cubeOpacity = useTransform(scrollY, [0, 520], reduce ? [1, 1] : [1, 0.05])
  const cubeY = useTransform(scrollY, [0, 600], reduce ? [0, 0] : [0, -70])
  const copyY = useTransform(scrollY, [0, 600], reduce ? [0, 0] : [0, -46])
  const copyOpacity = useTransform(scrollY, [0, 440], reduce ? [1, 1] : [1, 0.04])

  return (
    <>
      {/* ---------- 1 · Hero：左文案 / 右 cube ---------- */}
      <section className="hero">
        <motion.div className="hero-canvas" style={{ opacity: cubeOpacity, y: cubeY }}>
          <CubeScene />
        </motion.div>
        <div className="hero-wash" />

        <div className="hero-copy-wrap">
          <motion.div
            className="hero-copy"
            variants={heroContainer}
            initial={reduce ? false : 'hidden'}
            animate="show"
            style={{ y: copyY, opacity: copyOpacity }}
          >
            <motion.span className="hero-eyebrow" variants={heroItem}>Computing United Builders</motion.span>
            <motion.h1 className="hero-title" variants={heroItem}>CUBE</motion.h1>
            <motion.p className="hero-title-zh" variants={heroItem}>计算机联合成长实验室</motion.p>
            <motion.p className="hero-desc" variants={heroItem}>
              面向大一新生的阶梯式科创培养平台：大二带大一的传帮带体系，
              零基础起步，保研、就业双赛道成长。
            </motion.p>
            <motion.div className="hero-actions" variants={heroItem}>
              <Link to="/apply" className="btn btn-primary">加入我们</Link>
              <a href="#about" className="btn">了解实验室</a>
            </motion.div>
            <motion.p className="hero-egg-hint" variants={heroItem}>
              <span className="egg-hint-dot" aria-hidden="true" />
              连点五下立方体，有小惊喜
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ---------- 2 · 技术栈跑马灯 ---------- */}
      <section className="stack-marquee">
        <div className="container">
          <Reveal>
            <p className="stack-label">我们在用的东西</p>
          </Reveal>
        </div>
        <Marquee />
      </section>

      {/* ---------- 3 · 滚动点亮的宣言 + 三条理念 ---------- */}
      <section className="statement-fill" id="about">
        <div className="container">
          <Reveal>
            <span className="eyebrow">Why we exist</span>
          </Reveal>

          <h2 className="fill-text">
            <FillLine>立方体的六个面，</FillLine>
            <FillLine>正如我们对技术的<span className="hl">多维探索</span>。</FillLine>
          </h2>

          <Reveal>
            <div className="statement-foot">
              <span className="line-mark" />
              零基础起步 · 梯队传帮带 · 保研就业双赛道
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="principle-grid">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.title} delay={0.08 * i} className="principle-cell">
                <div className="principle">
                  <HexBadge size={34}><span className="fig-text">{`0.${i + 1}`}</span></HexBadge>
                  <h3>{p.title}</h3>
                  <p>{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- 4 · 四大技术方向（bento） ---------- */}
      <section className="section section-alt" id="directions">
        <div className="container">
          <Reveal>
            <div className="section-head">
              <span className="eyebrow">Directions</span>
              <h2 className="section-title">四大方向，总有一个适合你</h2>
            </div>
          </Reveal>

          <div className="bento">
            {DIRECTIONS.map((d, i) => (
              <BentoCell key={d.title} dir={d} delay={0.06 * i} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------- 5 · 我们怎么做事（粘性堆叠卡） ---------- */}
      <section className="section" id="how">
        <div className="container">
          <Reveal>
            <div className="section-head">
              <span className="eyebrow">How we work</span>
              <h2 className="section-title">我们怎么做事</h2>
            </div>
          </Reveal>

          <StackCards />
        </div>
      </section>

      {/* ---------- 6 · 我们相信什么 ---------- */}
      <section className="section section-alt" id="belief">
        <div className="container">
          <Reveal>
            <div className="section-head">
              <span className="eyebrow">What we believe</span>
              <h2 className="section-title">我们相信什么</h2>
            </div>
          </Reveal>

          <div className="voices-grid">
            {BELIEFS.map((b, i) => (
              <Reveal key={b.text} delay={0.05 * i}>
                <blockquote className={`quote2 ${b.accent ? 'accent' : ''}`}>
                  <span className="mark" aria-hidden="true">“</span>
                  <p>{b.text}</p>
                  <footer>—— {b.label}</footer>
                </blockquote>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- 7 · 常见问题 ---------- */}
      <section className="section" id="faq">
        <div className="container">
          <Faq />
        </div>
      </section>

      {/* ---------- 8 · 招新 CTA ---------- */}
      <section className="cta-hero" id="join">
        <div className="container">
          <Reveal>
            <span className="eyebrow">Join</span>
            <h2>
              2026 秋季招新<br />
              <span className="title-glow">正在进行中</span>
            </h2>
            <p>
              面向所有计算机类相关专业的大一新生。不需要任何基础——大二组长手把手带教，
              从第一行代码到保研、就业双赛道，CUBE 陪你一起走。
            </p>
            <div className="cta-actions">
              <Link to="/apply" className="btn btn-primary">立即报名</Link>
              <a href="#about" className="btn">了解实验室</a>
            </div>
            {/* 招新实时战报：无投递 / 接口失败时组件自身不渲染，版式不受影响 */}
            <RecruitPulse />
          </Reveal>
        </div>
      </section>

      {/* ---------- 8.5 · 留言祝福墙（审核制） ---------- */}
      <WishWall />

      {/* ---------- 9 · 页脚 ---------- */}
      <footer className="footer">
        <div className="container">
          <HexDivider />
          <div className="footer-word" aria-hidden="true">CUBE</div>
          <div className="footer-legal">CUBE · Computing United Builders Lab · 计算机联合成长实验室</div>
        </div>
      </footer>
    </>
  )
}
