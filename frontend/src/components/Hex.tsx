import type { ReactNode } from 'react'

/**
 * 六边形视觉体系：把 logo 的六边形轮廓抽出来，做成图标框与分隔符，
 * 让整个站点有一致的识别度。
 */

interface HexBadgeProps {
  children: ReactNode
  /** 六边形宽度，高度自动按 1.12 比例 */
  size?: number
  className?: string
}

export function HexBadge({ children, size = 54, className = '' }: HexBadgeProps) {
  return (
    <div className={`hex-badge ${className}`} style={{ width: size, height: Math.round(size * 1.12) }}>
      <div className="hex-badge-inner">{children}</div>
    </div>
  )
}

/** 区块标题下方的六边形分隔符 */
export function HexDivider() {
  return (
    <div className="hex-divider" aria-hidden="true">
      <span className="hex-line" />
      <span className="hex-dot sm" />
      <span className="hex-dot" />
      <span className="hex-dot sm" />
      <span className="hex-line" />
    </div>
  )
}
