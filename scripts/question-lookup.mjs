// Local read-only JSON contract. The launcher, not the request, chooses the build root.
import { createHash } from 'node:crypto'
import { open, realpath } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { EXAM_SUBJECTS } from '../src/constants/subjects.js'
import { questionRelevance, selectPracticeQuestions } from '../src/utils/practiceSelection.js'

const SLUGS = new Set(EXAM_SUBJECTS.map(x=>x.slug))
const YEAR = y => Number.isInteger(y) && y>=100 && y<=115
const SHARD = /^\/data\/questions\/([a-z-]+)\/(10[0-9]|11[0-5])\.json$/
const STR = (v,n) => typeof v==='string' && v.trim().length>0 && v.length<=n && !/[\p{Cc}]/u.test(v)
const HASH = s=>typeof s==='string' && /^[a-f0-9]{64}$/.test(s)
const digest = b=>createHash('sha256').update(b).digest('hex')
const plain = s=>String(s??'').replace(/\{\{image:[^}]+\}\}/g,'〔附圖，見官方原卷〕')
const requireKeys = (o, keys) => {
 if (!o || typeof o!=='object' || Array.isArray(o) || Object.keys(o).some(k=>!keys.includes(k))) throw Error('unsupported request fields')
}
function citation(q) {
 const p=q.sourceProvenance
 if (p?.contentStatus!=='transcription-reviewed' || typeof q.question!=='string' || q.question.length>4000 ||
     !['A','B','C','D'].every(k=>typeof q.options?.[k]==='string' && q.options[k].length<=1600) || !HASH(p?.questionSha256) || !Number.isInteger(p?.questionPage) || p.questionPage<1 || typeof p.questionUrl!=='string') return null
 try {
  const url=new URL(p.questionUrl)
  if (url.origin!=='https://wwwq.moex.gov.tw' || url.username || url.password ||
      url.pathname!=='/exam/wHandExamQandA_File.ashx' || url.searchParams.get('t')!=='Q') return null
  url.hash='page='+p.questionPage
  return {publisher:'考選部',url:url.href,page:p.questionPage,questionPdfSha256:p.questionSha256,status:'source-linked-transcription'}
 } catch { return null }
}
function record(q) {
 const source=citation(q)
 const identity={id:q.id,year:q.year,subject:q.subject,examRound:q.exam_round,questionNumber:q.question_number}
 if (!source) return {...identity,status:'source-not-verified-for-lookup'}
 return {...identity,status:source.status,source,stem:plain(q.question),
   options:Object.fromEntries(['A','B','C','D'].map(k=>[k,plain(q.options?.[k])]))}
}
export async function openQuestionLookup(buildRoot) {
 const root=await realpath(buildRoot)
 const get=async rel=>{
  const allowed=rel==='/data/question-index.json'||rel==='/data/question-key-map.json'||SHARD.test(rel)
  if (!allowed) throw Error('path is not a catalog file')
  const path=join(root,rel)
  if (await realpath(path)!==path) throw Error('catalog symlink is not allowed')
  const f=await open(path,'r')
  try {
   const st=await f.stat()
   if (!st.isFile()||st.size<2||st.size>8*1024*1024) throw Error('catalog file size out of bounds')
   const b=await f.readFile()
   if(b.length!==st.size) throw Error('catalog short read')
   return {data:JSON.parse(b),sha:digest(b)}
  } finally { await f.close() }
 }
 const ix=await get('/data/question-index.json')
 const keys=await get('/data/question-key-map.json')
 if (!Array.isArray(ix.data)||ix.data.length>96||!keys.data||Array.isArray(keys.data)||typeof keys.data!=='object') throw Error('invalid catalog')
 const allowed=new Map()
 for (const e of ix.data) {
  const parts=typeof e?.filePath==='string' && SHARD.exec(e.filePath)
  if (!parts||!SLUGS.has(parts[1])||Number(parts[2])!==e.year||e.subjectSlug!==parts[1]||allowed.has(e.filePath)) throw Error('invalid shard index')
  if (EXAM_SUBJECTS.find(x=>x.slug===parts[1])?.name!==e.subject) throw Error('invalid shard subject')
  allowed.set(e.filePath,e)
 }
 const load=async path=>{
  const entry=allowed.get(path)
  if (!entry) throw Error('unindexed shard')
  const {data}=await get(path)
  if (!Array.isArray(data)||data.length!==entry.questionCount||
      data.some(q=>!STR(q?.id,220)||q.year!==entry.year||!STR(q.subject,80)||typeof q.question!=='string'||!q.options||
        !Number.isInteger(q.question_number))) throw Error('invalid shard records')
  return data
 }
 const catalog={indexSha256:ix.sha,keyMapSha256:keys.sha}
 return async req=>{
  if (req?.op==='fetch') {
   requireKeys(req,['op','id'])
   if(!STR(req.id,220)) throw Error('invalid question id')
   const path=Object.hasOwn(keys.data,req.id)?keys.data[req.id]:null
   const q=path?(await load(path)).find(x=>x.id===req.id):null
   return {catalog,result:q?record(q):null}
  }
  if (req?.op!=='search') throw Error('only search and fetch are supported')
  requireKeys(req,['op','query','startYear','endYear','subject','limit'])
  const {query,startYear,endYear,subject,limit=8}=req
  if (!STR(query,100)||query.trim().split(/\s+/u).length>8||!YEAR(startYear)||!YEAR(endYear)||endYear<startYear||endYear-startYear>2||
      (subject!==undefined&&!SLUGS.has(subject))||!Number.isInteger(limit)||limit<1||limit>12) throw Error('invalid search bounds')
  const names=[...allowed.values()].filter(e=>e.year>=startYear&&e.year<=endYear&&(!subject||e.subjectSlug===subject)).map(e=>e.filePath)
  const rows=[]
  for (const path of names) for (const q of await load(path)) if(citation(q)) rows.push({ ...q, verifiedTags:[], sourcedTags:[] })
  const matches=selectPracticeQuestions(rows,{startYear,endYear,keyword:query})
  return {catalog,coverage:'source-linked transcriptions only; no textbook, explanations, answers or student records',total:matches.length,
    results:matches.slice(0,limit).map(q=>({...record(q),relevanceScore:questionRelevance(q,query).score}))}
 }
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 try {
  if (process.argv.length!==3) throw Error('usage: question-lookup.mjs BUILD_DIR < request.json')
  let input=''
  for await (const chunk of process.stdin) {
   input+=chunk
   if (Buffer.byteLength(input)>4096) throw Error('request too large')
  }
  const lookup=await openQuestionLookup(process.argv[2])
  console.log(JSON.stringify(await lookup(JSON.parse(input))))
 } catch {
  // Do not reflect request content, paths, or filesystem diagnostics to the caller.
  console.error(JSON.stringify({error:'invalid-request-or-unavailable-catalog'}));process.exitCode=1
 }
}
