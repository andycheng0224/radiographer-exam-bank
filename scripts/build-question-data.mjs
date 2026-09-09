import { mkdir, readFile, writeFile, readdir, stat, rm } from 'node:fs/promises'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { EXAM_SUBJECTS } from '../src/constants/subjects.js'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const sourceQuestionsPath = path.join(projectRoot, 'src', 'data', 'fiinal_enriched_questions.json')
const sourceUploadsDir = path.join(projectRoot, 'src', 'uploads')
const publicDataDir = path.join(projectRoot, 'public', 'data')
const publicQuestionsDir = path.join(publicDataDir, 'questions')
const publicUploadsDir = path.join(projectRoot, 'public', 'uploads')

const subjects = EXAM_SUBJECTS

const subjectAliasMap = new Map(
  subjects.flatMap((subject) =>
    [subject.name, ...subject.sourceSubjects].map((alias) => [normalizeText(alias), subject]),
  ),
)

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[（）]/g, (char) => (char === '（' ? '(' : ')'))
    .replace(/\s+/g, '')
    .trim()
}

function getCanonicalSubject(subjectName = '') {
  const normalizedValue = normalizeText(subjectName)

  if (subjectAliasMap.has(normalizedValue)) {
    return subjectAliasMap.get(normalizedValue)
  }

  for (const [alias, subject] of subjectAliasMap.entries()) {
    const compactAlias = alias.replace(/\(.+\)/, '')
    const compactValue = normalizedValue.replace(/\(.+\)/, '')

    if (
      normalizedValue === alias ||
      normalizedValue.includes(alias) ||
      alias.includes(normalizedValue) ||
      compactValue === compactAlias ||
      compactValue.includes(compactAlias) ||
      compactAlias.includes(compactValue)
    ) {
      return subject
    }
  }

  return null
}

function normalizeRoundValue(value) {
  const normalizedValue = normalizeText(value)

  if (!normalizedValue) {
    return ''
  }

  if (/^(1|01|第一次|第1次|第一梯次|第一回)$/.test(normalizedValue)) {
    return '1'
  }

  if (/^(2|02|第二次|第2次|第二梯次|第二回)$/.test(normalizedValue)) {
    return '2'
  }

  const numericMatch = normalizedValue.match(/\d+/)
  return numericMatch ? String(Number(numericMatch[0])) : normalizedValue
}

function extractQuestionNumber(value) {
  const normalizedValue = normalizeText(value)
  const match = normalizedValue.match(/\d+/)
  return match ? String(Number(match[0])) : ''
}

function buildNormalizedQuestionKey(question) {
  const subject = getCanonicalSubject(question.subject)?.name || question.subject || ''
  const year = String(Number(question.year || 0) || '')
  const round = normalizeRoundValue(question.exam_round || question.examRound || question.session || '')
  const questionNumber = extractQuestionNumber(question.question_number ?? question.questionNumber ?? '')
  return [year, round, subject, questionNumber].filter(Boolean).join('-')
}

function rewriteImagePath(rawPath = '') {
  const normalizedPath = String(rawPath || '').replace(/\\/g, '/').trim()

  if (!normalizedPath) {
    return normalizedPath
  }

  const fileName = normalizedPath.split('/').pop()
  return fileName ? `/uploads/${fileName}` : normalizedPath
}

function rewriteImagePlaceholders(text = '') {
  return String(text || '').replace(/\{\{image:([^}]+)\}\}/g, (_, rawPath) => {
    return `{{image:${rewriteImagePath(rawPath)}}}`
  })
}

function normalizeQuestionRecord(question) {
  const normalizedQuestion = {
    ...question,
    question: rewriteImagePlaceholders(question.question),
  }

  if (normalizedQuestion.options && typeof normalizedQuestion.options === 'object') {
    normalizedQuestion.options = Object.fromEntries(
      Object.entries(normalizedQuestion.options).map(([key, value]) => [key, rewriteImagePlaceholders(value)]),
    )
  }

  if (normalizedQuestion.image?.src) {
    normalizedQuestion.image = {
      ...normalizedQuestion.image,
      src: rewriteImagePath(normalizedQuestion.image.src),
    }
  }

  if (Array.isArray(normalizedQuestion.images)) {
    normalizedQuestion.images = normalizedQuestion.images.map((image) => ({
      ...image,
      path: rewriteImagePath(image.path),
      placeholder: image.placeholder
        ? `{{image:${rewriteImagePath(image.path)}}}`
        : image.placeholder,
    }))
  }

  return normalizedQuestion
}

function hasExplanation(question) {
  return Boolean(
    question.explanation ||
      question.detailedExplanation ||
      question.aiExplanation ||
      question.solution ||
      question.analysis,
  )
}

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true })
}

