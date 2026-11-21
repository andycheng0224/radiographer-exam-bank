import { useState } from 'react'
import Button from './Button'
import { prepareOnTrackHandoff } from '../utils/onTrackHandoff'

const messages = {
  'consent-required': '請先確認同意。',
  'no-committed-receipt': '找不到這次交卷的完整紀錄，無法建立檔案。',
  'invalid-receipt': '這次交卷紀錄不完整或有衝突，無法建立檔案。',
  'no-answered-questions': '這次沒有已作答題目可匯出。',
}

export default function OnTrackHandoff({ sessionId }) {
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState('')
  if (!sessionId) return null

  function download() {
    try {
      const result = prepareOnTrackHandoff(sessionId, { consent })
      if (result.status !== 'ready') {
        setStatus(messages[result.status])
        return
      }
      const file = new Blob([JSON.stringify(result.bundle, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = 'ontrack-attempts-v1.json'
      document.body.appendChild(link)
      try { link.click() } finally {
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      setConsent(false)
      setStatus('已要求瀏覽器下載。檔案尚未送出，請在 OnTrack 確認匯入功能可用後手動匯入。')
    } catch {
      setStatus('無法建立下載，請確認瀏覽器允許下載後再試。')
    }
  }

  return (
    <details className="mt-5 rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer font-semibold">匯出本次作答至獨立 OnTrack</summary>
      <p className="mt-3">下載檔案包含題號、科目、作答時間、判分結果及已核可分類。原始作答和題目全文留在題庫。</p>
      <label className="my-3 flex items-start gap-2">
        <input type="checkbox" className="mt-1" checked={consent}
          onChange={(event) => { setConsent(event.target.checked); setStatus('') }} />
        我同意匯出本次作答資料
      </label>
      <Button type="button" variant="secondary" disabled={!consent} onClick={download}>下載作答 JSON</Button>
      {status && <p role="status" className="mt-3">{status}</p>}
    </details>
  )
}
