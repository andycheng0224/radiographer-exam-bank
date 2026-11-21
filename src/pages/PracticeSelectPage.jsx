import { selectionSearch } from '../utils/selectionNavigation'
import { getCanonicalSubjectName } from '../utils/subjectUtils'
import { officialQuestionLink, officialPaperYears, unavailableOfficialPapers } from '../utils/officialSources'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getQuestionIndex, loadQuestionFile } from '../utils/questionDataLoader'
import { listPapers, searchableTags, selectPracticeQuestions, questionRelevance } from '../utils/practiceSelection'
import Button from '../components/Button'
import SeoMeta from '../components/SeoMeta'

export default function PracticeSelectPage() {
  const [params, setParams] = useSearchParams()
  const mode = params.get('mode') === 'paper' ? 'paper' : 'practice'
  const navigate = useNavigate()
  const [index, setIndex] = useState([]), [questions, setQuestions] = useState([])
  const [startYear, setStartYear] = useState(Number(params.get('startYear')) || 115), [endYear, setEndYear] = useState(Number(params.get('endYear')) || 115)
  const [subject, setSubject] = useState(params.get('subject') || '全部科目'), [keyword, setKeyword] = useState(params.get('keyword') || ''), [tag, setTag] = useState(params.get('tag') || '')
  const [paper, setPaper] = useState(params.get('paper') || ''), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  const currentSearch = selectionSearch({mode,startYear,endYear,subject,paper,keyword,tag})
  useEffect(() => { if(params.toString() !== currentSearch) setParams(currentSearch,{replace:true}) }, [currentSearch,params,setParams])
  useEffect(() => { let active = true; getQuestionIndex().then((data) => { if(active) setIndex(data) }).catch(() => { if(active) {setError('題庫索引載入失敗，請重試。');setLoading(false)} }); return () => {active = false} }, [retry])
  useEffect(() => {
    if (!index.length) return
    let active = true; setLoading(true); setError('')
    const entries = index.filter((item) => Number(item.year) >= startYear && Number(item.year) <= endYear && (subject === '全部科目' || item.subject === subject))
    Promise.all(entries.map((item) => loadQuestionFile(item.filePath))).then((files) => {if(active) { setQuestions(files.flat()); setPaper(current => listPapers(files.flat()).some(p => p.id === current) ? current : '') }}).catch(() => { if(active) {setQuestions([]);setError('有題庫檔案載入失敗，未以部分資料開始練習。請重試。')} }).finally(() => { if(active) setLoading(false) })
    return () => {active = false}
  }, [index, startYear, endYear, subject, retry])
  const years = [...new Set([...index.map((item) => Number(item.year)), ...officialPaperYears])].sort((a,b) => b-a)
  const subjects = [...new Set(index.map((item) => item.subject))]
  const papers = useMemo(() => listPapers(questions), [questions])
  const unavailable = useMemo(() => unavailableOfficialPapers(questions, {startYear, endYear, subject}), [questions, startYear, endYear, subject])
  const tags = useMemo(() => [...new Set(questions.flatMap(searchableTags))].sort(), [questions])
  const selected = useMemo(() => selectPracticeQuestions(questions, {mode, paper, subject, startYear, endYear, keyword, tag}), [questions, mode, paper, subject, startYear, endYear, keyword, tag])
  const subjectCounts = useMemo(() => Object.entries(selected.reduce((counts,q) => {const name=getCanonicalSubjectName(q.subject);counts[name]=(counts[name] || 0)+1;return counts},{})), [selected])
  const selectedPaper = papers.find(item => item.id === paper)
  const paperSource = selectedPaper ? officialQuestionLink(selectedPaper.questions[0]) : null
  const start = () => {
    const picked = papers.find((item) => item.id === paper)
    const query = new URLSearchParams({ mode, startYear: String(startYear), endYear: String(endYear), paper, keyword, tag })
    navigate(`/quiz/${encodeURIComponent(mode === 'paper' ? picked.subject : subject)}?${query}`)
  }
  const field = 'mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-950'
  return <main className="min-h-screen px-4 py-8"><div className="mx-auto max-w-5xl space-y-6">
    <SeoMeta title={mode === 'paper' ? '整份試卷｜放射師國考題庫' : '單元練習｜放射師國考題庫'} canonicalPath="/practice" /><Link to="/" className="font-semibold text-blue-700">← 返回首頁</Link>
    <h1 className="text-3xl font-black text-slate-950">{mode === 'paper' ? '整份試卷' : '單元練習'}</h1>
    <p className="text-lg text-slate-600">{mode === 'paper' ? '每份試卷依年份、梯次與科目分開，包含目前收錄的全部題目，不混池抽題。' : '搜尋題目、選項與有來源的分類標籤；練習包含年份範圍內全部已收錄的符合題目。'}</p>
    <div className="grid gap-4 sm:grid-cols-3">
      <label>起始年份<select aria-label="起始年份" className={field} value={startYear} onChange={(e) => setStartYear(Number(e.target.value))}>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
      <label>結束年份<select aria-label="結束年份" className={field} value={endYear} onChange={(e) => setEndYear(Number(e.target.value))}>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
      <label>科目<select aria-label="科目" className={field} value={subject} onChange={(e) => setSubject(e.target.value)}><option>全部科目</option>{subjects.map((name) => <option key={name}>{name}</option>)}</select></label>
    </div>
    {startYear > endYear && <p role="alert" className="text-rose-700">起始年份不可大於結束年份。</p>}
    {mode === 'practice' && <><label className="block">課程概念或關鍵詞<input aria-label="課程概念或關鍵詞" className={field} placeholder="例如：粒線體、CT、MRI" value={keyword} onChange={(e) => setKeyword(e.target.value)} /></label><label className="block">跨科來源標籤<select aria-label="跨科來源標籤" className={field} value={tag} onChange={(e) => setTag(e.target.value)}><option value="">不限標籤</option>{tag && !tags.includes(tag) && <option value={tag}>{tag}（{loading ? '載入中' : '目前範圍無此來源標籤'}）</option>}{tags.map((value) => <option key={value}>{value}</option>)}</select></label><p className="text-slate-600">{loading ? '載入來源標籤中…' : tags.length ? '來源分類可跨科搜尋，但不等同專家核可；未核可分類不作為 OnTrack 弱項證據。' : '這個範圍尚無附來源頁碼的分類標籤。關鍵字搜尋為文字匹配，不代表專家標註。'}</p></>}
    {loading ? <p role="status">載入題庫中…</p> : error ? <div role="alert">{error}<Button onClick={() => setRetry((n) => n+1)}>重試</Button></div> : <>
      {unavailable.length > 0 && <details className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <summary className="cursor-pointer font-semibold">這個範圍另有 {unavailable.length} 份官方試卷尚未收錄</summary>
        <p className="mt-2">不包含在下方搜尋或練習中；可先查看官方原卷，不以其他梯次題目代替。</p>
        <ul className="mt-2 space-y-2">{unavailable.map(item => <li key={item.key}><a className="text-blue-700 underline" href={item.questionUrl} target="_blank" rel="noreferrer">{item.year} 年 · {item.roundLabel} · {item.subject} · 官方原卷 PDF</a></li>)}</ul>
      </details>}
      {mode === 'paper' && <label className="block">選擇試卷<select aria-label="選擇試卷" className={field} value={paper} onChange={(e) => setPaper(e.target.value)}><option value="">請選擇年份、梯次與科目</option>{papers.map((item) => <option key={item.id} value={item.id}>{item.year} 年 · {item.round} · {item.subject} · {item.questions.length} 題{item.missingNumbers.length ? `（收錄缺號：${item.missingNumbers.join('、')}）` : ''}</option>)}</select><p className="mt-2 text-slate-600">收錄數量尚未逐卷與官方 PDF 核對，不代表內容已驗證。</p></label>}
      {mode === 'paper' && selectedPaper && <p className="rounded-xl bg-slate-100 p-4">{selectedPaper.missingNumbers.length ? `本地缺少第 ${selectedPaper.missingNumbers.join('、')} 題，以下僅練習已收錄題目。` : '題號連續；尚不代表全部文字、附圖與詳解已驗證。'} {paperSource?.direct && <a className="text-blue-700 underline" href={paperSource.url} target="_blank" rel="noreferrer">查看這份官方原卷 PDF</a>}</p>}
      <div className="flex flex-wrap items-center gap-4"><p role="status" className="text-xl font-bold">{selected.length} 題{!selected.length && (mode !== 'paper' || paper) ? ' · 沒有符合條件的已收錄題目' : ''}</p><Button disabled={!selected.length || startYear > endYear} onClick={start}>{mode === 'paper' ? '開始倒數作答' : '練習全部符合題目'}</Button></div>
      {mode === 'practice' && selected.length > 0 && <p aria-label="符合題目的科目分布" className="text-slate-600">共 {subjectCounts.length} 科：{subjectCounts.map(([name,count])=>`${name} ${count} 題`).join('；')}。這是符合條件的科目分布，不代表已驗證跨科概念。</p>}
      {mode === 'practice' && !selected.length && startYear <= endYear && <div className="space-y-2"><p>可縮短關鍵字、取消標籤，或調整年份與科目。未收錄題目不在搜尋範圍內。</p>{(keyword || tag) && <Button variant="secondary" onClick={()=>{setKeyword('');setTag('')}}>清除關鍵字與標籤（保留年份及科目）</Button>}</div>}
      {mode === 'practice' && keyword.trim() && <p className="text-lg font-semibold">依文字相關度由高至低排列。分數只用來比較這次搜尋的文字匹配，不是百分比或內容可信度；結果必須包含所有關鍵詞。</p>}
      {mode === 'practice' && <ul className="divide-y divide-slate-200">{selected.slice(0,30).map((q) => { const relevance = keyword.trim() ? questionRelevance(q,keyword) : null; return <li key={q.id} className="py-4"><Link className="font-semibold text-blue-700" to={`/questions/${encodeURIComponent(q.id)}?from=practice&selection=${encodeURIComponent(currentSearch)}`}>{q.year} 年 · {q.exam_round} · {q.subject} · 第 {q.question_number} 題</Link><p className="mt-2 text-slate-700">{relevance && <span className="block font-semibold text-blue-700"><span className="inline-block mr-3">相關度分數：{relevance.score}</span><span className="inline-block">命中：{relevance.matches.join('、')}</span></span>}{q.question.replace(/\{\{image:[^}]+\}\}/g, '〔附圖〕')}</p></li> })}</ul>}
      {mode === 'practice' && selected.length > 30 && <p>預覽前 30 題；開始練習會包含全部 {selected.length} 題。</p>}
    </>}
  </div></main>
}
