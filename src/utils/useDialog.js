import { useEffect, useRef } from 'react'

export default function useDialog(open, onClose) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusable = () => [...(ref.current?.querySelectorAll('button:not(:disabled),a[href],select,input,[tabindex="0"]') || [])]
    focusable()[0]?.focus()
    const keyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current() }
      if (event.key !== 'Tab') return
      const items = focusable()
      const first = items[0], last = items.at(-1)
      if (!items.length) { event.preventDefault(); return }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keyDown)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', keyDown)
      if (previous?.isConnected) previous.focus()
    }
  }, [open])
  return ref
}
