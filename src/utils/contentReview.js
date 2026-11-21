import reviews from '../data/contentReviews.js'
export function applyContentReview(question) {
  const review = reviews[question?.id]
  if (!review) return question
  // New reviews bind the exact stem/options so a later import cannot silently inherit them.
  if (review.questionSignature && review.questionSignature !== JSON.stringify([question.question,Object.entries(question.options || {})])) {
    return {...question,explanation:question.legacyExplanation ?? null,contentReview:undefined,sourcedTags:[],reviewHoldReason:'source-content-changed'}
  }
  if (question.contentReview?.revision === review.revision) return question
  return {...question,legacyExplanation:question.legacyExplanation ?? question.explanation,
    explanation:review.explanation, contentReview:{revision:review.revision,status:review.status,checkedAt:review.checkedAt,reviewedBy:review.reviewedBy,scope:review.scope},
    sourcedTags:review.sourcedTags,sourceProvenance:{...question.sourceProvenance,...review.sourceProvenance}}
}
