import { officialQuestionLink } from '../utils/officialSources'
import { useEffect, useState } from 'react'
import useDialog from '../utils/useDialog'
export function questionImagePaths(question) {
  const texts = [question.question, ...Object.values(question.options || {})]
  const paths = texts.flatMap(text => [...String(text || '').matchAll(/\{\{image:([^}]+)\}\}/g)].map(m => m[1]))
  if (question.image) paths.push(typeof question.image === 'string' ? question.image : question.image.src)
  return [...new Set(paths.filter(Boolean).map(p => /^(https?:|data:|\/uploads\/)/.test(p) ? p : `/uploads/${p.replace(/\\/g,'/').split('/').pop()}`))]
}
export default function QuestionFigureViewer({question}) {
  const [open,setOpen] = useState(false), [zoom,setZoom] = useState(2), [widths,setWidths] = useState({}), [failed,setFailed] = useState({}), [attempt,setAttempt] = useState(0)
  const ref = useDialog(open,()=>setOpen(false))
  const paths = questionImagePaths(question)
  const official = officialQuestionLink(question)
  useEffect(()=>{setOpen(false);setZoom(2);setFailed({})},[question.id])
  const labelFor = src => {
    const keys=Object.entries(question.options || {}).filter(([,text])=>String(text).includes(src.split('/').pop())).map(([key])=>key)
    return keys.length ? `選項 ${keys.join('、')}` : '題幹附圖'
  }
  if (!paths.length) return null
  return <><button type="button" className="rounded-xl border border-blue-300 px-4 py-3 font-bold text-blue-700" onClick={()=>setOpen(true)}>放大附圖（{paths.length} 張／片段）</button>
    {open && <div className="fixed inset-0 z-[90] bg-slate-950/70 p-3"><section ref={ref} role="dialog" aria-modal="true" aria-label="完整題目附圖" className="mx-auto flex h-full max-w-6xl flex-col rounded-xl bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3"><p>連續片段不裁切，可上下／左右捲動。</p><button className="ml-auto rounded border px-4 py-2" onClick={()=>setOpen(false)}>關閉附圖</button></div>
      <div className="mb-4 flex flex-wrap items-center gap-2"><button className="rounded border px-3 py-2" disabled={zoom<=0.5} onClick={()=>setZoom(z=>Math.max(0.5,z-0.5))}>縮小</button><output aria-label="附圖倍率">{Math.round(zoom*100)}%</output><button className="rounded border px-3 py-2" disabled={zoom>=4} onClick={()=>setZoom(z=>Math.min(4,z+0.5))}>放大</button><button className="rounded border px-3 py-2" onClick={()=>setZoom(1)}>原始尺寸</button></div>
      <div className="overflow-auto">{paths.map((src,i)=><div key={src}>{(i===0 || labelFor(src)!==labelFor(paths[i-1])) && <p className="mb-2 mt-4 font-bold">{labelFor(src)}</p>}{failed[src] ? <div role="status">附圖未能載入，可能是檔案缺漏或連線問題。勿依缺圖判斷答案。 <a className="text-blue-700 underline" href={official.url} target="_blank" rel="noreferrer">{official.direct ? '查看本卷官方原題 PDF' : '前往考選部查詢原題'}</a><button className="ml-2 underline" onClick={()=>{setFailed(f=>({...f,[src]:false}));setAttempt(a=>a+1)}}>重試附圖</button></div> : <img key={`${src}-${attempt}`} src={src} alt={`${labelFor(src)}，第 ${i+1} 個片段`} className="block max-w-none" style={{width:widths[src] ? widths[src]*zoom : undefined,height:'auto'}} onLoad={e=>{const w=e.currentTarget.naturalWidth;setWidths(old=>old[src]===w?old:{...old,[src]:w})}} onError={()=>setFailed(f=>({...f,[src]:true}))}/>}</div>)}</div>
    </section></div>}
  </>
}
