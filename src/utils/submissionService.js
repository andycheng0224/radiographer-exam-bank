import { withProgressLock } from './progressLock.js'
import { calculateExamResult } from './quizUtils.js'
import { gradingReceipt } from './gradingReceipt.js'
import { GRADING_VERSION } from './officialCorrections.js'
import { getSubmissionRecord, getExamResult, readUserScopedStorageValue, writeUserScopedStorageValue,
  updateTodayStats, saveExamResult, saveSingleSubjectExamResult, appendTodayWrongQuestions, saveWrongQuestionIds, getQuestionKey } from './storageUtils.js'
import { recordGrowthFromExamSubmission } from './growthUtils.js'
import { applyWrongReviewResults } from './wrongReviewUtils.js'
import { recordSubmissionAttempts, questionMetadata, flushCommittedStudyAttempts } from './studyAgentAdapter.js'
import { clearQuizDraft } from './quizSessionUtils.js'
function duplicateResult(payload, record) {
  const saved = payload.mode === 'review' ? readUserScopedStorageValue('radiographer_exam_bank_wrong_review_result',null) : getExamResult(payload.subject)
  if (saved?.sessionId === payload.sessionId) return {...saved, duplicateSubmission:true}
  const identity = record.payload
  if (!identity || identity.subject !== payload.subject || identity.questionKeys?.join('\n') !== payload.questionsSnapshot.map(getQuestionKey).join('\n')) {
    throw new Error('這份作答已交卷，不會重複計數；原結果快照已不可用，請查看學習紀錄。')
  }
  return {...identity, questionsSnapshot:payload.questionsSnapshot, duplicateSubmission:true,
    submissionNotice:'本份已由另一分頁提交；顯示第一次提交的答案，依目前題目版本重新計分。'}
}
export function commitQuizSubmission(payload, lockOptions) {
  return withProgressLock(() => {
    if (!payload.sessionId || !payload.questionsSnapshot?.length) throw new Error('缺少作答識別，未交卷。')
    const previous = getSubmissionRecord(payload.sessionId)
    if (previous) { flushCommittedStudyAttempts(); return duplicateResult(payload,previous) }
    const result = calculateExamResult(payload.questionsSnapshot,payload.userAnswersSnapshot)
    const keys=new Set(payload.questionsSnapshot.map(getQuestionKey))
    const submitted = {...payload, flaggedKeys:[...new Set((Array.isArray(payload.flaggedKeys)?payload.flaggedKeys:[]).filter(key=>keys.has(key)))], gradingVersion:GRADING_VERSION}
    const {questionsSnapshot, calculatedResult, ...identity} = submitted
    updateTodayStats({submissionId:payload.sessionId, submissionPayload:{...identity,questionKeys:questionsSnapshot.map(getQuestionKey), studyMetadata:questionsSnapshot.map(questionMetadata)},
      gradingReceipt:gradingReceipt(result), answeredCountDelta:result.answeredCount,
      correctCountDelta:result.perQuestionResults.filter(q=>q.isAnswered&&q.isCorrect&&q.scoreStatus!=='all-credit').length,
      wrongCountDelta:result.wrongCount})
    const wrong = result.perQuestionResults.filter(q=>q.status==='wrong')
    if (payload.mode === 'review') {
      submitted.wrongReviewUpdate = applyWrongReviewResults(result.perQuestionResults)
    } else {
      saveSingleSubjectExamResult({sessionId:payload.sessionId,gradingVersion:GRADING_VERSION,subject:payload.subject,
        totalQuestions:result.totalCount,correctCount:result.correctCount,wrongCount:result.wrongCount,unansweredCount:result.unansweredCount,
        masteryAnsweredCount:result.perQuestionResults.filter(q=>q.isAnswered&&q.scoreStatus==='graded').length,
        masteryCorrectCount:result.perQuestionResults.filter(q=>q.isAnswered&&q.isCorrect&&q.scoreStatus==='graded').length,
        score:result.score,elapsedTime:payload.elapsedSeconds,yearRange:payload.yearRange,wrongQuestions:wrong,submittedAt:payload.submittedAt})
      saveWrongQuestionIds(wrong)
    }
    appendTodayWrongQuestions(wrong)
    recordGrowthFromExamSubmission({...submitted,perQuestionResults:result.perQuestionResults})
    const observation = recordSubmissionAttempts(submitted,result.perQuestionResults)
    const replay = flushCommittedStudyAttempts()
    if (!observation.ok || !replay.ok) submitted.studyAgentWarning = '學習插件暫時無法記錄，本次作答結果已保留。'
    if (payload.mode === 'review') writeUserScopedStorageValue('radiographer_exam_bank_wrong_review_result',submitted)
    else saveExamResult(payload.subject,submitted)
    clearQuizDraft(payload.mode === 'review' ? 'review' : 'exam',payload.subject,payload.startYear,payload.endYear,payload.scope,payload.sessionId)
    return submitted
  },lockOptions)
}
