import {useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {getUncertainQuestionIds,getLatestSubmittedAnswer} from '../utils/storageUtils'
import {loadQuestionsByKeys} from '../utils/questionDataLoader'
import QuestionContent,{QuestionRichText} from '../components/QuestionContent'
import {formatQuestionMetadata} from '../utils/subjectUtils'
import SeoMeta from '../components/SeoMeta'
export default function UncertainReviewPage(){
 const [questions,setQuestions]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0),[visible,setVisible]=useState(20)
 useEffect(()=>{let active=true;setLoading(true);setError('');const ids=getUncertainQuestionIds()
 loadQuestionsByKeys(ids).then(rows=>{if(active){setQuestions(rows);if(rows.length<ids.length)setError('部分題目暫時無法載入，原有標注仍保留。')}}).catch(()=>{if(active)setError('題目載入失敗，原有標注仍保留，請重試。')}).finally(()=>{if(active)setLoading(false)})
 return()=>{active=false}
 },[retry])
 return <main className="min-h-screen px-4 py-8"><SeoMeta title="猶豫題複習｜放射師國考題庫" canonicalPath="/uncertain" robots="noindex,nofollow"/><div className="mx-auto max-w-3xl space-y-6"><Link to="/">← 返回首頁</Link><h1 className="text-3xl font-black">猶豫題複習</h1><p>保留交卷時的標注，即使答對仍可檢討。查看題目不增加作答次數，也不代表已精熟。</p><p>本功能加入前，未隨交卷保存的舊標注無法回推；仍在草稿中的標注會在下次交卷保留。</p><nav className="flex gap-4"><Link to="/wrong-book">錯題本</Link><Link to="/bookmarks">收藏題</Link></nav>
 {loading&&<p>載入題目中…</p>}{error&&<p role="alert">{error} <button className="underline" onClick={()=>setRetry(v=>v+1)}>重試</button></p>}
 {!loading&&!error&&!questions.length&&<p>目前沒有已交卷的猶豫題。作答時點「標注此題」，交卷後會保留在這裡。</p>}
 {questions.slice(0,visible).map(q=><article key={q.id} className="space-y-4 rounded-2xl border bg-white p-5"><p>{formatQuestionMetadata(q)}</p><p>最近標注作答：{getLatestSubmittedAnswer(q.id,{flaggedOnly:true})?.answer || '未作答'}</p><QuestionContent question={q}/><div className="space-y-3">{Object.entries(q.options||{}).map(([key,value])=><div key={key} className="rounded border p-3"><strong>{key}</strong><QuestionRichText text={value} alt={`選項 ${key}`}/></div>)}</div><Link className="underline" to={`/questions/${encodeURIComponent(q.id)}?from=uncertain`} state={{from:'uncertain'}}>查看答案與來源詳解</Link></article>)}
 {questions.length>visible&&<button onClick={()=>setVisible(n=>n+20)}>載入更多（{visible}/{questions.length}）</button>}
 </div></main>
}
