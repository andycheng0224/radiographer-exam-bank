import {
  getReviewHistory,
  writeReviewHistory,
  getQuestionKey,
  getWrongBookItems,
  getWrongBookEntries,
  readUserScopedStorageValue,

  writeUserScopedStorageValue,
} from './storageUtils.js'
import { getCanonicalSubjectName } from './subjectUtils.js'

const WRONG_REVIEW_STATS_KEY = 'radiographer_exam_bank_wrong_review_stats'
const MAX_WRONG_REVIEW_QUESTIONS = 40

function nowIso() {
  return new Date().toISOString()
}

function normalizeStatsMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([questionKey]) => Boolean(questionKey))
      .map(([questionKey, stats]) => {
        const wrongCount = Number(stats?.wrongCount || 0)

        return [
          questionKey,
          {
            attempts: Number(stats?.attempts || 0),
            correctCount: Number(stats?.correctCount || 0),
            wrongCount,
            weight: Math.min(6, Math.max(1, Number(stats?.weight || 1 + Math.min(wrongCount, 5)))),
            lastReviewedAt: stats?.lastReviewedAt || '',
            lastResult: stats?.lastResult === 'correct' ? 'correct' : stats?.lastResult === 'wrong' ? 'wrong' : '',
          },
        ]
      }),
  )
}

export function getWrongReviewStats() {
  return normalizeStatsMap(readUserScopedStorageValue(WRONG_REVIEW_STATS_KEY, {}))
}

function writeWrongReviewStats(statsMap) {
  writeUserScopedStorageValue(WRONG_REVIEW_STATS_KEY, normalizeStatsMap(statsMap))
}

function getWrongItemSubject(wrongItem) {
  return getCanonicalSubjectName(wrongItem?.subject || wrongItem?.category || wrongItem?.subjectName || '')
}

export function getWrongReviewSubjectCounts() {
  const counts = new Map()

  getWrongBookItems().forEach((wrongItem) => {
    const subject = getWrongItemSubject(wrongItem)

    if (!subject) {
      return
    }

    counts.set(subject, (counts.get(subject) || 0) + 1)
  })

  return counts
}

export function getWrongItemsBySubject(subject) {
  const targetSubject = getCanonicalSubjectName(subject)
  return getWrongBookItems().filter((wrongItem) => getWrongItemSubject(wrongItem) === targetSubject)
}

function expandWeightedItems(items, statsMap) {
  return items.flatMap((item) => {
    const questionKey = item.questionKey || item.key || getQuestionKey(item)
    const weight = Math.min(6, Math.max(1, Number(statsMap[questionKey]?.weight || 1)))
    return Array.from({ length: weight }, () => item)
  })
}

export function pickWrongReviewItems(items, maxCount = MAX_WRONG_REVIEW_QUESTIONS) {
  const uniqueItems = Array.isArray(items) ? items.filter(Boolean) : []

  if (uniqueItems.length <= maxCount) {
    return uniqueItems
  }

  const statsMap = getWrongReviewStats()
  const selectedMap = new Map()
  const weightedItems = expandWeightedItems(uniqueItems, statsMap)

  while (selectedMap.size < maxCount && weightedItems.length > 0) {
    const pickedIndex = Math.floor(Math.random() * weightedItems.length)
    const pickedItem = weightedItems[pickedIndex]
    const pickedKey = pickedItem.questionKey || pickedItem.key || getQuestionKey(pickedItem)

    if (pickedKey) {
      selectedMap.set(pickedKey, pickedItem)
    }

    weightedItems.splice(pickedIndex, 1)
  }

  return Array.from(selectedMap.values())
}

export function recordWrongReviewAnswer(questionKey, result) {
  if (!questionKey) {
    return getWrongReviewStats()
  }

  const statsMap = getWrongReviewStats()
  const currentStats = statsMap[questionKey] || {
    attempts: 0,
    correctCount: 0,
    wrongCount: 0,
    weight: 1,
    lastReviewedAt: '',
    lastResult: '',
  }
  const isCorrect = result === 'correct'
  const wrongCount = isCorrect ? Number(currentStats.wrongCount || 0) : Number(currentStats.wrongCount || 0) + 1

  statsMap[questionKey] = {
    attempts: Number(currentStats.attempts || 0) + 1,
    correctCount: Number(currentStats.correctCount || 0) + (isCorrect ? 1 : 0),
    wrongCount,
    weight: isCorrect ? 1 : 1 + Math.min(wrongCount, 5),
    lastReviewedAt: nowIso(),
    lastResult: isCorrect ? 'correct' : 'wrong',
  }

  writeWrongReviewStats(statsMap)
  return statsMap
}

export function applyWrongReviewResults(perQuestionResults = []) {
  const statsMap = getWrongReviewStats()
  const currentItems = getWrongBookEntries()
  const activeKeys = new Set(currentItems.filter((item) => item.status !== 'resolved').map(getQuestionKey))
  const removed = new Set()
  const wrongAnswers = new Map()
  const history = getReviewHistory()
  const now = nowIso()
  let retainedCount = 0
  for (const item of perQuestionResults) {
    const key = getQuestionKey(item)
    if (!key) continue
    if (item.status !== 'correct') retainedCount += 1
    if (!item.isAnswered || item.scoreStatus === 'all-credit') { if (item.status === 'correct') retainedCount += 1; continue }
    const current = statsMap[key] || {}
    const correct = item.status === 'correct'
    const wrongCount = Number(current.wrongCount || 0) + (correct ? 0 : 1)
    statsMap[key] = { attempts: Number(current.attempts || 0) + 1,
      correctCount: Number(current.correctCount || 0) + (correct ? 1 : 0), wrongCount,
      weight: correct ? 1 : 1 + Math.min(wrongCount, 5), lastReviewedAt: now, lastResult: correct ? 'correct' : 'wrong' }
    if (correct && activeKeys.has(key)) removed.add(key)
    if (!correct) {
      wrongAnswers.set(key, item.userAnswer)
    }
    // A failed answer restarts the review interval; it cannot advance mastery.
    delete history[key]
  }
  // Write each large collection once per submission, not once per question.
  writeWrongReviewStats(statsMap)
  writeReviewHistory(history)
  writeUserScopedStorageValue('radiographer_exam_bank_wrong_book', currentItems.filter((item) => !removed.has(getQuestionKey(item)))
    .map((item) => wrongAnswers.has(getQuestionKey(item)) ? { ...item, userAnswer: wrongAnswers.get(getQuestionKey(item)), answeredAt: Date.now(), reviewResetAt: Date.now() } : item))
  return { removedCount: removed.size, retainedCount }
}