async function main() {
  const rawQuestions = JSON.parse(await readFile(sourceQuestionsPath, 'utf8'))
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) throw new Error('Question bank is empty')
  const seenIds = new Set()
  const referencedImages = new Set()
  const groupedQuestions = new Map()
  const questionIndex = []
  const questionKeyMap = {}
  const updatedAt = new Date().toISOString()

  for (const rawQuestion of rawQuestions) {
    const canonicalSubject = getCanonicalSubject(rawQuestion.subject)

    if (!canonicalSubject) throw new Error(`Unknown subject: ${rawQuestion.id}`)
    if (!rawQuestion.id || seenIds.has(rawQuestion.id)) throw new Error(`Duplicate/missing question id: ${rawQuestion.id}`)
    seenIds.add(rawQuestion.id)
    if (!rawQuestion.question || !rawQuestion.answer || !['A', 'B', 'C', 'D'].every((key) => typeof rawQuestion.options?.[key] === 'string' && rawQuestion.options[key].trim())) throw new Error(`Invalid question: ${rawQuestion.id}`)

    const normalizedQuestion = normalizeQuestionRecord(rawQuestion)
    const year = Number(normalizedQuestion.year)
    if (!Number.isInteger(year) || year < 100 || year > 115) throw new Error(`Invalid year: ${rawQuestion.id}`)
    for (const match of JSON.stringify(normalizedQuestion).matchAll(/\{\{image:([^}]+)\}\}/g)) referencedImages.add(match[1].split('/').pop())
    if (normalizedQuestion.image?.src) referencedImages.add(normalizedQuestion.image.src.split('/').pop())
    for (const image of normalizedQuestion.images || []) if (image.path) referencedImages.add(image.path.split('/').pop())
    const filePath = `/data/questions/${canonicalSubject.slug}/${year}.json`
    const mapKey = normalizedQuestion.id || buildNormalizedQuestionKey(normalizedQuestion)
    const normalizedMapKey = buildNormalizedQuestionKey(normalizedQuestion)

    if (!groupedQuestions.has(filePath)) {
      groupedQuestions.set(filePath, {
        subject: canonicalSubject.name,
        subjectSlug: canonicalSubject.slug,
        year,
        filePath,
        questions: [],
      })
    }

    groupedQuestions.get(filePath).questions.push(normalizedQuestion)

    if (mapKey) {
      questionKeyMap[mapKey] = filePath
    }

    if (normalizedMapKey) {
      questionKeyMap[normalizedMapKey] = filePath
    }
  }

  await ensureDir(publicQuestionsDir)

  const groupedEntries = [...groupedQuestions.values()].sort((left, right) => {
    if (left.subject === right.subject) {
      return left.year - right.year
    }

    return left.subject.localeCompare(right.subject, 'zh-Hant')
  })

  for (const entry of groupedEntries) {
    const targetDir = path.join(publicQuestionsDir, entry.subjectSlug)
    const targetFile = path.join(targetDir, `${entry.year}.json`)

    await ensureDir(targetDir)
    await writeFile(targetFile, JSON.stringify(entry.questions), 'utf8')

    questionIndex.push({
      subject: entry.subject,
      subjectSlug: entry.subjectSlug,
      year: entry.year,
      questionCount: entry.questions.length,
      filePath: entry.filePath,
      hasExplanation: entry.questions.some(hasExplanation),
      updatedAt,
    })
  }

  await writeFile(
    path.join(publicDataDir, 'question-index.json'),
    JSON.stringify(questionIndex, null, 2),
    'utf8',
  )
  await writeFile(
    path.join(publicDataDir, 'question-key-map.json'),
    JSON.stringify(questionKeyMap),
    'utf8',
  )

  // Validate references before replacing any generated assets.
  await Promise.all([...referencedImages].map((name) => stat(path.join(sourceUploadsDir, name))))
  await ensureDir(publicUploadsDir)
  const imageNames = [...referencedImages]
  for (let offset = 0; offset < imageNames.length; offset += 1) {
      const name = imageNames[offset]
      const source = path.join(sourceUploadsDir, name)
      const target = path.join(publicUploadsDir, name)
      const sourceBytes = readFileSync(source)
      if (!sourceBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        throw new Error(`Expected browser-compatible PNG: ${name}. Normalize source image formats before building.`)
      }
      let targetBytes = null
      try { targetBytes = readFileSync(target) } catch (error) { if (error.code !== 'ENOENT') throw error }
      if (!targetBytes || !sourceBytes.equals(targetBytes)) {
        writeFileSync(target, sourceBytes)
      }
    if (offset % 2048 === 0) console.log(`[build:data] images ${offset + 1}/${imageNames.length}`)
  }
  for (const entry of await readdir(publicUploadsDir, { withFileTypes: true })) {
    if (entry.isFile() && !referencedImages.has(entry.name)) await rm(path.join(publicUploadsDir, entry.name))
  }

  console.log(`[build:data] wrote ${questionIndex.length} data files to public/data/questions`)
  console.log(`[build:data] question index entries: ${questionIndex.length}`)
  console.log(`[build:data] question key map entries: ${Object.keys(questionKeyMap).length}`)
  console.log(`[build:data] ${referencedImages.size} referenced images synced to public/uploads`)
}

main().catch((error) => {
  console.error('[build:data] failed', error)
  process.exit(1)
})
