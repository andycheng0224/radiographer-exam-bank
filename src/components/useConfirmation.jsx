import { useEffect, useId, useRef, useState } from 'react'
import useDialog from '../utils/useDialog'

export default function useConfirmation() {
  const [request, setRequest] = useState(null)
  const resolver = useRef(null)
  const titleId = useId()
  const descriptionId = useId()
  const settle = (accepted) => {
    const resolve = resolver.current
    resolver.current = null
    setRequest(null)
    resolve?.(accepted)
  }
  const dialogRef = useDialog(Boolean(request), () => settle(false))
  useEffect(() => () => { resolver.current?.(false); resolver.current = null }, [])
  const confirm = (message, title = '確認操作', confirmLabel = '確認') => new Promise((resolve) => {
    resolver.current?.(false)
    resolver.current = resolve
    setRequest({ message, title, confirmLabel })
  })
  const dialog = request && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}
      className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
      <h2 id={titleId} className="text-xl font-bold text-slate-900">{request.title}</h2>
      <p id={descriptionId} className="mt-4 whitespace-pre-line leading-relaxed text-slate-700">{request.message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700" onClick={() => settle(false)}>取消</button>
        <button type="button" className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white" onClick={() => settle(true)}>{request.confirmLabel}</button>
      </div>
    </section>
  </div>
  return [confirm, dialog]
}
