import { retryPendingStorage } from './browserStorage.js'
import { officialCorrection, GRADING_VERSION, isCurrentGradingEvidence } from './officialCorrections.js'
import * as localPlugin from './bankStudyRules.js'
import { readUserScopedStorageValue, writeUserScopedStorageValue, getCommittedSubmissionRecords, getCurrentEffectiveUserId } from './storageUtils.js'
import { EXAM_SUBJECTS } from '../constants/subjects.js'
import { getCanonicalSubjectName, formatExamRoundLabel } from './subjectUtils.js'
import { reliableTags } from './practiceSelection.js'
const KEY = 'radiographer_exam_bank_advice_v1'
let plugin = localPlugin
export function setStudyAgentAdapter(next) { const previous = plugin; plugin = next; return () => { plugin = previous } }
function compatibleState(state) { return state?.version === localPlugin.PLUGIN_VERSION && ['events','tasks','requests'].every(k=>Array.isArray(state[k])) }
export function readStudyState() {
  const state = readUserScopedStorageValue(KEY, null) || localPlugin.createStudyState()
  if (!compatibleState(state)) return {...localPlugin.createStudyState(),hostStateError:'本機插件資料格式不相容；原資料保留，請先匯出備份。'}
  // Old events lack answer text by design. Invalidate uncertain grading evidence instead of guessing a new score.
  return { ...state, events: state.events.map(e => officialCorrection(e) && !isCurrentGradingEvidence(e,state.hostGradingVersions?.[e.eventId]) ? { ...e, scoreStatus: 'unverified' } : e) }
}
function save(state) {
  const old = readUserScopedStorageValue(KEY,null)
  if ((old && !compatibleState(old)) || !compatibleState(state)) throw new Error('插件狀態格式不相容；原紀錄未覆寫。')
  if(writeUserScopedStorageValue(KEY,state)===false) throw new Error('插件紀錄暫存於此分頁，請保留分頁並匯出備份。')
}
export function questionMetadata(question) {
  const subjectId = EXAM_SUBJECTS.find(s => s.name === getCanonicalSubjectName(question.subject))?.slug || question.subject
  const conceptIds = reliableTags(question)
  return { questionId: question.id, subjectId, examId: `${question.year}-${formatExamRoundLabel(question.exam_round)}-${subjectId}`, year: Number(question.year), conceptIds, tagStatus: conceptIds.length ? 'reviewed' : 'unverified' }
}
export function recordSubmissionAttempts(submission, results) {
  let state
  try {
    state = readStudyState()
    if (!plugin?.recordAttempt) return { ok: false, message: '插件未啟用' }
    for (const result of results.filter(q => q.isAnswered)) {
      const { tagStatus, ...metadata } = questionMetadata(result)
      state = plugin.recordAttempt(state, { schemaVersion: 1, ...metadata, eventId: `${submission.sessionId}:${result.id}`, sessionId: submission.sessionId,
        occurredAt: new Date(submission.submittedAt).toISOString(), correct: result.isCorrect, durationMs: 0, scoreStatus: result.scoreStatus }).state
    }
    state = { ...state, hostGradingVersions: { ...state.hostGradingVersions, ...Object.fromEntries(results.filter(q => q.isAnswered).map(q => [`${submission.sessionId}:${q.id}`, GRADING_VERSION])) } }
    save(state); return { ok: true }
  } catch (error) { return { ok: false, message: error.message } }
}
export function requestStudyAdvice(options) { if (!plugin?.requestAdvice) throw new Error('插件未啟用；題庫仍可正常使用。'); const result = plugin.requestAdvice(readStudyState(), options); save(result.state); return result }
export function chooseStudyTask(taskId, choice) { const state = plugin.chooseTask(readStudyState(), taskId, choice); save(state); return state }
export function getStudyProgress(taskId) { try {return plugin.getProgress(readStudyState(), taskId)} catch {return {completed:0,total:0,percent:0,complete:false,unavailable:true}} }
export function selectTaskQuestions(questions, taskId) {
  const task = readStudyState().tasks.find(t => t.id === taskId && t.status === 'accepted')
  if (!task) return []
  const map = new Map(questions.map(q => [q.id,q]))
  return task.questionIds.every(id => map.has(id)) ? task.questionIds.map(id => map.get(id)) : []
}

