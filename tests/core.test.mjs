import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { calculateExamResult, getAcceptedAnswers, generateRandomExamQuestions, getAnswerStatus } from '../src/utils/quizUtils.js'
import { buildQuestionDescriptor, getWrongQuestionDetail, normalizeQuestionKey } from '../src/utils/subjectUtils.js'
import * as storage from '../src/utils/storageUtils.js'
import { clearQuizDraft, getRemainingSeconds, readQuizDraft, restoreDraftQuestions, saveQuizDraft } from '../src/utils/quizSessionUtils.js'
import { applyWrongReviewResults, getWrongReviewStats } from '../src/utils/wrongReviewUtils.js'
import { getDueForReview, recordGrowthFromExamSubmission, getSevenDayGrowthData, getWrongClearanceSummary, isMastered } from '../src/utils/growthUtils.js'

const values = new Map()
let writes = 0
let rejectWrites = false
const fakeStorage = new Proxy({
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => { if (rejectWrites) throw new Error('QuotaExceededError'); writes++; values.set(key, value) },
  removeItem: (key) => values.delete(key),
}, { ownKeys: () => [...values.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) })
globalThis.window = { localStorage: fakeStorage, __RADIOGRAPHER_CURRENT_USER__: { id: 'test' } }
const all = JSON.parse(await readFile(new URL('../src/data/fiinal_enriched_questions.json', import.meta.url), 'utf8'))
const questions = all.slice(0, 80)
const key = storage.getQuestionKey
function reset(id = 'test') { values.clear(); writes = 0; window.__RADIOGRAPHER_CURRENT_USER__ = { id } }

