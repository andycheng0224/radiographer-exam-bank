import { officialCorrection, isCurrentGradingEvidence } from './officialCorrections.js'
import { getSubmissionRecord } from './storageUtils.js'

export const HANDOFF_FORMAT = 'radiographer-exam-bank/ontrack-attempts'

const validId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200

export function prepareOnTrackHandoff(sessionId, { consent = false } = {}) {
  if (consent !== true) return { status: 'consent-required' }
  const record = getSubmissionRecord(sessionId)
  const { payload, receipt } = record || {}
  if (!validId(sessionId) || payload?.sessionId !== sessionId ||
      !Number.isFinite(payload.submittedAt) || !Array.isArray(receipt?.rows) ||
      !Array.isArray(payload.questionKeys) || !Array.isArray(payload.studyMetadata) ||
      typeof receipt.version !== 'string') return { status: 'no-committed-receipt' }

  const submittedAt = new Date(payload.submittedAt)
  if (Number.isNaN(submittedAt.getTime())) return { status: 'invalid-receipt' }
  const questionKeys = new Set(payload.questionKeys)
  const metadataById = new Map(payload.studyMetadata.map(item => [item?.questionId, item]))
  const events = new Map()
  for (const row of receipt.rows) {
    if (row?.answered !== true) continue
    const questionId = row.id
    const meta = metadataById.get(questionId)
    const eventId = `${sessionId}:${questionId}`
    if (!validId(questionId) || !validId(eventId) || !questionKeys.has(questionId) ||
        !validId(meta?.subjectId) || !validId(meta.examId) ||
        !Number.isInteger(meta.year) || meta.year < 1 || meta.year > 9999 ||
        typeof row.correct !== 'boolean' ||
        !['graded', 'all-credit', 'unverified'].includes(row.scoreStatus)) {
      return { status: 'invalid-receipt' }
    }

    const conceptIds = meta.tagStatus === 'reviewed' ? meta.conceptIds : []
    if (!Array.isArray(conceptIds) || conceptIds.length > 30 || !conceptIds.every(validId)) {
      return { status: 'invalid-receipt' }
    }
    const stale = officialCorrection({ id: questionId }) &&
      !isCurrentGradingEvidence({ id: questionId }, receipt.version)
    const event = {
      schemaVersion: 1,
      eventId,
      sessionId,
      questionId,
      occurredAt: submittedAt.toISOString(),
      subjectId: meta.subjectId,
      examId: meta.examId,
      year: meta.year,
      conceptIds: [...new Set(conceptIds)].sort(),
      correct: row.correct,
      durationMs: 0,
      scoreStatus: stale ? 'unverified' : row.scoreStatus,
    }
    if (events.has(eventId) && JSON.stringify(events.get(eventId)) !== JSON.stringify(event)) {
      return { status: 'invalid-receipt' }
    }
    events.set(eventId, event)
  }
  if (!events.size) return { status: 'no-answered-questions' }
  return {
    status: 'ready',
    bundle: { format: HANDOFF_FORMAT, schemaVersion: 1, gradingVersion: receipt.version,
      events: [...events.values()] },
  }
}
