import { getCurrentEffectiveUserId } from './storageUtils.js'
// One origin-wide lock per user: all read/modify/write progress operations share it.
// No localStorage spinlock: it cannot provide mutual exclusion between tabs.
export async function withProgressLock(operation, { timeoutMs = 10000, locks = globalThis.navigator?.locks } = {}) {
  if (!locks?.request) throw new Error('目前瀏覽器無法協調跨分頁儲存；答案仍留在本頁，請用支援 Web Locks 的瀏覽器重試。')
  const user = getCurrentEffectiveUserId()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await locks.request(`radiographer:progress:v1:${user}`, { mode:'exclusive', signal:controller.signal }, () => {
      clearTimeout(timer)
      if (getCurrentEffectiveUserId() !== user) throw new Error('使用者已切換，未寫入其他人的進度；請重新開啟題目。')
      return operation()
    })
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('另一分頁正在儲存，尚未取得交卷鎖；答案仍保留，請稍後重試。')
    throw error
  } finally { clearTimeout(timer) }
}
