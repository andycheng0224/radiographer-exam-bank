import catalog from '../data/officialPaperSources.js'
import { getCanonicalSubjectName, formatExamRoundLabel } from './subjectUtils.js'
const compact = s => String(s || '').split(/[（(]/)[0].trim()
const byKey = new Map(catalog.papers.map(p => [p.key,p]))
export function officialPaperSource(question) {
  const label = formatExamRoundLabel(question?.exam_round)
  const round = {'第一次':1,'第二次':2,'第三次':3}[label] || label
  const key = `${Number(question?.year)}-${round}-${compact(getCanonicalSubjectName(question?.subject))}`
  return byKey.get(key) || null
}
export function officialQuestionLink(question) {
  const source = officialPaperSource(question)
  if (!source) return { url:'https://wwwq.moex.gov.tw/', direct:false }
  const page = Number(question?.sourceProvenance?.questionPage)
  return { url:source.questionUrl + (Number.isInteger(page) && page > 0 ? `#page=${page}` : ''), direct:true, answerUrl:source.answerUrl, source }
}

// Catalog presence proves an official source exists, not that its content is imported or reviewed.
export const officialPaperYears = [...new Set(catalog.papers.map(p => Number(p.year)))].sort((a,b)=>b-a)
export function unavailableOfficialPapers(questions, {startYear, endYear, subject = '全部科目'}) {
  const present = new Set(questions.map(q => officialPaperSource(q)?.key).filter(Boolean))
  return catalog.papers.filter(p => p.year >= Number(startYear) && p.year <= Number(endYear)
    && (subject === '全部科目' || getCanonicalSubjectName(p.subject) === getCanonicalSubjectName(subject))
    && !present.has(p.key)).map(p => ({...p, roundLabel:formatExamRoundLabel(p.round)}))
}
