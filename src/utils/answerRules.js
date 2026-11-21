import { officialCorrection } from './officialCorrections.js'
export function normalizeSelection(value) {
  if (Array.isArray(value)) value = value.join('')
  if (value && typeof value === 'object') value = value.key ?? value.value ?? value.label ?? value.answer ?? value.correctAnswer ?? ''
  const clean = String(value ?? '').normalize('NFKC').trim().replace(/^選項/, '').replace(/[\s:：.．、,，]/g, '').toUpperCase()
  return /^[A-D]+$/.test(clean) ? [...new Set(clean)].sort().join('') : ''
}
export function parseAnswerRule(value) {
  if (value?.kind === 'all-credit') return { ...value, kind: 'all-credit', acceptedSets: [] }
  if (value?.kind === 'accepted-sets') return { ...value, acceptedSets: (value.acceptedSets || []).map(normalizeSelection).filter(Boolean) }
  const raw = String(value ?? '').normalize('NFKC').trim().toUpperCase()
  if (raw === '送分' || raw === '一律給分') return { kind: 'all-credit', acceptedSets: [] }
  return { kind: 'accepted-sets', acceptedSets: [...new Set(raw.split(/[,，、;；]|或/).map(normalizeSelection).filter(Boolean))] }
}
export function getAnswerRule(question) {
  const versions = [...(question?.answerVersions || []), officialCorrection(question)].filter(Boolean).filter(v => v && ['official-correction', 'official-original'].includes(v.authority) && v.rule)
    .sort((a,b) => Number(b.authority === 'official-correction') - Number(a.authority === 'official-correction') || Number(b.revision || 0)-Number(a.revision || 0))
  if (versions.length) return { ...parseAnswerRule(versions[0].rule), version: versions[0] }
  return { ...parseAnswerRule(question?.answerRule ?? question?.answer ?? question?.correctAnswer), provenance: { label: question?.answer_source || '來源未提供', verified: false } }
}
export function acceptsSelection(rule, value) {
  const parsed = parseAnswerRule(rule)
  return parsed.kind === 'all-credit' || Boolean(normalizeSelection(value) && parsed.acceptedSets.includes(normalizeSelection(value)))
}
export function answerRuleLabel(question) {
  const rule = getAnswerRule(question)
  return rule.kind === 'all-credit' ? '一律給分（含未作答）' : rule.acceptedSets.join(' 或 ')
}
