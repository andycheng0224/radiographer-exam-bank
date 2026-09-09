// Failed writes remain available for this tab; existing durable records are never evicted.
const pending = new Map()
const listeners = new Set()
let warning = ''
export function getStorageWarning() { return warning }
export function subscribeStorageWarning(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
function reportFailure() {
  const next = '瀏覽器無法儲存進度，目前變更暫存在此分頁。請下載進度備份，避免關閉或重新整理後遺失。'
  if (warning === next) return
  warning = next
  queueMicrotask(() => listeners.forEach((listener) => listener()))
}
export function readBrowserStorage(key) {
  if (pending.has(key)) return pending.get(key)
  try { return typeof window === 'undefined' ? null : window.localStorage.getItem(key) }
  catch { reportFailure(); return null }
}
export function writeBrowserStorage(key, value) {
  try {
    window.localStorage.setItem(key, value)
    pending.delete(key)
    return true
  } catch {
    pending.set(key, value)
    reportFailure()
    return false
  }
}
export function removeBrowserStorage(key) {
  try { window.localStorage.removeItem(key); pending.delete(key) }
  catch { pending.set(key, null); reportFailure() }
}
export function getBrowserStorageKeys() {
  let keys = []
  try { keys = Object.keys(window.localStorage) } catch { reportFailure() }
  return [...new Set([...keys, ...pending.keys()])].filter((key) => readBrowserStorage(key) !== null)
}
