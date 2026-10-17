/**
 * 迷你界面组件：方向卡片里的抽象视觉，以及「我们怎么做事」卡片中的深色面板。
 * 全部是内联 SVG / HTML，不依赖图片，强调色统一走项目的蓝 + 青。
 */

type ArtKind = 'infra' | 'backend' | 'ai' | 'oss'

const LINE = 'rgba(255,255,255,0.12)'
const LINE_SOFT = 'rgba(255,255,255,0.08)'
const BLUE = '#8fb4ff'
const BLUE_SOFT = 'rgba(143,180,255,0.45)'
const CYAN = '#22d3ee'

/* ---------- 基础与算法：排序柱（swap 交换动画，最右为「已就位」的完成态） ---------- */
function InfraArt() {
  // 底边 y=122；[x, 高]，最右一根是排序完成的目标态（青色发光）
  const bars = [
    { x: 90, h: 46 },
    { x: 130, h: 88 },
    { x: 170, h: 34 },
    { x: 210, h: 66 },
    { x: 250, h: 52 }
  ]
  const BASE = 122
  return (
    <svg className="art-svg" viewBox="0 0 400 150" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="fnd-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={BLUE} />
          <stop offset="1" stopColor="rgba(143,180,255,0.18)" />
        </linearGradient>
      </defs>
      {/* 基线 */}
      <line x1="66" y1={BASE + 1} x2="334" y2={BASE + 1} stroke={LINE} strokeWidth="1.2" />
      {bars.map((b, i) => {
        const target = i === bars.length - 1
        return (
          <rect key={i}
            x={b.x} width="22" rx="4"
            y={BASE - b.h} height={b.h}
            fill={target ? CYAN : 'url(#fnd-bar)'}
            opacity={target ? 0.9 : 0.85}
          >
            {i === 1 && (
              <animateTransform attributeName="transform" type="translate"
                values="0 0; 40 0; 40 0; 0 0" keyTimes="0;0.35;0.55;1"
                dur="3.6s" repeatCount="indefinite" />
            )}
            {i === 2 && (
              <animateTransform attributeName="transform" type="translate"
                values="0 0; -40 0; -40 0; 0 0" keyTimes="0;0.35;0.55;1"
                dur="3.6s" repeatCount="indefinite" />
            )}
          </rect>
        )
      })}
      {/* 扫描线：从左到右掠过，像一次「遍历」 */}
      <line y1="34" y2={BASE} stroke={CYAN} strokeWidth="1.2" opacity="0.5">
        <animate attributeName="x1" values="70;330" dur="3.6s" repeatCount="indefinite" />
        <animate attributeName="x2" values="70;330" dur="3.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0.5;0" dur="3.6s" repeatCount="indefinite" />
      </line>
      {/* 目标态呼吸光 */}
      <rect x="250" y={BASE - 88} width="22" height="88" rx="4" fill="none" stroke={CYAN} strokeWidth="1" opacity="0.4">
        <animate attributeName="opacity" values="0.15;0.55;0.15" dur="2.2s" repeatCount="indefinite" />
      </rect>
    </svg>
  )
}

/* ---------- 后端与系统：一条请求的旅程（客户端 → 服务 → 数据库，响应沿弧线返回） ---------- */
function BackendArt() {
  return (
    <svg className="art-svg" viewBox="0 0 400 150" fill="none" aria-hidden="true">
      {/* 客户端：小窗 */}
      <rect x="58" y="55" width="62" height="40" rx="8" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
      <circle cx="70" cy="65" r="2" fill="rgba(255,255,255,0.35)" />
      <circle cx="78" cy="65" r="2" fill="rgba(255,255,255,0.2)" />
      <line x1="66" y1="76" x2="104" y2="76" stroke={LINE} strokeWidth="1.2" />
      <line x1="66" y1="84" x2="92" y2="84" stroke={LINE_SOFT} strokeWidth="1.2" />
      {/* 服务：机柜式，三条层纹 */}
      <rect x="168" y="38" width="72" height="74" rx="10" stroke={BLUE_SOFT} strokeWidth="1.2" />
      <line x1="178" y1="56" x2="230" y2="56" stroke={LINE} strokeWidth="1.2" />
      <line x1="178" y1="75" x2="230" y2="75" stroke={LINE} strokeWidth="1.2" />
      <line x1="178" y1="94" x2="230" y2="94" stroke={LINE} strokeWidth="1.2" />
      <circle cx="204" cy="75" r="4.5" fill={BLUE} />
      {/* 数据库：圆柱 */}
      <g stroke={CYAN} strokeWidth="1.2" opacity="0.85">
        <ellipse cx="316" cy="58" rx="20" ry="7" />
        <path d="M296 58 V92 a20 7 0 0 0 40 0 V58" />
        <path d="M296 75 a20 7 0 0 0 40 0" stroke={LINE_SOFT} />
      </g>
      {/* 请求链路（实线）与响应链路（上方弧线，虚线） */}
      <path d="M120 75 H168" stroke={LINE} strokeWidth="1.3" />
      <path d="M240 75 H294" stroke={LINE} strokeWidth="1.3" />
      <path d="M172 34 C146 16 112 18 92 50" stroke={LINE_SOFT} strokeWidth="1.1" strokeDasharray="3 5" />
      {/* 请求粒子：客户端 → 服务 */}
      <circle r="2.8" fill={BLUE}>
        <animateMotion dur="1.6s" repeatCount="indefinite" path="M120 75 H166" />
      </circle>
      {/* 服务 → 数据库，接续在半个周期后 */}
      <circle r="2.8" fill={CYAN}>
        <animateMotion dur="1.2s" begin="0.8s" repeatCount="indefinite" path="M240 75 H292" />
      </circle>
      {/* 响应粒子：服务 → 客户端，走上方虚线弧 */}
      <circle r="2.4" fill="rgba(255,255,255,0.75)">
        <animateMotion dur="1.8s" begin="1.4s" repeatCount="indefinite" path="M172 34 C146 16 112 18 92 50" />
      </circle>
    </svg>
  )
}

