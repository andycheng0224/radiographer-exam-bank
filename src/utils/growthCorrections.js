import { getCurrentEffectiveUserId, getQuestionKey, readUserScopedStorageValue, writeUserScopedStorageValue } from './storageUtils.js'
import { officialCorrection, GRADING_VERSION } from './officialCorrections.js'
const KEY='radiographer_exam_bank_growth_corrections_v1'
export function getGrowthCorrections() {
  const saved=readUserScopedStorageValue(KEY,null)
  if(saved===null) return {version:1,entries:[]}
  const valid=saved?.version===1 && Array.isArray(saved.entries) && saved.entries.every(e=>e && typeof e.id==='string' && typeof e.questionId==='string' && typeof e.sessionId==='string' && Number.isFinite(e.answeredAt) && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.dailyApplied==='boolean' && ['answeredCount','correctCount','wrongCount'].every(k=>Number.isFinite(e.delta?.[k])))
  return valid ? saved : {version:1,entries:[],invalid:true}
}
const dateKey=time=>{const d=new Date(time);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const rawDaily=()=>readUserScopedStorageValue('radiographer_exam_bank_growth_daily_stats',{})
export function applyGrowthDailyCorrections(days) {
  const out={...days}
  for(const entry of getGrowthCorrections().entries) {
    if(!entry.dailyApplied || !out[entry.date]) continue
    const day={...out[entry.date]}
    for(const key of ['answeredCount','correctCount','wrongCount']) day[key]=Number(day[key]||0)+entry.delta[key]
    day.accuracy=day.answeredCount>0 ? Math.round(day.correctCount/day.answeredCount*100) : 0
    day.hasGradingCorrections=true;out[entry.date]=day
  }
  return out
}
export function applyGrowthStateCorrections(states) {
  const out={...states}
  for(const entry of getGrowthCorrections().entries) {
    const state=out[entry.questionId]
    if(!state || Number(state.lastAnsweredAt)!==entry.answeredAt || state.appliedGrowthCorrectionIds?.includes(entry.id)) continue
    out[entry.questionId]={...state,correctStreak:0,masteryLevel:'unverified',clearedAt:null,
      gradingNeedsReview:true,appliedGrowthCorrectionIds:[...(state.appliedGrowthCorrectionIds||[]),entry.id]}
  }
  return out
}
// Sidecar overlay: never destroy old logs/totals/history. One write records the reviewed delta and audit.
// Caller holds the progress lock. Only one unambiguous log linked to the supplied answer snapshot qualifies.
export function reconcileGrowthEvidence(payload, results) {
  const overlay=getGrowthCorrections(), logs=readUserScopedStorageValue('radiographer_exam_bank_growth_answer_logs',[])
  if(overlay.invalid || !Array.isArray(logs)) return {status:'unavailable',updated:0}
  const user=getCurrentEffectiveUserId(), day=dateKey(Number(payload.submittedAt))
  let updated=0,unresolved=0
  const effective=applyGrowthDailyCorrections(rawDaily())
  for(const q of results.filter(q=>q.isAnswered&&officialCorrection(q))) {
    const questionId=getQuestionKey(q), matches=logs.filter(log=>log.questionId===questionId&&log.userId===user&&Number(log.answeredAt)===Number(payload.submittedAt)&&(!log.sessionId||log.sessionId===payload.sessionId))
    if(matches.length!==1 || typeof matches[0].isCorrect!=='boolean') {unresolved++;continue}
    const log=matches[0], id=JSON.stringify([payload.sessionId,questionId,Number(payload.submittedAt)])
    const previousIndex=overlay.entries.findIndex(e=>e.sessionId===payload.sessionId&&e.questionId===questionId&&e.answeredAt===Number(payload.submittedAt))
    const previous=overlay.entries[previousIndex]
    if(previous?.version===GRADING_VERSION) continue
    const exempt=q.scoreStatus==='all-credit', oldExempt=log.scoreStatus==='all-credit'
    const delta={answeredCount:Number(!exempt)-Number(!oldExempt),correctCount:Number(!exempt&&q.isCorrect)-Number(!oldExempt&&log.isCorrect),wrongCount:Number(!exempt&&!q.isCorrect)-Number(!oldExempt&&!log.isCorrect)}
    if(!previous && Object.values(delta).every(n=>n===0)) continue
    const daily=effective[day]
    if(previous?.dailyApplied && daily) for(const [key,change] of Object.entries(previous.delta)) daily[key]-=change
    const dailyApplied=Boolean(daily&&Object.entries(delta).every(([key,change])=>Number.isFinite(daily[key])&&daily[key]+change>=0))
    if(dailyApplied) for(const [key,change] of Object.entries(delta)) daily[key]+=change
    const entry={id,sessionId:payload.sessionId,questionId,answeredAt:Number(payload.submittedAt),date:day,version:GRADING_VERSION,
      previous:{...log},next:{isCorrect:q.isCorrect,scoreStatus:q.scoreStatus},delta,dailyApplied,
      authority:q.answerRule?.version?.sourceUrl || 'officialCorrections.js',appliedAt:new Date().toISOString(),
      revisionHistory:previous ? [...(previous.revisionHistory||[]),{version:previous.version,next:previous.next,delta:previous.delta,dailyApplied:previous.dailyApplied}] : [],
      limits:'XP, review weights and old clearance bonuses remain historical; no inferred mastery.'}
    if(previousIndex>=0) overlay.entries[previousIndex]=entry
    else overlay.entries.push(entry)
    updated++
  }
  if(updated) writeUserScopedStorageValue(KEY,overlay)
  return {status:updated?'updated':'current',updated,unresolved}
}
