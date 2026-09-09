import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <main className="mx-auto max-w-xl p-8" role="alert">
      <h1 className="text-2xl font-bold">此頁暫時無法顯示</h1>
      <p className="my-4">已儲存的進度仍然保留。請重新載入頁面，或返回科目選擇繼續。</p>
      <button className="rounded-xl bg-blue-600 px-4 py-3 text-white" onClick={() => window.location.reload()}>重新載入</button>
      <a className="ml-4 underline" href="/radiographer">返回科目選擇</a>
    </main>
  }
}