test('all 13,598 records have unique keys and usable single-choice options/answer rules', () => {
  assert.equal(new Set(all.map(key)).size, all.length)
  for (const question of all) {
    assert.deepEqual(Object.keys(question.options).sort(), ['A', 'B', 'C', 'D'])
    assert.ok(getAcceptedAnswers(question.answer).length, question.id)
    const answers = Object.fromEntries([[key(question), getAcceptedAnswers(question.answer).at(-1)]])
    assert.equal(calculateExamResult([question], answers).correctCount, 1, question.id)
  }
})
test('80-question scoring preserves correct/wrong/unanswered counts and score', () => {
  const answers = Object.fromEntries(questions.slice(0, 60).map((q) => [key(q), q.answer]))
  for (const q of questions.slice(60, 70)) answers[key(q)] = ['A','B','C','D'].find((answer) => answer !== q.answer)
  const result = calculateExamResult(questions, answers)
  assert.deepEqual([result.correctCount, result.wrongCount, result.unansweredCount, result.score], [60, 10, 10, 75])
  assert.ok(result.invariant)
})
test('multiple accepted answers and bonus answers stay intact in review', () => {
  const q = { ...questions[0], answer: 'B,D,BD' }
  const result = calculateExamResult([q], { [q.id]: 'D' })
  assert.equal(result.correctCount, 1)
  assert.equal(result.perQuestionResults[0].answer, 'B,D,BD')
  assert.equal(getAnswerStatus(q, 'A', 'D'), 'correct')
  assert.equal(getAnswerStatus(q, 'A', 'A'), 'wrong')
  assert.equal(calculateExamResult([{ ...q, answer: '送分' }], { [q.id]: 'C' }).correctCount, 1)
  assert.equal(calculateExamResult([q], {}).unansweredCount, 1)
})
test('random exams are 80 unique questions and do not mutate bank', () => {
  const before = questions.map(key)
  assert.equal(new Set(generateRandomExamQuestions(all).map(key)).size, 80)
  assert.deepEqual(questions.map(key), before)
  assert.deepEqual(generateRandomExamQuestions(questions.slice(0, 10)), [])
})
test('detail lookup does not match undefined IDs or the wrong exam round', () => {
  const target = questions[12]
  assert.equal(getWrongQuestionDetail({ id: target.id }, questions).id, target.id)
  assert.equal(getWrongQuestionDetail({ id: '115-2-基礎醫學-080' }, questions), null)
  const descriptor = buildQuestionDescriptor({ key: target.id })
  assert.equal(descriptor.year, '100')
  assert.equal(descriptor.round, '1')
  assert.equal(descriptor.questionNumber, '13')
  assert.doesNotThrow(() => normalizeQuestionKey('bad%key'))
})
test('scoped progress, legacy claims, and clear only affect the selected user', () => {
  reset('alice')
  values.set('radiographer_exam_bank_daily_goal', '80')
  assert.equal(storage.getDailyGoal(), 80)
  storage.saveExamResult('基礎醫學', { questions, answers: {} })
  storage.writeUserScopedStorageValue('radiographer_exam_bank_wrong_review_stats', { q: { wrongCount: 2 } })
  window.__RADIOGRAPHER_CURRENT_USER__ = { id: 'bob' }
  assert.equal(storage.getDailyGoal(), 40)
  storage.setDailyGoal(20)
  storage.clearCurrentUserProgress('alice')
  assert.equal(storage.getDailyGoal(), 20)
  window.__RADIOGRAPHER_CURRENT_USER__ = { id: 'alice' }
  assert.equal(storage.getDailyGoal(), 40)
  assert.ok(![...values.keys()].some((k) => k.includes('exam_result:') && k.endsWith('__alice')))
  assert.ok(![...values.keys()].some((k) => k.includes('wrong_review_stats') && k.endsWith('__alice')))
})
test('result persistence stores one question snapshot and survives recalculation', () => {
  reset()
  const answers = { [questions[0].id]: questions[0].answer }
  const calculatedResult = calculateExamResult(questions, answers)
  storage.saveExamResult('基礎醫學', { questions, questionsSnapshot: questions, answers, userAnswersSnapshot: answers, calculatedResult, perQuestionResults: calculatedResult.perQuestionResults, summary: calculatedResult })
  const saved = storage.getExamResult('基礎醫學')
  assert.equal(saved.calculatedResult, undefined)
  assert.equal(saved.questions, undefined)
  assert.equal(calculateExamResult(saved.questionsSnapshot, saved.userAnswersSnapshot).correctCount, 1)
})
test('malformed JSON and invalid year settings recover safely', () => {
  reset()
  values.set(storage.getScopedStorageKey('radiographer_exam_bank_daily_goal'), '{broken')
  assert.equal(storage.getDailyGoal(), 40)
  assert.deepEqual(storage.setPracticeYearRange({ startYear: 'bad', endYear: 110 }), { startYear: 100, endYear: 110 })
  assert.deepEqual(storage.setPracticeYearRange({ startYear: 115, endYear: 100 }), { startYear: 115, endYear: 115 })
})
test('quiz drafts restore same order and deadline after reload', () => {
  reset()
  const draft = { subject: '基礎醫學', startYear: 100, endYear: 115, deadline: 100000, questionKeys: questions.map(key), answers: { [questions[0].id]: 'B' }, currentIndex: 15 }
  saveQuizDraft('exam', draft)
  assert.deepEqual(restoreDraftQuestions(readQuizDraft('exam', '基礎醫學', 100, 115), all).map(key), draft.questionKeys)
  assert.equal(readQuizDraft('exam', '放射線器材學', 100, 115), null)
  assert.equal(getRemainingSeconds(100000, 94001), 6)
  assert.equal(getRemainingSeconds(100000, 110000), 0)
})
test('review submission removes correct answers, retains wrong and unanswered, updates growth', () => {
  reset()
  const [correct, wrong, unanswered] = questions
  storage.saveWrongQuestionIds([correct, wrong, unanswered])
  const answers = { [correct.id]: correct.answer, [wrong.id]: ['A','B','C','D'].find((a) => a !== wrong.answer) }
  const result = calculateExamResult([correct, wrong, unanswered], answers)
  const update = applyWrongReviewResults(result.perQuestionResults)
  assert.deepEqual(update, { removedCount: 1, retainedCount: 2 })
  assert.deepEqual(storage.getWrongBookIds(), [wrong.id, unanswered.id])
  assert.equal(storage.getWrongBookItems()[0].userAnswer, answers[wrong.id])
  assert.equal(getWrongReviewStats()[wrong.id].weight, 2)
  assert.equal(storage.getTodayReviewedQuestionCount(), 2)
  recordGrowthFromExamSubmission({ mode: 'review', submittedAt: Date.now(), perQuestionResults: result.perQuestionResults })
  assert.equal(getSevenDayGrowthData().totalAnswered, 2)
  assert.equal(getWrongClearanceSummary().clearedCount, 1)
})
test('large review batches write collections once, without quadratic per-question writes', () => {
  reset()
  storage.saveWrongQuestionIds(questions)
  writes = 0
  applyWrongReviewResults(calculateExamResult(questions, Object.fromEntries(questions.map((q) => [q.id, q.answer]))).perQuestionResults)
  assert.ok(writes <= 5, `${writes} storage writes`)
})
test('due review calculation reads shared state once for large wrong books', () => {
  reset()
  storage.saveWrongQuestionIds(all.slice(0, 1000).map((q) => ({ ...q, createdAt: Date.now() - 3 * 86400000 })))
  const started = performance.now()
  assert.equal(getDueForReview().length, 1000)
  assert.ok(performance.now() - started < 1500)
})
test('quota failures keep new progress accessible without deleting prior records', () => {
  reset('quota-test')
  storage.setDailyGoal(80)
  rejectWrites = true
  assert.doesNotThrow(() => storage.setDailyGoal(120))
  assert.equal(storage.getDailyGoal(), 120)
  assert.equal(JSON.parse(values.get(storage.getScopedStorageKey('radiographer_exam_bank_daily_goal'))), 80)
  rejectWrites = false
})
test('blocked localStorage getter does not crash startup or create changing guest IDs', () => {
  window.__RADIOGRAPHER_CURRENT_USER__ = null
  Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('SecurityError') } })
  assert.doesNotThrow(() => storage.getTodayStats())
  const guest = storage.getCurrentEffectiveUserId()
  assert.equal(storage.getCurrentEffectiveUserId(), guest)
  Object.defineProperty(window, 'localStorage', { configurable: true, value: fakeStorage, writable: true })
})

