import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  /** 延迟（秒），用于同一区块内的错落节奏 */
  delay?: number
  /** 初始上移距离 */
  y?: number
  className?: string
}

/** 滚动进入视口时淡入 + 上移，只播一次 */
export default function Reveal({ children, delay = 0, y = 28, className }: RevealProps) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 1 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