// Host-owned reconciliation: replay validated metadata into the replaceable plugin.
// Preserve event IDs, timestamps and tasks, so a correction never adds progress.
export function reconcileStudyAttempts(submission, results) {
  try {
    if (!plugin?.createStudyState || !plugin?.recordAttempt) return {ok:false,status:'plugin-unavailable'}
    const state=readUserScopedStorageValue(KEY,null)
    if(!state?.events?.length) return {ok:true,status:'no-events',updated:0}
    const corrections=new Map(results.filter(q=>q.isAnswered && officialCorrection(q)).map(q=>[`${submission.sessionId}:${q.id}`,q]))
    const updates=[]
    const events=state.events.map(event=>{
      const result=corrections.get(event.eventId)
      if(!result || event.questionId!==result.id || event.sessionId!==submission.sessionId || Date.parse(event.occurredAt)!==Number(submission.submittedAt)) return event
      if(state.hostGradingVersions?.[event.eventId]===GRADING_VERSION && event.correct===result.isCorrect && event.scoreStatus===result.scoreStatus) return event
      const next={...event,correct:result.isCorrect,scoreStatus:result.scoreStatus}
      updates.push({eventId:event.eventId,previous:{correct:event.correct,scoreStatus:event.scoreStatus,version:state.hostGradingVersions?.[event.eventId]||'unknown'},next:{correct:next.correct,scoreStatus:next.scoreStatus,version:GRADING_VERSION}})
      return next
    })
    if(!updates.length) return {ok:true,status:'current',updated:0}
    let replay=plugin.createStudyState()
    for(const event of events) replay=plugin.recordAttempt(replay,event).state
    save({...state,events:replay.events,hostGradingVersions:{...state.hostGradingVersions,...Object.fromEntries(updates.map(u=>[u.eventId,GRADING_VERSION]))},hostCorrectionAudit:[...(state.hostCorrectionAudit||[]),...updates]})
    return {ok:true,status:'updated',updated:updates.length}
  } catch(error) {return {ok:false,status:'plugin-error',message:error.message}}
}

// Host policy: an explicit click reuses unfinished work; completed work gets a fresh request.
// The bank rules own local task creation and progress. No external service is consulted.
export function requestNextStudyAdvice(options) {
  if (!plugin?.requestAdvice || !plugin?.getProgress) throw new Error('插件未啟用；題庫仍可正常使用。')
  const state = readStudyState()
  if (state.hostStateError) throw new Error(state.hostStateError)
  const scopeKey = JSON.stringify([options.yearFrom,options.yearTo,options.count ?? 10,[...(options.subjectIds||[])].sort()])
  const available = new Set(options.catalog.map(q=>q.questionId))
  for (const task of [...state.tasks].reverse()) {
    if (!['offered','deferred','accepted'].includes(task.status) || task.scope.yearFrom!==options.yearFrom || task.scope.yearTo!==options.yearTo) continue
    const recordedScope = state.hostRequestScopes?.[task.id]
    if (recordedScope && recordedScope!==scopeKey) continue
    // Older host versions did not save request scope; only reuse the original default all-subject scope.
    if (!recordedScope && ((options.subjectIds||[]).length || (options.count ?? 10)!==10)) continue
    if (task.status==='accepted' && plugin.getProgress(state,task.id).complete) continue
    if (!task.questionIds.every(id=>available.has(id))) return {state,task:null,reused:true,reason:'原任務部分題目暫時不可用；已保留任務，請稍後再試。'}
    return {state,task,reused:true}
  }
  const result = plugin.requestAdvice(state,options)
  const next = result.task ? {...result.state,hostRequestScopes:{...result.state.hostRequestScopes,[result.task.id]:scopeKey}} : result.state
  save(next)
  return {...result,state:next,reused:false}
}

