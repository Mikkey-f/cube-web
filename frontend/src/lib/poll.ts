/**
 * 可见性门控轮询。
 *
 * 目的：只在页面处于前台时按间隔拉数据。
 * - 切到后台 / 手机锁屏 / 换到别的 App ⇒ 停表，不再发请求（后台标签页的 setInterval
 *   会被浏览器降频到 1 分钟 1 次，但那是「变慢」不是「停止」，长期挂着依然在耗服务器配额和电量）
 * - 回到前台 ⇒ 立刻补拉一次，然后再恢复原节奏（比等下一个 tick 更「实时」，用户看到的还是最新数据）
 * - 上一趟还没回来就跳过这一趟，避免弱网下请求堆叠
 *
 * 对使用方完全透明：传入的任务做什么、多久一次都不变，只是「不该发的时候不发」。
 */
export function startVisiblePoll(
  task: () => void | Promise<unknown>,
  intervalMs: number
): () => void {
  let timer: ReturnType<typeof setInterval> | undefined
  let stopped = false
  let busy = false

  const run = () => {
    if (stopped || busy) return
    // 后台时连一次都不发：既省请求，也避免锁屏期间的网络唤醒
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return

    const result = task()
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      busy = true
      const done = () => {
        busy = false
      }
      ;(result as Promise<unknown>).then(done, done)
    }
  }

  const reschedule = () => {
    if (timer !== undefined) clearInterval(timer)
    timer = setInterval(run, intervalMs)
  }

  const onVisibilityChange = () => {
    if (stopped) return
    reschedule()
    // 刚回到前台：先补一趟，不用干等一个间隔
    if (document.visibilityState === 'visible') run()
  }

  reschedule()
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  return () => {
    stopped = true
    if (timer !== undefined) clearInterval(timer)
    timer = undefined
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }
}
