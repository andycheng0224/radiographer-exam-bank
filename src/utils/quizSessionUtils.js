import { readUserScopedStorageValue, writeUserScopedStorageValue } from './storageUtils.js'

const DRAFT_KEYS = {
  exam: 'radiographer_exam_bank_active_quiz',
  review: 'radiographer_exam_bank_active_wrong_review',
}
const sessionKey = (mode, subject, startYear, endYear) => JSON.stringify(mode === 'exam' ? [subject, startYear, endYear] : [subject])
function readSessions(mode) {
  const stored = readUserScopedStorageValue(DRAFT_KEYS[mode], null)
  if (stored?.version === 1 && stored.sessions && typeof stored.sessions === 'object') return stored.sessions
  if (stored?.subject) return { [sessionKey(mode, stored.subject, stored.startYear, stored.endYear)]: stored }
  return {}
}
export function readQuizDraft(mode, subject, startYear, endYear) {
  const draft = readSessions(mode)[sessionKey(mode, subject, startYear, endYear)]
  if (!draft || draft.subject !== subject || !Array.isArray(draft.questionKeys) || !draft.questionKeys.length
    || !draft.answers || typeof draft.answers !== 'object' || Array.isArray(draft.answers)) return null
  if (mode === 'exam' && (draft.startYear !== startYear || draft.endYear !== endYear || !Number.isFinite(draft.deadline))) return null
  return draft
}
export function saveQuizDraft(mode, draft) {
  const sessions = readSessions(mode)
  sessions[sessionKey(mode, draft.subject, draft.startYear, draft.endYear)] = draft
  writeUserScopedStorageValue(DRAFT_KEYS[mode], { version: 1, sessions })
}
export function clearQuizDraft(mode, subject, startYear, endYear) {
  const sessions = readSessions(mode)
  delete sessions[sessionKey(mode, subject, startYear, endYear)]
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