/* ---------- 人工智能：背景虚化神经网络（课程地基）+ 前景 Agent 工具循环 ---------- */
function AiArt() {
  // 背景：右侧一片低透明度的神经网络，呼应 CS224n
  const netNodes = [
    { x: 300, y: 30 }, { x: 330, y: 62 }, { x: 296, y: 96 }, { x: 336, y: 122 }, { x: 268, y: 60 }
  ]
  const netEdges = [
    [0, 1], [0, 4], [1, 2], [1, 3], [2, 4], [3, 4]
  ]
  // 前景：Agent 核心周围三个工具节点（读代码 / 查文档 / 写脚本）
  const tools = [
    { cx: 138, cy: 42, glyph: 'code' },
    { cx: 130, cy: 104, glyph: 'doc' },
    { cx: 196, cy: 124, glyph: 'term' }
  ]
  return (
    <svg className="art-svg" viewBox="0 0 400 150" fill="none" aria-hidden="true">
      {/* 背景神经网络：低透明度，退到第二层 */}
      <g opacity="0.32">
        {netEdges.map(([a, b], i) => (
          <line key={i} x1={netNodes[a].x} y1={netNodes[a].y} x2={netNodes[b].x} y2={netNodes[b].y}
            stroke={BLUE_SOFT} strokeWidth="0.8" />
        ))}
        {netNodes.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r="3" fill="rgba(143,180,255,0.3)" />
        ))}
      </g>
      {/* 轨道：虚线圆 + 一段旋转的高亮弧（Agent 的感知→行动循环） */}
      <circle cx="200" cy="75" r="52" stroke={LINE_SOFT} strokeWidth="1" strokeDasharray="2 6" />
      <g>
        <circle r="42" cx="200" cy="75" fill="none" stroke={CYAN} strokeWidth="1.4"
          strokeDasharray="30 234" strokeLinecap="round" opacity="0.75" />
        <animateTransform attributeName="transform" type="rotate" from="0 200 75" to="360 200 75"
          dur="9s" repeatCount="indefinite" />
      </g>
      {/* Agent 核心：发光小方块 */}
      <rect x="182" y="57" width="36" height="36" rx="9" fill="rgba(34,211,238,0.08)" stroke={CYAN} strokeWidth="1.3" />
      <circle cx="200" cy="75" r="4" fill={CYAN}>
        <animate attributeName="opacity" values="1;0.45;1" dur="2.4s" repeatCount="indefinite" />
      </circle>
      {/* 三个工具节点 */}
      {tools.map((t) => (
        <g key={t.glyph}>
          <circle cx={t.cx} cy={t.cy} r="13" fill="#0e1013" stroke={BLUE_SOFT} strokeWidth="1.2" />
          {t.glyph === 'code' && (
            <path d="M133 42 l-4 4 4 4 M143 42 l4 4 -4 4" stroke={BLUE} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {t.glyph === 'doc' && (
            <g stroke={BLUE} strokeWidth="1.3" strokeLinecap="round">
              <rect x="125" y="98" width="10" height="12" rx="1.5" />
              <line x1="128" y1="102" x2="132" y2="102" />
              <line x1="128" y1="106" x2="132" y2="106" />
            </g>
          )}
          {t.glyph === 'term' && (
            <g stroke={BLUE} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M190 119 l4 4 -4 4" />
              <line x1="197" y1="127" x2="203" y2="127" />
            </g>
          )}
        </g>
      ))}
      {/* 循环粒子：沿轨道把三个工具节点串起来 */}
      <circle r="2.6" fill={CYAN}>
        <animateMotion dur="9s" repeatCount="indefinite" path="M200 23 a52 52 0 1 1 -0.1 0" />
      </circle>
    </svg>
  )
}

