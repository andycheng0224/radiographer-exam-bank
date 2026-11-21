import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { prepareOnTrackHandoff } from '../src/utils/onTrackHandoff.js'
import { commitQuizSubmission } from '../src/utils/submissionService.js'
import { getExamResult, getLatestSubmittedAnswer, getWrongBookIds, getTodayStats, updateTodayStats } from '../src/utils/storageUtils.js'
import { calculateExamResult } from '../src/utils/quizUtils.js'
import { questionMetadata } from '../src/utils/studyAgentAdapter.js'

const questions = JSON.parse(readFileSync(new URL('../src/data/fiinal_enriched_questions.json', import.meta.url)))
const question = questions.find(q => q.id === '115-1-放射線診斷原理與技術學-048')
const values = new Map()
globalThis.window = {
  __RADIOGRAPHER_CURRENT_USER__: { id: 'isolated-handoff-test' },
  localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
}
const locks = { request: async (_key, _options, run) => run() }

test('real Q48 submission preserves the first wrong answer and hands off once after explicit consent', async () => {
  values.clear()
  const payload = {
    sessionId: 'trial-real-q48', mode: 'practice', subject: question.subject,
    submittedAt: Date.UTC(2026, 10, 19, 10), questionsSnapshot: [question],
    userAnswersSnapshot: { [question.id]: 'C' },
  }
  assert.equal(prepareOnTrackHandoff(payload.sessionId, { consent: true }).status, 'no-committed-receipt')

  const submitted = await commitQuizSubmission(payload, { locks })
  assert.equal(calculateExamResult(submitted.questionsSnapshot, submitted.userAnswersSnapshot).wrongCount, 1)
  assert.equal(getExamResult(question.subject).userAnswersSnapshot[question.id], 'C')
  assert.equal(getLatestSubmittedAnswer(question.id).answer, 'C')
  assert.ok(getWrongBookIds().includes(question.id))
  assert.deepEqual(getTodayStats(), { answeredCount: 1, correctCount: 0, wrongCount: 1 })

  const before = [...values]
  assert.deepEqual(prepareOnTrackHandoff(payload.sessionId, { consent: false }), { status: 'consent-required' })
  assert.deepEqual(prepareOnTrackHandoff(payload.sessionId), { status: 'consent-required' })
  assert.deepEqual([...values], before)
  const { status, bundle } = prepareOnTrackHandoff(payload.sessionId, { consent: true })
  assert.equal(status, 'ready')
  assert.deepEqual([...values], before)
  assert.equal(bundle.events.length, 1)
  const parsed = JSON.parse(JSON.stringify(bundle))
  const [event] = parsed.events
  for (const key of ['question', 'options', 'answer', 'userAnswer', 'userId', 'explanation']) {
    assert.equal(Object.hasOwn(event, key), false)
  }
  assert.equal(event.correct, false)


  const duplicate = await commitQuizSubmission({ ...payload, userAnswersSnapshot: { [question.id]: 'A' } }, { locks })
  assert.equal(duplicate.duplicateSubmission, true)
  assert.equal(getLatestSubmittedAnswer(question.id).answer, 'C')
  assert.deepEqual(prepareOnTrackHandoff(payload.sessionId, { consent: true }).bundle, bundle)
})

test('handoff omits blank answers, preserves stale evidence status and rejects conflicting receipt rows', () => {
  values.clear()
  const row = { id: question.id, answered: true, correct: false, scoreStatus: 'graded' }
  function seed(sessionId, rows) {
    updateTodayStats({
      submissionId: sessionId, submissionPayload: { sessionId, submittedAt: 1000,
        questionKeys: [question.id], studyMetadata: [questionMetadata(question)] },
      gradingReceipt: { version: 'original', rows },
    })
  }
  seed('blank-only', [{ ...row, answered: false }])
  assert.equal(prepareOnTrackHandoff('blank-only', { consent: true }).status, 'no-answered-questions')
  seed('same', [row, row])
  const { bundle } = prepareOnTrackHandoff('same', { consent: true })
  assert.equal(bundle.events.length, 1)
  assert.equal(bundle.events[0].scoreStatus, 'unverified')
  seed('conflicting', [row, { ...row, correct: true }])
  assert.equal(prepareOnTrackHandoff('conflicting', { consent: true }).status, 'invalid-receipt')
})
