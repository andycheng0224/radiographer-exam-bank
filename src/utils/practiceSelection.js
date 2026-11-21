import { getCanonicalSubjectName, formatExamRoundLabel } from './subjectUtils.js'

const text = (value) => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim()
function containsTerm(value, term) {
  // English acronyms must not match the middle of unrelated words (CT / function).
  let at = value.indexOf(term)
  while (at !== -1) {
    const before = value[at-1] || '', after = value[at+term.length] || ''
    if ((!/^[a-z0-9]/.test(term) || !/[a-z0-9]/.test(before)) &&
        (!/[a-z0-9]$/.test(term) || !/[a-z0-9]/.test(after))) return true
    at = value.indexOf(term, at+1)
  }
  return false
}
export function paperId(question) {
  const round = formatExamRoundLabel(question.exam_round || question.examRound)
  return question.year && round && question.subject ? JSON.stringify([Number(question.year), round, getCanonicalSubjectName(question.subject)]) : ''
}
export function listPapers(questions) {
  const groups = new Map()
  for (const question of questions) {
    const id = paperId(question)
    if (!id) continue
    if (!groups.has(id)) groups.set(id, { id, year: Number(question.year), round: formatExamRoundLabel(question.exam_round || question.examRound), subject: getCanonicalSubjectName(question.subject), questions: [] })
    groups.get(id).questions.push(question)
  }
  return [...groups.values()].map((paper) => ({ ...paper, missingNumbers: Array.from({length: Math.max(...paper.questions.map(q => Number(q.question_number)))}, (_,i) => i+1).filter(n => !paper.questions.some(q => Number(q.question_number) === n)), questions: paper.questions.sort((a,b) => Number(a.question_number) - Number(b.question_number)) })).sort((a,b) => b.year - a.year || a.round.localeCompare(b.round) || a.subject.localeCompare(b.subject))
}
export function reliableTags(question) {
  return (Array.isArray(question.verifiedTags) ? question.verifiedTags : []).filter((tag) => tag?.label && tag?.source && tag?.reviewedBy && tag?.status === 'approved').map((tag) => tag.label)
}
// Source-aligned classifications are searchable, but are NOT approved plugin concepts.
export function searchableTags(question) {
  return [...new Set([...reliableTags(question), ...(Array.isArray(question.sourcedTags) ? question.sourcedTags : []).filter(t=>t?.label && t.source && t.page && t.status==='source-aligned').map(t=>t.label)])]
}
// Explainable lexical relevance, not semantic inference or medical confidence.
export function questionRelevance(question, keyword) {
  const phrase = text(keyword)
  const terms = [...new Set(phrase.split(' ').filter(Boolean))]
  const clean = value => text(String(value ?? '').replace(/\{\{image:[^}]+\}\}/g, ' '))
  const fields = [
    ['題幹', clean(question.question), 4],
    ['選項', clean(Object.values(question.options || {}).join(' ')), 2],
    ['來源標籤', clean(searchableTags(question).join(' ')), 3],
  ]
  if (!terms.length) return {score:0, matches:[]}
  const matches = fields.filter(([,value]) => terms.some(term => containsTerm(value,term))).map(([label])=>label)
  const score = fields.reduce((sum,[,value,weight]) => sum + weight * (terms.filter(term=>containsTerm(value,term)).length + (containsTerm(value,phrase) ? 5 : 0)),0)
  return {score, matches}
}
export function selectPracticeQuestions(questions, { mode = 'practice', paper = '', subject = '', startYear = 100, endYear = 115, keyword = '', tag = '' } = {}) {
  if (Number(startYear) > Number(endYear)) return []
  const terms = text(keyword).split(' ').filter(Boolean)
  const scores = new Map()
  const filtered = questions.filter((q) => {
    if (Number(q.year) < Number(startYear) || Number(q.year) > Number(endYear)) return false
    if (subject && subject !== '全部科目' && getCanonicalSubjectName(q.subject) !== getCanonicalSubjectName(subject)) return false
    if (mode === 'paper') return Boolean(paper) && paperId(q) === paper
    const tags = searchableTags(q)
    if (tag && !tags.includes(tag)) return false
    const haystack = text([q.question, ...Object.values(q.options || {}), ...tags].map(value => String(value ?? '').replace(/\{\{image:[^}]+\}\}/g, ' ')).join(' '))
    const matches = terms.every((term) => containsTerm(haystack,term))
    if (matches && terms.length) scores.set(q, questionRelevance(q, keyword).score)
    return matches
  })
  return filtered.sort((a,b) => (mode !== 'paper' && terms.length ? scores.get(b)-scores.get(a) : 0) || Number(a.year)-Number(b.year) || paperId(a).localeCompare(paperId(b)) || Number(a.question_number)-Number(b.question_number))
}
export function practiceScope({ mode, paper = '', keyword = '', tag = '', taskId = '' }) {
  return JSON.stringify([mode, paper, text(keyword), tag, taskId])
}
