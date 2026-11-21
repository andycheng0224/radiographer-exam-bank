import reviews from './contentReviews.js'
// Author-written summaries only. No publisher PDF text, embeddings or quarantine ingestion.
export default Object.entries(reviews).map(([questionId,review])=>({
  id:review.revision,questionId,year:Number(questionId.split('-')[0]),subject:questionId.split('-').slice(2,-1).join('-'),
  title:review.explanation.testedConcept,
  text:[review.explanation.background,...review.explanation.reasoningSteps,review.explanation.confusingConcepts].join('\n'),
  sourceUrl:review.explanation.sourceUrl,page:review.explanation.sourcePage,sourceCitation:review.explanation.sourceCitation,
  scope:review.scope,status:review.status,usePolicy:'local-authored-summary',reviewedBy:review.reviewedBy,
  tags:(review.sourcedTags||[]).map(tag=>tag.label)
}))
