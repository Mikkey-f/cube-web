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
import { HexBadge, HexDivider } from '../components/Hex'
import { DirectionArt, StepPanel } from '../components/MiniUI'

/* ============================================================
   内容数据
   注意：「我们怎么做事」「我们相信什么」「常见问题」三块是
   我按实验室口吻写的占位文案，正式上线前请换成真实的。
   ============================================================ */

/** 跑马灯用的技术栈 */
const STACK = [
  'React',
  'TypeScript',
  'Three.js',
  'Vite',
  'Spring Boot',
  'Java 17',
  'MySQL',
  'Docker',
  'Linux',
  'Git'
]

const PRINCIPLES = [
  {
    title: '真实项目',
    desc: '不做玩具 demo。从实验室官网到校内系统，每一行代码都面向真实用户和真实场景。'
  },
  {
    title: '共同成长',
    desc: '定期的技术分享、Code Review、结对编程。一个人的问题，一群人来解答。'
  },
  {
    title: '开放开源',
    desc: '拥抱开源社区，鼓励贡献上游。你的代码会被更多人看到、使用和认可。'
  }
]

type ArtKind = 'infra' | 'backend' | 'ai' | 'oss'

interface Direction {
  title: string
  desc: string
  tags: string[]
  art: ArtKind
  /** 6 栏网格里占几栏，做出 bento 的疏密节奏 */
  span: 4 | 2
}

const DIRECTIONS: Direction[] = [
  {
    title: '基础设施',
    desc: '服务器、部署与自动化。让每一次提交都能稳稳地跑起来、发出去，而不是靠某个人手动点一遍。',
    tags: ['Linux', 'Docker', 'CI/CD'],
    art: 'infra',
    span: 4
  },
  {
    title: '后端与系统',
    desc: '服务端架构、接口设计与性能优化，构建稳定可靠的服务。',
    tags: ['Java', 'Spring', 'MySQL'],
    art: 'backend',
    span: 2
  },
  {
    title: '人工智能',
    desc: '机器学习、大模型应用与智能体，探索 AI 真正能落地的场景。',
    tags: ['Python', 'LLM', 'Agent'],
    art: 'ai',
    span: 4
  },
  {
    title: '开源与协作',
    desc: '参与开源社区、贡献代码、评审协作，在真实的社区里成长。',
    tags: ['Git', 'GitHub', 'PR'],
    art: 'oss',
    span: 2
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
    title: '需求从真实场景来',
    desc: '不为了练手而练手。做出来的东西会真的被人用，所以从第一行代码起就要考虑后果。',
    checks: ['先把验收标准写清楚', '拆成可以并行的子任务'],
    panel: 'spec'
  },
  {
    title: '每周一次技术例会',
    desc: '有人讲、有人听、也有人当场拆台。讲不清楚的东西，通常是自己还没想透。',
    checks: ['轮流主讲，人人轮到', '卡住的问题现场拆'],
    panel: 'agenda'
  },
  {
    title: '代码进主分支前要过 Review',
    desc: '不合并看不懂的代码。评审里吵的每一句，都会变成你以后少踩的一个坑。',
    checks: ['至少一人评审通过', '小步提交，好读也好回滚'],
    panel: 'review'
  }
]

const BELIEFS = [
  { text: '写代码的人，应该对自己写出来的东西有要求。', label: '关于标准' },
  { text: '一个人的难题，摊到一群人面前，通常就是半小时的事。', label: '关于协作' },
  { text: '不追热点，追把一件事做透。', label: '关于节奏' },
  { text: '看不懂的代码不合并，哪怕它能跑。', label: '关于评审', accent: true },
  { text: '工具会过时，把问题讲清楚的能力不会。', label: '关于表达' },
  { text: '做出来的东西得有人用，否则不算完成。', label: '关于结果' }
]

const FAQ = [
  {
    q: '完全没有基础，可以报名吗？',
    a: '可以。我们更看重你愿不愿意学，而不是你现在会多少。很多成员都是零基础进来的，跟着真实项目边做边学。'
  },
  {
    q: '需要投入多少时间？',
    a: '每周大概两三个小时：一次例会，加上一点自己推进任务的时间。期末和考试周可以自由放缓，进度不催人。'
  },
  {
    q: '报名之后是什么流程？',
    a: '提交报名表后，我们会在两周内联系你，约一次轻松的线上聊，主要了解你的兴趣和想法，不是考试。'
  },
  {
    q: '一定要会写代码才能加入吗？',
    a: '不必。设计、文档、测试、运维这些方向同样重要。先选一个你感兴趣的方向，其他的可以慢慢补。'
  },
  {
    q: '只有计算机专业的同学能加入吗？',
    a: '不限专业。实验室里什么专业的人都有，跨专业的视角反而常常是优势。'
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
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.style.setProperty('--x', `${e.clientX - r.left}px`)
    el.style.setProperty('--y', `${e.clientY - r.top}px`)
  }

  return (
    <Reveal delay={delay} className={`span${dir.span}`}>
      <div className="bcell" onPointerMove={onMove}>
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

/** 容器已滚过的比例：0 = 容器顶刚贴到视口顶，1 = 容器底贴到视口底 */
function stackProgress(el: HTMLDivElement | null, v: number) {
  if (!el) return 0
  const top = el.getBoundingClientRect().top + window.scrollY
  const range = Math.max(1, el.offsetHeight - window.innerHeight)
  return clamp01((v - top) / range)
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
  const start = i / total
  const end = (i + 1) / total
  const scale = useMotionValue(1)
  const dim = useMotionValue(1)

  // 直接监听 window 滚动，往 MotionValue 里写（不触发 React 重渲染）。
  // 刻意不用 target 版 useScroll：实测在含 sticky 子元素的容器上拿不到进度。
  useEffect(() => {
    if (reduce) return
    const apply = (v: number) => {
      const el = container.current
      const p = stackProgress(el, v)
      const t = clamp01((p - start) / (end - start))
      scale.set(1 - 0.06 * t)
      dim.set(1 - 0.5 * t)
    }
    apply(window.scrollY)
    const onScroll = () => apply(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [reduce, container, start, end, scale, dim, i])

  return (
    <motion.div className="stack-block" style={reduce ? undefined : { scale, opacity: dim }}>
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
              一群热爱技术的年轻人聚在一起，做真实的项目，写认真的代码，
              在协作与开源中共同成长。
            </motion.p>
            <motion.div className="hero-actions" variants={heroItem}>
              <Link to="/apply" className="btn btn-primary">加入我们</Link>
              <a href="#about" className="btn">了解实验室</a>
            </motion.div>
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
              真实项目 · 共同成长 · 开放开源
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
              不管你是零基础的小白，还是已经有项目经验的老手，只要热爱技术，CUBE 都欢迎你的加入。
            </p>
            <div className="cta-actions">
              <Link to="/apply" className="btn btn-primary">立即报名</Link>
              <a href="#about" className="btn">了解实验室</a>
            </div>
          </Reveal>
        </div>
      </section>

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
