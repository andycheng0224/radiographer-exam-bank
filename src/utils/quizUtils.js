import { normalizeSelection, parseAnswerRule, getAnswerRule, acceptsSelection, answerRuleLabel } from './answerRules.js'
import {
  EXAM_FULL_SCORE,
  EXAM_QUESTION_COUNT,
  PASSING_SCORE,
} from '../constants/subjects.js'
import { getQuestionKey } from './storageUtils.js'

export const QUIZ_LENGTH = EXAM_QUESTION_COUNT

export const normalizeAnswer = normalizeSelection

function getAnswerMapKey(question, index) {
  return getQuestionKey(question) || question?.id || String(index)
}

function getStoredUserAnswer(question, userAnswers, index) {
  const questionKey = getAnswerMapKey(question, index)

  if (Object.prototype.hasOwnProperty.call(userAnswers || {}, questionKey)) {
    return userAnswers[questionKey]
  }

  if (question?.id && Object.prototype.hasOwnProperty.call(userAnswers || {}, question.id)) {
    return userAnswers[question.id]
  }

  if (Object.prototype.hasOwnProperty.call(userAnswers || {}, index)) {
    return userAnswers[index]
  }

  return undefined
}

export function calculateExamResult(questions, userAnswers = {}) {
  const safeQuestions = Array.isArray(questions) ? questions : []
  const perQuestionScore = safeQuestions.length ? EXAM_FULL_SCORE / safeQuestions.length : 0
  const safeUserAnswers = userAnswers && typeof userAnswers === 'object' ? userAnswers : {}

  const perQuestionResults = safeQuestions.map((question, index) => {
    const questionKey = getAnswerMapKey(question, index)
    const rawUserAnswer = getStoredUserAnswer(question, safeUserAnswers, index)
    const normalizedUserAnswer = normalizeAnswer(rawUserAnswer)
    const rule = getAnswerRule(question)
    const correctAnswer = question?.answer ?? question?.correctAnswer ?? answerRuleLabel(question)
    const normalizedCorrectAnswer = String(correctAnswer).trim()
    const isAnswered = normalizedUserAnswer !== ''
    const isCorrect = acceptsSelection(rule, normalizedUserAnswer)
    const status = isCorrect ? 'correct' : !isAnswered ? 'unanswered' : 'wrong'

    return {
      ...question,
      questionKey,
      questionNumber: question?.question_number ?? question?.questionNumber ?? index + 1,
      question: question?.question ?? question?.questionText ?? question?.stem ?? '',
      userAnswer: isAnswered ? normalizedUserAnswer : '',
      correctAnswer: normalizedCorrectAnswer || correctAnswer,
      answer: normalizedCorrectAnswer || correctAnswer,
      isAnswered,
      scoreStatus: rule.kind === 'all-credit' ? 'all-credit' : 'graded',
      answerRule: rule,
      isCorrect,
      status,
    }
  })

  const correctCount = perQuestionResults.filter((item) => item.status === 'correct').length
  const wrongCount = perQuestionResults.filter((item) => item.status === 'wrong').length
  const unansweredCount = perQuestionResults.filter((item) => item.status === 'unanswered').length
  const totalQuestions = perQuestionResults.length
  const score = Number((correctCount * perQuestionScore).toFixed(2))
  const invariant =
    correctCount + wrongCount + unansweredCount === totalQuestions &&
    totalQuestions === perQuestionResults.length

  return {
    answeredCount: perQuestionResults.filter((q) => q.isAnswered).length,
    allCreditCount: perQuestionResults.filter((q) => q.scoreStatus === 'all-credit').length,
    totalQuestions,
    totalCount: totalQuestions,
    correctCount,
    wrongCount,
    unansweredCount,
    score,
    passed: score >= PASSING_SCORE,
    perQuestionResults,
    invariant,
  }
}

function shuffleArray(items) {
  const copiedItems = [...items]

  for (let index = copiedItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copiedItems[index], copiedItems[swapIndex]] = [copiedItems[swapIndex], copiedItems[index]]
  }

  return copiedItems
}

export function generateRandomExamQuestions(questions, count = QUIZ_LENGTH) {
  if (questions.length < count) {
    return []
  }

  return shuffleArray(questions).slice(0, count)
}

export function calculateScore(questions, userAnswers) {
  return calculateExamResult(questions, userAnswers)
}

export function getWrongQuestions(questions, userAnswers) {
  return calculateExamResult(questions, userAnswers).perQuestionResults.filter(
    (question) => question.status === 'wrong',
  )
}

export function formatTime(seconds) {
  const safeSeconds = Math.max(seconds, 0)
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0')
  const remainingSeconds = String(safeSeconds % 60).padStart(2, '0')
  return `${minutes}:${remainingSeconds}`
}

export function getAcceptedAnswers(answer) {
  const rule = parseAnswerRule(answer)
  return rule.kind === 'all-credit' ? ['A','B','C','D'] : [...new Set(rule.acceptedSets.join('').split(''))]
}
export function isAcceptedAnswer(correctAnswer, userAnswer) { return acceptsSelection(parseAnswerRule(correctAnswer), userAnswer) }
export function getAnswerStatus(question, userAnswer, optionKey) {
  const rule = getAnswerRule(question)
  if (rule.kind === 'all-credit' || rule.acceptedSets.some(set => set.includes(optionKey))) return 'correct'
  if (normalizeSelection(userAnswer).includes(optionKey)) return 'wrong'
  return 'default'
}