/* ---------- 开源与履历：GitHub 贡献格子墙 + main 分支提交流 ---------- */
function OssArt() {
  const CELL = 11
  const PITCH = 14
  const X0 = 92
  const Y0 = 26
  // 13 列 × 5 行的确定性「提交密度」：0 暗 / 1 微亮 / 2 蓝
  const rows = [
    '0102010010201',
    '1020011200100',
    '0210130012100',
    '1001200110012',
    '0120010010210'
  ]
  const levelFill = ['rgba(255,255,255,0.05)', 'rgba(143,180,255,0.18)', 'rgba(143,180,255,0.45)']
  const ACTIVE_COL = 12
  const ACTIVE_ROW = 2
  return (
    <svg className="art-svg" viewBox="0 0 400 150" fill="none" aria-hidden="true">
      {rows.map((row, r) =>
        row.split('').map((lv, c) => {
          if (r === ACTIVE_ROW && c === ACTIVE_COL) return null // 活跃格单独画（带动画）
          return (
            <rect key={`${r}-${c}`} x={X0 + c * PITCH} y={Y0 + r * PITCH}
              width={CELL} height={CELL} rx="2.5" fill={levelFill[Number(lv)]} />
          )
        })
      )}
      {/* 最新提交：最右列中间格，周期性点亮 */}
      <rect x={X0 + ACTIVE_COL * PITCH} y={Y0 + ACTIVE_ROW * PITCH}
        width={CELL} height={CELL} rx="2.5" fill={CYAN}>
        <animate attributeName="opacity" values="0.25;1;0.25" dur="2.8s" repeatCount="indefinite" />
      </rect>
      {/* main 分支线：本地 → 远端，粒子持续滑入 */}
      <line x1="52" y1="122" x2="348" y2="122" stroke={LINE} strokeWidth="1.3" />
      <circle cx="52" cy="122" r="4" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
      <circle cx="130" cy="122" r="3.2" fill={BLUE_SOFT} />
      <circle cx="348" cy="122" r="4.5" fill="none" stroke={CYAN} strokeWidth="1.2" />
      <circle r="2.8" fill={CYAN}>
        <animateMotion dur="3.4s" repeatCount="indefinite" path="M52 122 H344" />
      </circle>
    </svg>
  )
}

export function DirectionArt({ kind }: { kind: ArtKind }) {
  if (kind === 'infra') return <InfraArt />
  if (kind === 'backend') return <BackendArt />
  if (kind === 'ai') return <AiArt />
  return <OssArt />
}

/* ============================================================
   「我们怎么做事」卡片里的深色面板
   ============================================================ */

type StepKind = 'spec' | 'agenda' | 'review'

const CHECK =
  'M3 8.5 6.5 12 13 4.5'

function PanelBar({ title }: { title: string }) {
  return (
    <div className="panel-bar">
      <i /><i /><i />
      <span className="panel-title">{title}</span>
    </div>
  )
}

/* 培养计划面板：像一份真实的阶段计划卡 */
function SpecPanel() {
  return (
    <div className="panel-ui">
      <PanelBar title="plan · 大一上" />
      <div className="panel-body">
        <div className="spec-head">
          <span className="spec-tag">培养计划</span>
          <b>打地基 · 养成习惯</b>
        </div>
        <p className="spec-desc">不追求学得多，追求每周都在动。</p>
        <ul className="spec-list">
          <li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d={CHECK} /></svg>C 语言速通</li>
          <li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d={CHECK} /></svg>每天一道算法题</li>
          <li className="todo"><span className="dot" />Python 起步 · Git 建档</li>
        </ul>
      </div>
    </div>
  )
}

/* 周会面板：一份议程 */
function AgendaPanel() {
  const rows = [
    ['20:00', '本周学了什么'],
    ['20:20', '任务完成情况'],
    ['20:50', '问题 · 下周计划']
  ]
  return (
    <div className="panel-ui">
      <PanelBar title="weekly · 周会" />
      <div className="panel-body">
        {rows.map(([t, s], i) => (
          <div className="agenda-row" key={t}>
            <span className="agenda-time">{t}</span>
            <span className="agenda-dot" data-i={i} />
            <span className="agenda-topic">{s}</span>
          </div>
        ))}
        <div className="agenda-foot">
          <span className="live" />线下 · 每周一次
        </div>
      </div>
    </div>
  )
}

/* GitHub 档案面板：提交记录 + 月度考核批注 */
function ReviewPanel() {
  const lines = [
    { t: 'ctx', s: 'a3f2e1c  题解 · 两数之和' },
    { t: 'add', s: '+ 8d91b07  笔记 · 指针与内存' },
    { t: 'add', s: '+ 5c44af9  project · 贪吃蛇 v0.2' },
    { t: 'ctx', s: '2b90e14  fix · 修复输入死循环' },
    { t: 'ctx', s: 'f1a0c93  docs · 本周学习总结' }
  ]
  return (
    <div className="panel-ui">
      <PanelBar title="github · 学习档案" />
      <div className="panel-body">
        <pre className="diff">
          {lines.map((l, i) => (
            <span key={i} className={`diff-line ${l.t}`}>{l.s}</span>
          ))}
        </pre>
        <div className="review-note">
          <span className="review-av" />
          <p>月度考核：<b>正常推进</b> —— 组长批注：保持节奏，稳定成长。</p>
        </div>
      </div>
    </div>
  )
}

export function StepPanel({ kind }: { kind: StepKind }) {
  if (kind === 'spec') return <SpecPanel />
  if (kind === 'agenda') return <AgendaPanel />
  return <ReviewPanel />
}
