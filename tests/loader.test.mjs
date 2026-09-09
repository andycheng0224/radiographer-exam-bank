import test from 'node:test'
import assert from 'node:assert/strict'
import { loadQuestionFile, loadQuestionsByKeys, loadQuestionsBySubjectAndYearRange } from '../src/utils/questionDataLoader.js'

const q = { id: '100-1-基礎醫學-001', year: 100, exam_round: '第一次', subject: '基礎醫學', question_number: 1, question: 'test', options: { A: '1', B: '2', C: '3', D: '4' }, answer: 'A' }
let failed = true
let attempts = 0
globalThis.fetch = async (path) => {
  if (path === '/retry.json') { attempts++; if (failed) throw new Error('offline'); return { ok: true, json: async () => [q] } }
  if (path === '/data/question-index.json') return { ok: true, json: async () => [{ subject: '基礎醫學', year: 100, questionCount: 1, filePath: '/missing.json' }] }
  if (path === '/data/question-key-map.json') return { ok: true, json: async () => ({ [q.id]: '/retry.json' }) }
  return { ok: false, status: 503 }
}
test('transient failures are retryable and never cached as an empty bank', async () => {
  await assert.rejects(loadQuestionFile('/retry.json'))
  failed = false
  assert.equal((await loadQuestionFile('/retry.json')).length, 1)
  assert.equal(attempts, 2)
})
test('missing year chunks report a failure instead of silently changing the exam pool', async () => {
  await assert.rejects(loadQuestionsBySubjectAndYearRange('基礎醫學', 100, 100))
})
test('key lookup accepts encoded IDs and malformed percent input without throwing', async () => {
  assert.equal((await loadQuestionsByKeys([encodeURIComponent(q.id)]))[0].id, q.id)
  assert.deepEqual(await loadQuestionsByKeys(['bad%key']), [])
})
