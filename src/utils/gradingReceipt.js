import { GRADING_VERSION } from './officialCorrections.js'
export function gradingReceipt(result) {
  const rows = result.perQuestionResults.map(q => ({ id:q.id, answered:q.isAnswered, correct:q.isCorrect, scoreStatus:q.scoreStatus }))
  return { version:GRADING_VERSION, score:result.score, rows,
    answeredCount:rows.filter(q=>q.answered).length,
    correctCount:rows.filter(q=>q.answered && q.correct && q.scoreStatus==='graded').length,
    wrongCount:rows.filter(q=>q.answered && !q.correct).length }
}
export function sameReceipt(a,b) { return JSON.stringify(a) === JSON.stringify(b) }
