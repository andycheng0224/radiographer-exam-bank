// Local draft only: no persistence, network, or question-bank mutation.
export const ISSUE_CATEGORIES = Object.freeze(['question', 'image', 'explanation', 'answer'])

function text(value, name, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new TypeError(`${name} is required and must be at most ${max} characters`)
  }
  return value.trim()
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive integer`)
  return value
}

function officialUrl(value) {
  if (value == null || value === '') return null
  const raw = text(value, 'officialSourceUrl', 2048)
  const url = new URL(raw)
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !['wwwq.moex.gov.tw', 'wwwc.moex.gov.tw', 'www.moex.gov.tw'].includes(url.hostname)) {
    throw new TypeError('officialSourceUrl must be an HTTPS MOEX URL without credentials')
  }
  return url.href
}

export function createQuestionIssueDraft(input) {
  if (!input || !input.question) throw new TypeError('question is required')
  const { question, category } = input
  if (!ISSUE_CATEGORIES.includes(category)) throw new TypeError('unsupported issue category')
  // Explicit allowlist prevents copying answers, learner identity, or progress into a report.
  const reference = Object.freeze({
    questionId: text(question.id, 'question.id', 300),
    year: positiveInteger(question.year, 'question.year'),
    examRound: text(question.exam_round, 'question.exam_round', 40),
    subject: text(question.subject, 'question.subject', 150),
    questionNumber: positiveInteger(question.question_number, 'question.question_number'),
    snapshotId: text(input.snapshotId, 'snapshotId', 200),
    officialSourceUrl: officialUrl(input.officialSourceUrl),
  })
  const imageId = input.imageId == null || input.imageId === '' ? null : text(input.imageId, 'imageId', 300)
  if (imageId && category !== 'image') throw new TypeError('imageId is only allowed for image reports')
  return Object.freeze({
    schemaVersion: 1,
    status: 'local-draft',
    reference,
    category,
    imageId,
    description: text(input.description, 'description', 4000),
    evidence: input.evidence == null || input.evidence === '' ? null : text(input.evidence, 'evidence', 4000),
  })
}

// Revalidate instead of exporting arbitrary properties appended by callers.
export function serializeQuestionIssueDraft(draft) {
  const r = draft?.reference
  if (!r) throw new TypeError('draft reference is required')
  return JSON.stringify(createQuestionIssueDraft({
    question: {id:r.questionId, year:r.year, exam_round:r.examRound, subject:r.subject, question_number:r.questionNumber},
    snapshotId:r.snapshotId, officialSourceUrl:r.officialSourceUrl,
    category:draft.category, imageId:draft.imageId, description:draft.description, evidence:draft.evidence,
  }), null, 2)
}
