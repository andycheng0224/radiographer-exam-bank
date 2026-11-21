import {useState} from 'react'
import {Link} from 'react-router-dom'
import catalog from '../data/evidenceCatalog'
import {createEvidenceAssistant} from '../utils/evidenceAssistant'
const assistant=createEvidenceAssistant({catalog})
export default function SourceSearchPage(){
  const [query,setQuery]=useState(''),[yearFrom,setYearFrom]=useState('100'),[yearTo,setYearTo]=useState('115'),[result,setResult]=useState(null)
  async function search(event){event.preventDefault();setResult(await assistant.search(query,{yearFrom,yearTo}))}
  return <main className="mx-auto max-w-3xl px-4 py-8 text-slate-900"><Link to="/" className="text-blue-700">← 回首頁</Link><h1 className="mt-7 text-3xl font-bold">來源查核</h1>
    <p className="mt-4 text-lg">查找已對照來源的解題摘要與頁碼。</p><p className="mt-2 text-slate-600">目前僅收錄 {catalog.length} 則有限範圍查核，尚非專家審核，也不代表整個題庫已驗證。本頁使用本機文字檢索，未啟用模型生成。</p>
    <form onSubmit={search} className="my-7 space-y-4"><label className="block font-semibold">關鍵字<input required maxLength={200} value={query} onChange={event=>setQuery(event.target.value)} placeholder="例如 TG-43、SSD、雜訊" className="mt-2 block w-full rounded-lg border p-3" /></label>
      <div className="flex flex-wrap items-end gap-4"><label>起年<input aria-label="起年" type="number" min="100" max="115" value={yearFrom} onChange={event=>setYearFrom(event.target.value)} className="ml-2 w-24 rounded border p-2" /></label><label>迄年<input aria-label="迄年" type="number" min={yearFrom} max="115" value={yearTo} onChange={event=>setYearTo(event.target.value)} className="ml-2 w-24 rounded border p-2" /></label><button className="rounded-lg bg-slate-900 px-5 py-3 text-white">搜尋來源</button></div>
    </form>
    <div aria-live="polite">{result?.status==='no-evidence'&&<p className="rounded border p-4">目前範圍沒有可引用的摘要。請調整關鍵字或年份；不會用未查核詳解補出答案。</p>}{result?.evidence.map(item=><article key={item.id} className="border-t py-6"><h2 className="text-xl font-bold">{item.title}</h2><p className="mt-2 text-slate-600">{item.year} 年 · {item.subject}</p><p className="mt-4 whitespace-pre-line leading-7">{item.text}</p><p className="mt-4 text-amber-900">查核範圍：{item.scope}</p><p className="mt-2">{item.sourceCitation}，頁 {item.page}</p><div className="mt-3 flex flex-wrap gap-5"><a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline">開啟來源</a><Link state={{from:"sources"}} to={`/questions/${encodeURIComponent(item.questionId)}`} className="text-blue-700 underline">查看題目</Link></div></article>)}</div>
  </main>
}
