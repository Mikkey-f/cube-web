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

/* ---------- 基础设施：构建 → 部署 流水线 + 负载条 ---------- */
function InfraArt() {
  const nodes = [
    { x: 70, label: '提交' },
    { x: 160, label: '构建' },
    { x: 250, label: '测试' },
    { x: 340, label: '部署' }
  ]
  const bars = [
    { w: 224, c: BLUE_SOFT },
    { w: 168, c: 'rgba(255,255,255,0.16)' },
    { w: 112, c: 'rgba(34,211,238,0.5)' }
  ]
  return (
    <svg className="art-svg" viewBox="0 0 400 150" fill="none" aria-hidden="true">
      {/* 连接线 */}
      {nodes.slice(0, -1).map((n, i) => (
        <path key={i} d={`M${n.x + 15} 52 H${nodes[i + 1].x - 15}`} stroke={LINE} strokeWidth="1.4" />
      ))}
      {/* 节点 */}
      {nodes.map((n, i) => (
        <g key={n.label}>
          <circle cx={n.x} cy={52} r={13} fill="#0e1013" stroke={i === 3 ? BLUE : LINE} strokeWidth="1.3" />
          {i === 3 ? (
            <path d={`M${n.x - 5} 52 l3.4 3.4 L${n.x + 5.6} 46`} stroke={CYAN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <circle cx={n.x} cy={52} r={3.4} fill={i === 0 ? BLUE : 'rgba(255,255,255,0.35)'} />
          )}
          <text x={n.x} y={84} textAnchor="middle" fill="rgba(255,255,255,0.62)"
            style={{ font: '500 11px var(--font-display, sans-serif)' }}>{n.label}</text>
        </g>
      ))}
      {/* 沿流水线推进的包 */}
      <circle r="3.2" fill={CYAN}>
        <animateMotion dur="3.2s" repeatCount="indefinite" path="M70 52 H340" />
      </circle>
      {/* 负载条 */}
      {bars.map((b, i) => (
        <rect key={i} x={88} y={101 + i * 15} width={b.w} height="6" rx="3" fill={b.c} />
      ))}
    </svg>
  )
}

/* ---------- 后端与系统：服务节点图 ---------- */
function BackendArt() {
  return (
    <svg className="art-svg" viewBox="0 0 400 150" fill="none" aria-hidden="true">
      <rect x="166" y="52" width="68" height="46" rx="9" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
      <rect x="88" y="20" width="52" height="34" rx="8" stroke="rgba(255,255,255,0.11)" strokeWidth="1" />
      <rect x="260" y="20" width="52" height="34" rx="8" stroke="rgba(255,255,255,0.11)" strokeWidth="1" />
      <rect x="88" y="96" width="52" height="34" rx="8" stroke="rgba(255,255,255,0.11)" strokeWidth="1" />
      <rect x="260" y="96" width="52" height="34" rx="8" stroke="rgba(255,255,255,0.11)" strokeWidth="1" />
      <path d="M140 37 L166 75 M260 37 L234 75 M140 113 L166 75 M260 113 L234 75"
        stroke={BLUE_SOFT} strokeWidth="1" />
      <circle cx="200" cy="75" r="5" fill={BLUE} />
      <circle cx="114" cy="37" r="2.5" fill="rgba(255,255,255,0.35)" />
      <circle cx="286" cy="113" r="2.5" fill={CYAN} />
      <circle r="2.6" fill={CYAN}>
        <animateMotion dur="2.8s" repeatCount="indefinite" path="M114 37 L166 75 L234 75 L286 113" />
      </circle>
    </svg>
  )
}

/* ---------- 人工智能：分层网络 ---------- */
function AiArt() {
  const layers = [
    { x: 116, ys: [36, 75, 114] },
    { x: 200, ys: [24, 58, 92, 126] },
    { x: 284, ys: [36, 75, 114] }
  ]
  const edges: string[] = []
  for (let i = 0; i < layers.length - 1; i++) {
    for (const y1 of layers[i].ys) {
      for (const y2 of layers[i + 1].ys) edges.push(`M${layers[i].x} ${y1} L${layers[i + 1].x} ${y2}`)
    }
  }
  return (
    <svg className="art-svg" viewBox="0 0 400 150" fill="none" aria-hidden="true">
      {edges.map((d, i) => (
        <path key={i} d={d} stroke="rgba(143,180,255,0.16)" strokeWidth="1" />
      ))}
      {layers.map((l, li) =>
        l.ys.map((y, yi) => {
          const active = li === 1 && yi === 1
          return active ? (
            <circle key={`${li}-${yi}`} cx={l.x} cy={y} r="6" fill={CYAN} />
          ) : (
            <circle key={`${li}-${yi}`} cx={l.x} cy={y} r="5.5"
              fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
          )
        })
      )}
    </svg>
  )
}

/* ---------- 开源与协作：分支 / 合并图 ---------- */
function OssArt() {
  return (
    <svg className="art-svg" viewBox="0 0 400 150" fill="none" aria-hidden="true">
      <path d="M70 75 H330" stroke="rgba(255,255,255,0.14)" strokeWidth="1.4" />
      <path d="M150 75 C180 75 180 108 210 108 H240 C270 108 270 75 300 75"
        stroke={BLUE_SOFT} strokeWidth="1.4" />
      <circle cx="70" cy="75" r="5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
      <circle cx="150" cy="75" r="6" fill={BLUE} />
      <circle cx="210" cy="108" r="5" stroke="rgba(143,180,255,0.7)" strokeWidth="1.2" />
      <circle cx="240" cy="108" r="5" stroke="rgba(143,180,255,0.7)" strokeWidth="1.2" />
      <circle cx="300" cy="75" r="6" fill={CYAN} />
      <circle cx="330" cy="75" r="5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
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

/* 需求面板：像一张真实的需求卡 */
function SpecPanel() {
  return (
    <div className="panel-ui">
      <PanelBar title="issue · #12" />
      <div className="panel-body">
        <div className="spec-head">
          <span className="spec-tag">需求</span>
          <b>校园门户重构</b>
        </div>
        <p className="spec-desc">把旧的静态页面换成可维护的前后端分离结构，先做报名入口。</p>
        <ul className="spec-list">
          <li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d={CHECK} /></svg>明确验收标准</li>
          <li><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d={CHECK} /></svg>拆成可并行的子任务</li>
          <li className="todo"><span className="dot" />接口先对齐，再动手写界面</li>
        </ul>
      </div>
    </div>
  )
}

/* 例会面板：一份议程 */
function AgendaPanel() {
  const rows = [
    ['20:00', '上周进度同步'],
    ['20:20', 'React 并发渲染 — 分享'],
    ['20:50', '卡住的问题，现场拆']
  ]
  return (
    <div className="panel-ui">
      <PanelBar title="weekly · 例会" />
      <div className="panel-body">
        {rows.map(([t, s], i) => (
          <div className="agenda-row" key={t}>
            <span className="agenda-time">{t}</span>
            <span className="agenda-dot" data-i={i} />
            <span className="agenda-topic">{s}</span>
          </div>
        ))}
        <div className="agenda-foot">
          <span className="live" />本周第 14 次 · 全员
        </div>
      </div>
    </div>
  )
}

/* Review 面板：一段 diff + 一条评论 */
function ReviewPanel() {
  const lines = [
    { t: 'ctx', s: 'async function load(id) {' },
    { t: 'del', s: '-  const res = await fetch(url)' },
    { t: 'add', s: '+  const res = await api.get(`/items/${id}`)' },
    { t: 'ctx', s: '   return res.data' },
    { t: 'ctx', s: '}' }
  ]
  return (
    <div className="panel-ui">
      <PanelBar title="pull request · #48" />
      <div className="panel-body">
        <pre className="diff">
          {lines.map((l, i) => (
            <span key={i} className={`diff-line ${l.t}`}>{l.s}</span>
          ))}
        </pre>
        <div className="review-note">
          <span className="review-av" />
          <p>这里统一走 <code>api</code> 实例，鉴权头就自动带上了 —— 已合并。</p>
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
