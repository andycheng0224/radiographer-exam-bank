import { useSyncExternalStore } from 'react'
import { getStorageWarning, subscribeStorageWarning, getBrowserStorageKeys, readBrowserStorage } from '../utils/browserStorage'
import { getCurrentEffectiveUserId } from '../utils/storageUtils'

export function downloadProgressBackup() {
  const suffix = `__${getCurrentEffectiveUserId()}`
  const records = Object.fromEntries(getBrowserStorageKeys().filter((key) => key.endsWith(suffix))
    .map((key) => [key, readBrowserStorage(key)]))
  const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records }, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `radiographer-progress-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function StorageNotice() {
  const warning = useSyncExternalStore(subscribeStorageWarning, getStorageWarning, () => '')
  if (!warning) return null
  return <div role="alert" className="sticky top-0 z-[60] border-b border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
    {warning} <button type="button" className="underline font-bold" onClick={downloadProgressBackup}>下載進度備份</button>
  </div>
}
