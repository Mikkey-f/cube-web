import { useEffect } from 'react'
import Lenis from 'lenis'

/** 全站平滑滚动（Lenis）。系统开启"减少动态效果"时自动跳过。 */
export default function SmoothScroll() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true
    })

    let raf = 0
    const loop = (time: number) => {
      lenis.raf(time)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    // 页面内锚点（例如"了解实验室"）也走平滑滚动
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      const link = target?.closest?.('a[href^="#"]') as HTMLAnchorElement | null
      if (!link) return
      const id = (link.getAttribute('href') || '').slice(1)
      const section = id ? document.getElementById(id) : null
      if (section) {
        e.preventDefault()
        lenis.scrollTo(section, { offset: -56 })
      }
    }
    document.addEventListener('click', onClick)

    return () => {
      document.removeEventListener('click', onClick)
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [])

  return null
}