test('failed review resets mastery without discarding resolved records', () => {
  reset()
  const q = questions[0], resolved = questions[1]
  storage.saveWrongQuestionIds([q, resolved])
  storage.updateWrongQuestionStatus(resolved.id, 'resolved')
  storage.writeReviewHistory({ [q.id]: ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06'] })
  const wrongAnswer = ['A','B','C','D'].find((answer) => answer !== q.answer)
  applyWrongReviewResults(calculateExamResult([q], { [q.id]: wrongAnswer }).perQuestionResults)
  assert.equal(isMastered(q.id), false)
  assert.equal(storage.getWrongBookEntries().find((item) => key(item) === resolved.id).status, 'resolved')
  assert.equal(getDueForReview().length, 0)
})

test('switching subjects and ranges preserves independent unfinished sessions', () => {
  reset()
  const draft = { subject: '基礎醫學', startYear: 100, endYear: 115, deadline: 100000, questionKeys: questions.map(key), answers: { [questions[0].id]: 'B' } }
  saveQuizDraft('exam', draft)
  saveQuizDraft('exam', { ...draft, startYear: 110 })
  saveQuizDraft('exam', { ...draft, subject: '放射線器材學' })
  assert.equal(readQuizDraft('exam', '基礎醫學', 100, 115).answers[questions[0].id], 'B')
  clearQuizDraft('exam', '基礎醫學', 110, 115)
  assert.equal(readQuizDraft('exam', '基礎醫學', 110, 115), null)
  assert.ok(readQuizDraft('exam', '基礎醫學', 100, 115))
  assert.ok(readQuizDraft('exam', '放射線器材學', 100, 115))
})

test('manual mastery synchronizes clearance without inventing answered questions', () => {
  reset()
  const q = questions[0]
  storage.saveWrongQuestionIds([q])
  storage.updateWrongQuestionStatus(q.id, 'resolved')
  assert.equal(storage.getWrongBookIds().length, 0)
  assert.equal(isMastered(q.id), true)
  assert.equal(getWrongClearanceSummary().clearedCount, 1)
  assert.equal(getSevenDayGrowthData().totalAnswered, 0)
  storage.updateWrongQuestionStatus(q.id, 'resolved')
  assert.equal(getWrongClearanceSummary().clearedCount, 1)
})