// Replay only committed, user-scoped receipts. Call under withProgressLock (same lock as submit).
// Event presence and its host version are acknowledged in one plugin-state write; receipts remain immutable.
export function flushCommittedStudyAttempts({limit=200} = {}) {
  let pending=0, delivered=0, blocked=0
  try {
    const durability=retryPendingStorage(`__${getCurrentEffectiveUserId()}`)
    if(!durability.ok) return {ok:false,pending:0,delivered:0,blocked:0,status:'storage-volatile',message:'尚有無法持久儲存的紀錄；請保留分頁並匯出備份。'}
    let state=readStudyState()
    if(state.hostStateError) throw new Error(state.hostStateError)
    const known=new Set(state.events.map(e=>e.eventId)), seen=new Set(), versions={...state.hostGradingVersions}
    const cap=Math.max(1,Math.min(500,Number.isInteger(limit)?limit:200))
    for(const {sessionId,payload,receipt} of getCommittedSubmissionRecords()) {
      if(!payload || payload.sessionId!==sessionId || !Number.isFinite(payload.submittedAt) || !Array.isArray(receipt?.rows)) {blocked++;continue}
      const occurredAt=new Date(payload.submittedAt).toISOString()
      for(const row of receipt.rows) {
        if(!row.answered) continue
        const eventId=`${sessionId}:${row.id}`
        if(seen.has(eventId) || known.has(eventId)) continue
        seen.add(eventId)
        const match=/^(\d{3})-([123])-(.+)-(\d{3})$/.exec(row.id)
        if(!match || !payload.questionKeys?.includes(row.id) || typeof row.correct!=='boolean' || !['graded','all-credit','unverified'].includes(row.scoreStatus)) {blocked++;continue}
        const [,year,round,subject]=match
        const canonical=EXAM_SUBJECTS.find(s=>s.name===getCanonicalSubjectName(subject))
        if(!canonical) {blocked++;continue}
        const derived=questionMetadata({id:row.id,year:Number(year),exam_round:round,subject})
        const saved=payload.studyMetadata?.find(q=>q.questionId===row.id)
        // Legacy receipts have no approved concepts; never infer them from old AI tags.
        const conceptIds=saved && saved.subjectId===derived.subjectId && saved.examId===derived.examId && saved.year===derived.year && saved.tagStatus==='reviewed' && Array.isArray(saved.conceptIds) ? saved.conceptIds : []
        const event={schemaVersion:1,questionId:row.id,subjectId:derived.subjectId,examId:derived.examId,year:derived.year,conceptIds,
          eventId,sessionId,occurredAt,correct:row.correct,durationMs:0,
          scoreStatus:officialCorrection({id:row.id})&&!isCurrentGradingEvidence({id:row.id},receipt.version)?'unverified':row.scoreStatus}
        pending++
        if(!plugin?.recordAttempt || delivered>=cap) continue
        const next=plugin.recordAttempt(state,event)?.state
        if(!compatibleState(next) || !next.events.some(e=>e.eventId===eventId && e.sessionId===sessionId && e.questionId===row.id && e.occurredAt===occurredAt)) throw new Error('插件未確認事件；原收據保留待重試。')
        state=next;known.add(eventId);versions[eventId]=receipt.version;delivered++
      }
    }
    if(delivered) save({...state,hostGradingVersions:versions})
    return {ok:pending===delivered && blocked===0,pending:pending-delivered,delivered,blocked,status:blocked?'insufficient-receipts':pending===delivered?'current':plugin?.recordAttempt?'more-pending':'plugin-unavailable'}
  } catch(error) { return {ok:false,pending,delivered:0,blocked,status:'retryable',message:error.message} }
}
