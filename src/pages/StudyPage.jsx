import { withProgressLock } from '../utils/progressLock'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import SeoMeta from '../components/SeoMeta'
import { getQuestionIndex, loadQuestionFile } from '../utils/questionDataLoader'
import { readStudyState, flushCommittedStudyAttempts, questionMetadata, requestNextStudyAdvice, chooseStudyTask, getStudyProgress } from '../utils/studyAgentAdapter'
import { newSessionId } from '../utils/quizSessionUtils'
import { downloadProgressBackup } from '../components/StorageNotice'
export default function StudyPage() {
  const navigate = useNavigate(), busyRef = useRef(false)
  const [tasks, setTasks] = useState(() => readStudyState().tasks), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice,setNotice] = useState('')
  const [delivery,setDelivery] = useState(null)
  const [from, setFrom] = useState(() => tasks.at(-1)?.scope.yearFrom ?? 100), [to, setTo] = useState(() => tasks.at(-1)?.scope.yearTo ?? 115)
  useEffect(()=>{
    let active=true
    const refresh=()=>withProgressLock(()=>flushCommittedStudyAttempts()).then(result=>{if(active){setDelivery(result);setTasks(readStudyState().tasks)}}).catch(()=>{if(active)setDelivery({ok:false,status:'lock-unavailable'})})
    refresh()
    window.addEventListener('storage',refresh);window.addEventListener('focus',refresh)
    return ()=>{active=false;window.removeEventListener('storage',refresh);window.removeEventListener('focus',refresh)}
  },[])
  const request = async () => {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const index = await getQuestionIndex()
      const data = (await Promise.all(index.filter(x => x.year >= from && x.year <= to).map(x => loadQuestionFile(x.filePath)))).flat()
      const result = await withProgressLock(() => {setDelivery(flushCommittedStudyAttempts());return requestNextStudyAdvice({ requestId: newSessionId(), catalog: data.map(questionMetadata), yearFrom: from, yearTo: to, count: 10 })})
      setTasks(result.state.tasks); if (!result.task) setError(result.reason); else if(result.reused) setNotice('這個範圍已有未完成任務，先繼續這一組。')
    } catch { setError('暫時無法提供任務，題庫作答不受影響。請稍後再試。') }
    finally { busyRef.current = false; setBusy(false) }
  }
  const choose = async (task, choice) => { try {setTasks((await withProgressLock(()=>chooseStudyTask(task.id, choice))).tasks)} catch {setError('無法更新任務，請重新開啟此頁。')} }
  const start = (task) => navigate(`/quiz/${encodeURIComponent('全部科目')}?${new URLSearchParams({mode:'task', taskId:task.id, startYear:String(task.scope.yearFrom), endYear:String(task.scope.yearTo)})}`)
  return <main className="min-h-screen px-4 py-8"><div className="mx-auto max-w-3xl space-y-6"><SeoMeta title="題庫本機學習任務" canonicalPath="/study" robots="noindex,nofollow" /><Link to="/">← 返回首頁</Link><h1 className="text-3xl font-black">題庫本機學習任務</h1>{readStudyState().hostStateError && <p role="alert">{readStudyState().hostStateError}</p>}<p>只有你點選下方按鈕才產生建議。這是題庫自己的本機建議，不是獨立 OnTrack。若要交接到獨立 OnTrack，請在結果頁勾選同意後自行下載作答 JSON；這裡不會自動傳送。</p><p className="text-slate-600">交卷後靜默記錄題目代號與評分，不傳題幹、選項或答案全文。舊 AI 標籤不作為弱項證據；任務完成不代表精熟。單題耗時未量測。</p>
    <div className="flex flex-wrap gap-4"><label>起始年份<input aria-label="建議起始年份" type="number" min="100" max="115" value={from} onChange={e=>setFrom(Number(e.target.value))} className="ml-2 w-24 rounded border p-2" /></label><label>結束年份<input aria-label="建議結束年份" type="number" min="100" max="115" value={to} onChange={e=>setTo(Number(e.target.value))} className="ml-2 w-24 rounded border p-2" /></label></div>
    <Button disabled={busy || from > to || from < 100 || to > 115} onClick={request}>{busy ? '整理題目中…' : '查看學習建議（最多 10 題）'}</Button>{delivery && !delivery.ok && <p role="status">學習觀察尚未全部同步；作答收據已保留，下次開啟本頁或交卷重試時再補送，不重複計入作答。{delivery.pending ? ` 待補送 ${delivery.pending} 筆。` : ''}{delivery.blocked ? ` 另有 ${delivery.blocked} 筆缺少可核對收據，保留待查。` : ''}{delivery.status==='storage-volatile' ? ' 瀏覽器尚無法持久儲存，請保留此分頁並匯出備份。' : ''}</p>}{delivery?.delivered>0 && <p role="status">已補送 {delivery.delivered} 筆學習觀察；沒有新增作答次數或自動產生建議。</p>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {[...tasks].reverse().map(task => {const p = getStudyProgress(task.id);return <section key={task.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-bold">{task.title}</h2><p>{task.reason}</p><details className="rounded border border-slate-200 p-3"><summary className="cursor-pointer font-semibold">為什麼建議這一組？</summary><div className="mt-3 space-y-2 text-sm">
      <p>採用此範圍內 {task.evidence?.distinctQuestions ?? 0} 題不同題目的最近可用評分；重複作答不累加證據。</p>
      {Number.isInteger(task.evidence?.excludedQuestions) && <p>另有 {task.evidence.excludedQuestions} 題最近紀錄為待核對或一律給分，未用於弱項判斷。</p>}
      {task.evidence?.status==='preliminary_support' ? <p>此單元 {task.evidence.conceptQuestions} 題中答錯 {task.evidence.conceptWrong} 題，只是暫定練習方向。</p> : <p>目前不足以判定弱項；可能是可用作答不足，或題目沒有經核准的概念標籤。</p>}
      {task.evidence?.threshold && <p>本機規則門檻：同一單元至少 {task.evidence.threshold.minDistinctQuestions} 題不同題目，至少答錯 {task.evidence.threshold.minWrong} 題且比例達 {Math.round(task.evidence.threshold.minWrongRatio*100)}%。這不是經驗證的能力診斷。</p>}
      <p>在你選的範圍內優先安排尚未觀察作答的題目；不足時才使用已有紀錄的題目。時間是粗估，並非實測。</p><p>理由是建立任務時的快照；之後答案更正不會改寫原任務。完成後可主動請求新建議。</p>
    </div></details><p>{task.scope.yearFrom}–{task.scope.yearTo} 年 · {task.questionIds.length} 題 · 粗估 {task.estimatedMinutes} 分鐘</p><p>{task.completionRule}</p>{task.status === 'accepted' ? <>{p.unavailable ? <p role="status">暫時無法讀取插件進度，題庫作答不受影響。</p> : <><progress aria-label="任務進度" value={p.completed} max={p.total} className="w-full" /><p>{p.completed} / {p.total} 題 · {p.percent}%</p></>}<Button onClick={()=>start(task)}>{p.complete ? '再次練習' : '繼續任務'}</Button></> : <div className="flex flex-wrap gap-3">{['offered','deferred'].includes(task.status) && <Button onClick={()=>choose(task,'accept')}>接受任務</Button>}{task.status === 'offered' && <><Button variant="secondary" onClick={()=>choose(task,'defer')}>稍後再做</Button><Button variant="ghost" onClick={()=>choose(task,'reject')}>不接受</Button></>}<span>{task.status === 'rejected' ? '已拒絕，不會主動重送' : task.status === 'deferred' ? '已延期' : '等待選擇'}</span></div>}</section>})}
    <div className="flex gap-4"><button className="underline" onClick={downloadProgressBackup}>匯出本機學習紀錄</button><Link className="underline" to="/settings">管理／清除目前使用者紀錄</Link></div>
  </div></main>
}
