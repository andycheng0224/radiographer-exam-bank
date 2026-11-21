import reviewedCorrections from '../data/reviewedAnswerCorrections.json' with { type: 'json' }
// Individually checked against MOEX correction list, printed 115/03/13, page 6.
export const GRADING_VERSION = 'moex-reviewed-20261113-v3'
const LEGACY_115_VERSION = 'moex-115020-20260313-p6-v1'
export const CORRECTION_SOURCE = 'https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx?code=115020&t=A'
const sets = (...acceptedSets) => ({ kind: 'accepted-sets', acceptedSets })
const corrections = new Map([
  ['115-1-醫學物理學與輻射安全-022', sets('B','D','BD')],
  ['115-1-醫學物理學與輻射安全-031', {kind:'all-credit'}],
  ['115-1-醫學物理學與輻射安全-060', {kind:'all-credit'}],
  ['115-1-核子醫學診療原理與技術學-031', sets('C','D','CD')],
  ['115-1-核子醫學診療原理與技術學-052', sets('C')],
])
export function officialCorrection(question) {
  const key = question?.id || question?.questionId
  const reviewed = reviewedCorrections.find(record => record.questionIds.includes(key))
  if (reviewed) return reviewed.version
  if (key === '114-1-放射線診斷原理與技術學-036') return {id:'moex-114020-4309-q36-corrected-v1',authority:'official-correction',revision:1,sourceUrl:'https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx?t=M&code=114020&c=309&s=0603&q=1',page:1,sourceSha256:'f1e86d2a0ea5f1832255cd31e1869a9fd650491b5c028f8a45e51358f89014bf',checkedAt:'2026-11-13',rule:sets('B','C')}
  const rule = corrections.get(key)
  return rule ? { id: LEGACY_115_VERSION, authority: 'official-correction', revision: 20260313, sourceUrl: CORRECTION_SOURCE, page: 6, publishedAt: '2026-03-13', rule } : null
}

export function isCurrentGradingEvidence(question,version) {
  return version===GRADING_VERSION || (version==='moex-reviewed-20261113-v2' && !reviewedCorrections.some(record=>record.version.id!==LEGACY_115_VERSION && record.questionIds.includes(question?.id || question?.questionId))) || (version===LEGACY_115_VERSION && officialCorrection(question)?.id===LEGACY_115_VERSION)
}
