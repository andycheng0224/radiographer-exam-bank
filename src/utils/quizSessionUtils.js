import { readUserScopedStorageValue, writeUserScopedStorageValue, getSubmissionRecord } from './storageUtils.js'

const DRAFT_KEYS = {
  exam: 'radiographer_exam_bank_active_quiz',
  review: 'radiographer_exam_bank_active_wrong_review',
}
const sessionKey = (mode, subject, startYear, endYear, scope) => scope ? JSON.stringify([subject, startYear, endYear, scope]) : JSON.stringify(mode === 'exam' ? [subject, startYear, endYear] : [subject])
function readSessions(mode) {
  const stored = readUserScopedStorageValue(DRAFT_KEYS[mode], null)
  if (stored?.version === 1 && stored.sessions && typeof stored.sessions === 'object') return stored.sessions
  if (stored?.subject) return { [sessionKey(mode, stored.subject, stored.startYear, stored.endYear)]: stored }
  return {}
}
export function readQuizDraft(mode, subject, startYear, endYear, scope) {
  const draft = readSessions(mode)[sessionKey(mode, subject, startYear, endYear, scope)]
  if (getSubmissionRecord(draft?.sessionId)) return null
  if (!draft || draft.subject !== subject || !Array.isArray(draft.questionKeys) || !draft.questionKeys.length
    || !draft.answers || typeof draft.answers !== 'object' || Array.isArray(draft.answers)) return null
  if (mode === 'exam' && (draft.startYear !== startYear || draft.endYear !== endYear || !Number.isFinite(draft.deadline))) return null
  return draft
}
export function saveQuizDraft(mode, draft) {
  if (getSubmissionRecord(draft.sessionId)) return false
  const sessions = readSessions(mode)
  sessions[sessionKey(mode, draft.subject, draft.startYear, draft.endYear, draft.scope)] = draft
  writeUserScopedStorageValue(DRAFT_KEYS[mode], { version: 1, sessions })
}
export function clearQuizDraft(mode, subject, startYear, endYear, scope, expectedSessionId) {
  const sessions = readSessions(mode)
  const key = sessionKey(mode, subject, startYear, endYear, scope)
  if (expectedSessionId && sessions[key]?.sessionId !== expectedSessionId) return false
  delete sessions[key]
  writeUserScopedStorageValue(DRAFT_KEYS[mode], { version: 1, sessions })
}
export function getRemainingSeconds(deadline, now = Date.now()) {
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}
export function restoreDraftQuestions(draft, questions) {
  if (!draft || new Set(draft.questionKeys).size !== draft.questionKeys.length) return []
  const byKey = new Map(questions.map((question) => [question.id || question.questionKey || question.key, question]))
  const restored = draft.questionKeys.map((key) => byKey.get(key))
  return restored.every(Boolean) ? restored : []
}

export function newSessionId() { return globalThis.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(36).slice(2)}` }
export function restoreAnswers(draft, questions) {
  const keys = new Set(questions.map(q => q.id || q.questionKey || q.key))
  return Object.fromEntries(Object.entries(draft?.answers || {}).filter(([key, answer]) => keys.has(key) && typeof answer === 'string' && /^[A-D]{1,4}$/.test(answer)))
}

// Catalog updates must not silently discard an unfinished attempt.
export function getDraftRestorePlan(draft, available, expectedCount) {
  if(!draft) return {status:'new',questions:[],catalogChanged:false}
  const questions=restoreDraftQuestions(draft,available)
  if(!questions.length || (expectedCount && questions.length!==expectedCount)) return {status:'unavailable',questions:[],catalogChanged:true}
  return {status:'resume',questions,catalogChanged:questions.length!==available.length}
}
