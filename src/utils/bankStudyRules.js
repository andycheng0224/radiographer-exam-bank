// Bank-owned, deterministic rules. This module has no I/O or standalone OnTrack dependency.
export const PLUGIN_VERSION = 'bank-study-rules-v1'
const scoreStatuses = new Set(['graded', 'all-credit', 'unverified'])
const str = x => typeof x === 'string' && x.trim().length > 0
const validTime = x => str(x) && Number.isFinite(Date.parse(x))
export const createStudyState = () => ({ version: PLUGIN_VERSION, events: [], tasks: [], requests: [] })
const requireState = s => {
  if (s?.version !== PLUGIN_VERSION || !Array.isArray(s.events) || !Array.isArray(s.tasks) || !Array.isArray(s.requests)) throw new TypeError('Invalid bank study state')
}
export function recordAttempt(state, input) {
  requireState(state)
  if (input?.schemaVersion !== 1 || ![input.questionId,input.eventId,input.sessionId,input.subjectId,input.examId].every(str) ||
      !validTime(input.occurredAt) || !Number.isInteger(input.year) || typeof input.correct !== 'boolean' || !scoreStatuses.has(input.scoreStatus)) throw new TypeError('Invalid bank observation')
  const event = {
    schemaVersion: 1, questionId: input.questionId, eventId: input.eventId, sessionId: input.sessionId,
    subjectId: input.subjectId, examId: input.examId, year: input.year, occurredAt: input.occurredAt,
    correct: input.correct, scoreStatus: input.scoreStatus, durationMs: 0,
    conceptIds: [...new Set((Array.isArray(input.conceptIds) ? input.conceptIds : []).filter(str))].sort(),
  }
  const existing = state.events.find(x => x.eventId === event.eventId)
  if (existing) {
    if (Object.keys(event).some(k=>JSON.stringify(existing[k])!==JSON.stringify(event[k]))) throw new Error('Conflicting bank observation')
    return {state, duplicate:true}
  }
  return {state:{...state, events:[...state.events,event]}, duplicate:false}
}
export function requestAdvice(state,{ requestId, catalog, yearFrom, yearTo, count=10, subjectIds=[], now=new Date().toISOString() }) {
  requireState(state)
  if (!str(requestId) || !Array.isArray(catalog) || !Array.isArray(subjectIds) || !Number.isInteger(yearFrom) ||
      !Number.isInteger(yearTo) || yearFrom>yearTo || !Number.isInteger(count) || count<1 || !validTime(now)) throw new TypeError('Invalid bank advice request')
  const id='bank:'+requestId
  const previous=state.tasks.find(t=>t.id===id)
  if (previous) return {state,task:previous}
  const inScope=q=>Number.isInteger(q.year) && q.year>=yearFrom && q.year<=yearTo && (!subjectIds.length || subjectIds.includes(q.subjectId))
  const byId=new Map()
  for (const q of catalog) if (q && str(q.questionId) && inScope(q) && !byId.has(q.questionId)) byId.set(q.questionId,q)
  if (!byId.size) return {state,task:null,reason:'這個範圍沒有可用題目，請調整年份或科目。'}
  const observed=new Map()
  for (const e of state.events) {
    if (!byId.has(e.questionId) || Date.parse(e.occurredAt)>Date.parse(now)) continue
    const prior=observed.get(e.questionId)
    if (!prior || Date.parse(e.occurredAt)>=Date.parse(prior.occurredAt)) observed.set(e.questionId,e)
  }
  const evidenceRows=[...observed.values()]
  // Prefer unfamiliar questions from this browser's perspective; do not infer ability.
  const pool=[...byId.values()].sort((a,b)=>Number(observed.has(a.questionId))-Number(observed.has(b.questionId)) || a.year-b.year ||
    a.questionId.localeCompare(b.questionId,'zh-Hant'))
  const questionIds=pool.slice(0,Math.min(count,10)).map(q=>q.questionId)
  const task={id,status:'offered',title:'題庫本機練習組',reason:'從指定範圍選一小組，優先安排本瀏覽器尚無作答紀錄的題目。不以這些資料判定弱項。',
    createdAt:now,scope:{yearFrom,yearTo},questionIds,estimatedMinutes:questionIds.length*2,
    completionRule:'接受後，每題有一次可核對的評分便計入進度；不代表已精熟。',
    evidence:{status:'insufficient_evidence',distinctQuestions:evidenceRows.filter(e=>e.scoreStatus==='graded').length,
      excludedQuestions:evidenceRows.filter(e=>e.scoreStatus!=='graded').length}}
  return {task,state:{...state,tasks:[...state.tasks,task],requests:[...state.requests,requestId]}}
}
export function chooseTask(state,id,choice,now=new Date().toISOString()) {
  requireState(state)
  const status={accept:'accepted',defer:'deferred',reject:'rejected'}[choice]
  const task=state.tasks.find(x=>x.id===id)
  if (!task || !status || !validTime(now)) throw new TypeError('Invalid bank task response')
  if (task.status===status) return state
  if (!(task.status==='offered'||(task.status==='deferred'&&choice==='accept'))) return state
  return {...state,tasks:state.tasks.map(x=>x===task?{...x,status,...(choice==='accept'?{acceptedAt:now}:{})}:x)}
}
export function getProgress(state,id) {
  requireState(state)
  const task=state.tasks.find(x=>x.id===id)
  if (!task) throw new TypeError('Unknown bank task')
  const ids=new Set(task.questionIds)
  const done=new Set(task.status!=='accepted'?[]:state.events
    .filter(e=>ids.has(e.questionId) && e.scoreStatus==='graded' && Date.parse(e.occurredAt)>Date.parse(task.acceptedAt)).map(e=>e.questionId))
  const total=ids.size, completed=done.size
  return {completed,total,percent:total?Math.round(completed/total*100):0,complete:total>0&&completed===total}
}
