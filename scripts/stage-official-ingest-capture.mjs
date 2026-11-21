// Consumes a local extractor capture; no scheduler, network, publishing or source mutation.
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import reviewedCorrections from '../src/data/reviewedAnswerCorrections.json' with {type:'json'}
import {planOfflineOfficialIngest} from './plan-official-ingest.mjs'
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x
const fingerprint = value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
export function stageOfficialIngestCapture(capture,prior=null) {
 if(capture?.schemaVersion!==1||capture.status!=='quarantined'||!/^official answer-grid numbers 01–80$/.test(capture.countEvidence)||
    capture.expectedCount!==80||!Array.isArray(capture.questions)||capture.questions.length!==80)throw Error('capture requires exact official grid; preserve quarantine')
 const answerUrl=new URL(capture.answerUrl), questionUrl=new URL(capture.questionUrl)
 const examCode=questionUrl.searchParams.get('code')
 for(const u of [answerUrl,questionUrl]){
  if(u.origin!=='https://wwwq.moex.gov.tw'||u.pathname!=='/exam/wHandExamQandA_File.ashx'||u.username||u.password||
    [...u.searchParams.keys()].some(k=>u.searchParams.getAll(k).length!==1))throw Error('invalid captured URL')
 }
 const corrections=[]
 const rows=capture.questions.map(q=>{
  if(typeof q?.question!=='string'||!q.question.trim()||!q.options||Object.keys(q.options).sort().join('')!=='ABCD'||
     Object.values(q.options).some(v=>typeof v!=='string'||!v.trim())||!Number.isInteger(q.questionSourcePage)||
     !Number.isInteger(q.answerSourcePage)||!Array.isArray(q.extractionIssues)||q.extractionIssues.length)throw Error('capture text/layout needs manual audit')
  const raw=q.rawAnswer
  if(!/^[A-D#]$/.test(raw??''))throw Error('ambiguous raw grade')
  if(q.officialCorrectionReviewed||raw==='#'||q.answerVersions?.length){
   const proof=reviewedCorrections.find(r=>r.paperKey===capture.paperKey&&r.questionNumber===q.question_number&&r.questionSha256===capture.questionSha256&&r.answerSha256===capture.answerSha256)
   if(!proof||q.officialCorrectionReviewed!==true||q.answerVersions?.length!==1||fingerprint(q.answerVersions[0])!==fingerprint(proof.version))throw Error('no exact paired-source reviewed correction')
   const v=proof.version
   corrections.push({number:q.question_number,revision:v.revision,rule:v.rule,source:{url:v.sourceUrl,page:v.page,sha256:v.sourceSha256}})
  }
  return {number:q.question_number,answer:raw==='#'?{kind:'unresolved-official-mark'}:{kind:'accepted-sets',acceptedSets:[raw]}}
 })
 const plan=planOfflineOfficialIngest({schemaVersion:1,paperKey:capture.paperKey,examCode,expectedCount:capture.expectedCount,
   questionSource:{url:capture.questionUrl,sha256:capture.questionSha256},
   answerSource:{url:capture.answerUrl,sha256:capture.answerSha256},rows,corrections},prior?.version??null)
 const captureSha256=fingerprint(capture)
 const transcriptionSha256=fingerprint(capture.questions.map(q=>({number:q.question_number,text:q.question,options:q.options,
  pages:q.questionSourcePages??[q.questionSourcePage],answerPage:q.answerSourcePage,images:q.pageImageReferences??{}})))
 if(prior?.transcriptionSha256&&prior.transcriptionSha256!==transcriptionSha256)throw Error('capture drift: transcription changed')
 if(prior?.captureSha256&&prior.captureSha256!==captureSha256&&prior.version?.planId===plan.planId)throw Error('capture drift under unchanged plan')
 return {status:plan.status,stageId:fingerprint({captureSha256,planId:plan.planId}),captureSha256,transcriptionSha256,version:plan.version,
  plan,trace:{scan:'external official mirror, not run by this tool',extract:'existing quarantined extractor capture',
   grade:'isolated plan only',publish:'blocked',humanReview:['check official paper/version, complete numbering, equation and option fidelity','map each figure and verify rights against original page','individually confirm official correction answer combinations and any unresolved marks','independently verify cited explanation claims and source rights before any RAG refresh']}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{let s='';for await(const b of process.stdin){s+=b;if(Buffer.byteLength(s)>2*1024*1024)throw Error('capture too large');}
 const x=JSON.parse(s);console.log(JSON.stringify(stageOfficialIngestCapture(x.capture,x.prior??null)))}
 catch{console.error(JSON.stringify({status:'quarantined',error:'official-preview-stage-blocked'}));process.exitCode=1}
}
