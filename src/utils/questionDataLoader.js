import { applyContentReview } from './contentReview.js'
import supplements from '../data/verifiedSupplements.js'
import { EXAM_SUBJECTS } from '../constants/subjects.js'
import { getQuestionKey } from './storageUtils.js'
import { normalizeQuestionKey, safeDecodeURIComponent } from './subjectUtils.js'

const QUESTION_INDEX_PATH = '/data/question-index.json'
const QUESTION_KEY_MAP_PATH = '/data/question-key-map.json'
const QUESTION_INDEX_CACHE_KEY = 'radiographer_exam_bank_question_index_cache_v1'

const memoryCache = {
  questionIndex: null,
  questionIndexPromise: null,
  questionKeyMap: null,
  questionKeyMapPromise: null,
  fileMap: new Map(),
  filePromiseMap: new Map(),
}

const SUBJECT_ALIAS_MAP = new Map(
  EXAM_SUBJECTS.flatMap((subject) =>
    [subject.name, ...subject.sourceSubjects].map((alias) => [normalizeText(alias), subject.name]),
  ),
)

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[（）]/g, (char) => (char === '（' ? '(' : ')'))
    .replace(/\s+/g, '')
    .trim()
}

function canUseStorage() {
  try { return typeof window !== 'undefined' && Boolean(window.localStorage) } catch { return false }
}

function readCachedQuestionIndex() {
  if (!canUseStorage()) {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(QUESTION_INDEX_CACHE_KEY)
    const parsed = rawValue ? JSON.parse(rawValue) : null
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeCachedQuestionIndex(index) {
  if (!canUseStorage()) {
    return
  }

  try {
    window.localStorage.setItem(QUESTION_INDEX_CACHE_KEY, JSON.stringify(index))
  } catch {
    // Ignore storage write failures to avoid breaking runtime.
  }
}

async function fetchJson(path) {
  const response = await fetch(path, {
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`)
  }

  return response.json()
}

export function normalizeExamSubject(subject = '') {
  const normalizedValue = normalizeText(subject)

  if (!normalizedValue) {
    return ''
  }

  if (SUBJECT_ALIAS_MAP.has(normalizedValue)) {
    return SUBJECT_ALIAS_MAP.get(normalizedValue)
  }

  const compactValue = normalizedValue.replace(/\(.+\)/, '')

  for (const [alias, canonicalSubject] of SUBJECT_ALIAS_MAP.entries()) {
    const compactAlias = alias.replace(/\(.+\)/, '')

    if (
      normalizedValue === alias ||
      normalizedValue.includes(alias) ||
      alias.includes(normalizedValue) ||
      compactValue === compactAlias ||
      compactValue.includes(compactAlias) ||
      compactAlias.includes(compactValue)
    ) {
      return canonicalSubject
    }
  }

  return subject
}

export async function getQuestionIndex() {
  if (memoryCache.questionIndex) {
    return memoryCache.questionIndex
  }

  if (!memoryCache.questionIndexPromise) {
    memoryCache.questionIndexPromise = (async () => {
      const cachedIndex = readCachedQuestionIndex()

      try {
        const fetchedIndex = await fetchJson(QUESTION_INDEX_PATH)
        if (!Array.isArray(fetchedIndex) || !fetchedIndex.length || fetchedIndex.some((entry) => !entry?.filePath || !entry?.subject || !Number.isFinite(Number(entry.year)))) throw new Error('Invalid question index')
        memoryCache.questionIndex = fetchedIndex
        writeCachedQuestionIndex(memoryCache.questionIndex)
      } catch (error) {
        if (!Array.isArray(cachedIndex) || !cachedIndex.length) throw error
        memoryCache.questionIndex = cachedIndex
      }

      return memoryCache.questionIndex
    })().finally(() => {
      memoryCache.questionIndexPromise = null
    })
  }

  return memoryCache.questionIndexPromise
}

export async function preloadSubjectMetadata() {
  return getQuestionIndex()
}

async function getQuestionKeyMap() {
  if (memoryCache.questionKeyMap) {
    return memoryCache.questionKeyMap
  }

  if (!memoryCache.questionKeyMapPromise) {
    memoryCache.questionKeyMapPromise = fetchJson(QUESTION_KEY_MAP_PATH)
      .then((data) => {
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid question key map')
        memoryCache.questionKeyMap = data
        return memoryCache.questionKeyMap
      })
      .finally(() => {
        memoryCache.questionKeyMapPromise = null
      })
  }

  return memoryCache.questionKeyMapPromise
}

export async function loadQuestionFile(filePath) {
  if (!filePath) {
    return []
  }

  if (memoryCache.fileMap.has(filePath)) {
    return memoryCache.fileMap.get(filePath)
  }

  if (!memoryCache.filePromiseMap.has(filePath)) {
    memoryCache.filePromiseMap.set(
      filePath,
      fetchJson(filePath)
        .then((data) => {
          if (!Array.isArray(data) || data.some((question) => !question?.id || !question?.question || !question?.options || !question?.answer)) throw new Error('Invalid question file')
          const extra = supplements.filter(q => data.some(old => Number(old.year) === q.year && normalizeExamSubject(old.subject) === normalizeExamSubject(q.subject)) && !data.some(old => old.id === q.id))
          const normalizedData = [...data, ...extra].map(applyContentReview)
          memoryCache.fileMap.set(filePath, normalizedData)
          return normalizedData
        })
        .finally(() => {
          memoryCache.filePromiseMap.delete(filePath)
        }),
    )
  }

  return memoryCache.filePromiseMap.get(filePath)
}

export async function loadQuestionsBySubjectAndYearRange(subject, startYear, endYear) {
  const questionIndex = await getQuestionIndex()
  const normalizedSubject = normalizeExamSubject(subject)
  const safeStartYear = Number(startYear)
  const safeEndYear = Number(endYear)

  const fileEntries = questionIndex.filter((entry) => {
    const entryYear = Number(entry.year)
    return (
      (!subject || subject === '全部科目' || normalizeExamSubject(entry.subject) === normalizedSubject) &&
      (!Number.isFinite(safeStartYear) || entryYear >= safeStartYear) &&
      (!Number.isFinite(safeEndYear) || entryYear <= safeEndYear)
    )
  })

  const files = await Promise.all(fileEntries.map((entry) => loadQuestionFile(entry.filePath)))
  return files.flat()
}

export async function loadQuestionsByKeys(questionKeys = []) {
  const keys = [...new Set(questionKeys.filter(Boolean))]

  if (keys.length === 0) {
    return []
  }

  const keyMap = await getQuestionKeyMap()
  const resolvedPaths = [...new Set(
    keys
      .map((key) => keyMap[key] || keyMap[safeDecodeURIComponent(key)] || keyMap[normalizeQuestionKey(key)])
      .filter(Boolean),
  )]

  const files = await Promise.all(resolvedPaths.map((filePath) => loadQuestionFile(filePath)))
  const questionMap = new Map()
  for (const question of files.flat()) {
    questionMap.set(question.id, question)
    questionMap.set(getQuestionKey(question), question)
    questionMap.set(normalizeQuestionKey(question), question)
  }
  return keys.map((key) => questionMap.get(key) || questionMap.get(safeDecodeURIComponent(key)) || questionMap.get(normalizeQuestionKey(key))).filter(Boolean)
}

export async function getQuestionByKey(questionKey) {
  if (!questionKey) {
    return null
  }

  const [question] = await loadQuestionsByKeys([questionKey])
  return question || null
}
