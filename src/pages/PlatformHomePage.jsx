import { Link } from 'react-router-dom'
import SideMenu from '../components/SideMenu'
import ThemeToggle from '../components/ThemeToggle'
import SeoMeta from '../components/SeoMeta'
export default function PlatformHomePage() {
  return <main className="min-h-screen px-4 py-8 md:px-6"><div className="mx-auto max-w-5xl space-y-8">
    <header className="flex items-center justify-between"><SideMenu /><ThemeToggle compact /></header>
    <SeoMeta title="放射師國考題庫" description="選一份歷屆試卷，或搜尋單元題目開始練習。" canonicalPath="/" />
    <section className="py-6"><p className="mb-3 font-semibold text-blue-700">放射師國考題庫</p><h1 className="text-4xl font-black text-slate-950 md:text-5xl">今天，從哪裡開始？</h1><p className="mt-5 text-lg text-slate-600">做一份試卷，或練習一個單元。</p></section>
    <div className="grid gap-5 md:grid-cols-2">
      <Link to="/practice?mode=paper" className="rounded-2xl bg-slate-900 p-8 text-white"><h2 className="text-2xl font-bold">整份試卷 →</h2><p className="mt-4 text-lg">選年份、梯次與科目，按原題號倒數作答。</p></Link>
      <Link to="/practice?mode=practice" className="rounded-2xl border border-slate-300 bg-white p-8 text-slate-950"><h2 className="text-2xl font-bold">單元練習 →</h2><p className="mt-4 text-lg text-slate-600">用關鍵字與年份範圍，練習全部符合題目。</p></Link>
    </div>
    <nav aria-label="複習工具" className="flex flex-wrap gap-6 text-base font-semibold text-slate-700"><Link to="/wrong-review">錯題複習</Link><Link to="/bookmarks">收藏題</Link><Link to="/uncertain">猶豫題</Link><Link to="/growth">學習紀錄</Link><Link to="/study">查看學習建議</Link><Link to="/sources">來源查核</Link><Link to="/settings">設定</Link></nav>
  </div></main>
}
