// Unattended offline planner for a normalized, externally audited batch. No writes or network.
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s)
const validPaper=s=>typeof s==='string'&&/^[a-zA-Z0-9\p{L} ()（）-]{5,150}$/u.test(s)
const small=(n,lo,hi)=>Number.isInteger(n)&&n>=lo&&n<=hi
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex')
function source(value,kind,code) {
 if (!sha(value?.sha256)||!small(value?.page??1,1,999)) throw Error('source fingerprint required')
 const u=new URL(value.url)
 if(u.origin!=='https://wwwq.moex.gov.tw'||u.username||u.password||u.pathname!=='/exam/wHandExamQandA_File.ashx'||
    u.searchParams.get('code')!==code||!kind.includes(u.searchParams.get('t'))) throw Error('source URL does not match paper')
 return {url:u.href,sha256:value.sha256,...(value.page?{page:value.page}:{})}
}
function rule(value) {
 if(value?.kind==='all-credit'&&(!value.acceptedSets||value.acceptedSets.length===0)) return {kind:'all-credit'}
 if(value?.kind!=='accepted-sets'||!Array.isArray(value.acceptedSets)||!value.acceptedSets.length||value.acceptedSets.length>15)throw Error('invalid answer rule')
 for (const s of value.acceptedSets) if (typeof s!=='string'||!/^[A-D]{1,4}$/.test(s)||s!==[...new Set(s)].sort().join(''))throw Error('invalid or ambiguous answer input')
 if(new Set(value.acceptedSets).size!==value.acceptedSets.length)throw Error('duplicate answer set')
 return {kind:'accepted-sets',acceptedSets:[...value.acceptedSets].sort()}
}
export function planOfflineOfficialIngest(batch,prior=null) {
 if(batch?.schemaVersion!==1||!validPaper(batch.paperKey)||!/^\d{6}$/.test(batch.examCode)||!small(batch.expectedCount,1,100)||
    !Array.isArray(batch.rows)||batch.rows.length!==batch.expectedCount||!Array.isArray(batch.corrections)||batch.corrections.length>batch.rows.length)throw Error('invalid batch or incomplete paper')
 const questionSource=source(batch.questionSource,['Q'],batch.examCode)
 const answerSource=source(batch.answerSource,['S','M'],batch.examCode)
 const scope=['code','c','s','q'].map(k=>new URL(questionSource.url).searchParams.get(k))
 if(scope.some((x,i)=>!x||x!==new URL(answerSource.url).searchParams.get(['code','c','s','q'][i])))throw Error('mismatched paper URL scope')
 if(prior&&(prior.paperKey!==batch.paperKey||prior.questionSha256!==questionSource.sha256||prior.answerSha256!==answerSource.sha256))throw Error('paper or source hash drift; manual audit required')
 const versions=new Map()
 const normalized=batch.rows.map(q=>{
  if(!small(q?.number,1,batch.expectedCount)||versions.has(q.number))throw Error('duplicate or invalid question number')
  const v={authority:'official-original',rule:q.answer?.kind==='unresolved-official-mark'?{kind:'unresolved-official-mark'}:rule(q.answer)};versions.set(q.number,v)
  return {number:q.number,version:v}
 }).sort((a,b)=>a.number-b.number)
 const originalRulesSha256=hash(normalized)
 if(prior&&prior.originalRulesSha256!==originalRulesSha256)throw Error('original answer parse changed; manual audit required')
 const corrections=new Map()
 for(const c of batch.corrections){
  if(!versions.has(c?.number)||corrections.has(c.number)||!small(c.revision,1,99999999))throw Error('unknown or duplicate correction row')
  const correctionSource=source(c.source,['A','M'],batch.examCode)
  if(!correctionSource.page)throw Error('correction page is required')
  const v={authority:'official-correction',revision:c.revision,source:correctionSource,rule:rule(c.rule)}
  corrections.set(c.number,v)
 }
 if(normalized.some(r=>r.version.rule.kind==='unresolved-official-mark'&&!corrections.has(r.number)))throw Error('unresolved official mark without verified correction')
 const corrected=Object.fromEntries([...corrections].sort(([a],[b])=>a-b))
 for(const [k,v] of Object.entries(prior?.corrections||{})){
  const next=corrected[k]
  if(!next||next.revision<v.revision||(next.revision===v.revision&&hash(next)!==hash(v)))throw Error('correction removal, downgrade or same-version drift; manual audit required')
 }
 const selected=normalized.map(row=>({number:row.number,version:corrections.get(row.number)||row.version}))
 const version={paperKey:batch.paperKey,questionSha256:questionSource.sha256,answerSha256:answerSource.sha256,originalRulesSha256,corrections:corrected}
 const planId=hash({version,selected})
 if(prior&&prior.planId!==planId&&hash(prior.corrections||{})===hash(corrected))throw Error('answer parse changed without official correction version')
 return {status:prior?.planId===planId?'already-planned':'preview-only',planId,version:{...version,planId},selected,
  gates:{canonicalWrite:false,publish:false,studentReceiptsChanged:false,verifiedExplanationRefresh:'requires-human-source-review',ragIndexRefresh:'blocked-until-rights-and-review'}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{let raw='';for await(const b of process.stdin){raw+=b;if(Buffer.byteLength(raw)>128000)throw Error('input too large')}
 const x=JSON.parse(raw); console.log(JSON.stringify(planOfflineOfficialIngest(x.batch,x.prior??null)))}
 catch{console.error(JSON.stringify({error:'official-ingest-plan-blocked'}));process.exitCode=1}
}
