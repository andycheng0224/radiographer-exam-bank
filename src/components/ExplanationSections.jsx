import { QuestionRichText } from './QuestionContent'
import { answerRuleLabel, getAnswerRule } from '../utils/answerRules'
import { applyContentReview } from '../utils/contentReview'
const text = value => typeof value === 'string' ? value : Array.isArray(value) ? value.join('\n') : Object.entries(value || {}).map(([k,v])=>`${k}：${v}`).join('\n')
export default function ExplanationSections({question: original}) {
  const question = applyContentReview(original)
  const raw = question.explanation || question.detailedExplanation || question.aiExplanation || question.solution || question.analysis
  const e = raw && typeof raw === 'object' ? raw : {}
  const reviewed = question.contentReview?.status === 'source-checked'
  const sections = [['考什麼',e.testedConcept || e.coreConcept],['背景關係',e.background],['推理步驟',e.reasoningSteps || e.whyCorrect],['各選項',e.optionAnalysis || e.whyOthersWrong],['易混淆概念',e.confusingConcepts]]
  const rule = getAnswerRule(question)
  return <section className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-bold">詳解</h2>
    <p className="rounded-xl bg-amber-50 p-4 text-amber-900">{reviewed ? `本題已依下列原始資料核對與修訂，尚未經領域專家審核。範圍：${question.contentReview.scope}。` : raw ? '既有 AI／匯入詳解，尚未逐題核對教材來源；不能視為已驗證醫學內容。缺漏段落保留待查，不自動補寫。' : '本題尚無詳解。原題與官方答案的核對，不代表已驗證醫學推導；不自動補寫內容。'}</p>
    <p>目前評分：{answerRuleLabel(question)}。{rule.version && <a className="underline" href={rule.version.sourceUrl} target="_blank" rel="noreferrer">{rule.version.authority === 'official-correction' ? '官方更正清冊' : '官方標準答案'}第 {rule.version.page} 頁</a>}</p>
    {sections.map(([title,value])=><div key={title}><h3 className="mb-2 text-lg font-bold">{title}</h3>{value ? <QuestionRichText text={text(value)} alt={title}/> : <p className="text-slate-500">尚未提供，待查核。</p>}</div>)}
    <div><h3 className="mb-2 text-lg font-bold">來源頁碼</h3><p>題目來源：{question.source || '未提供'}。</p>{e.sourceCitation && e.sourcePage ? <p>{e.sourceCitation}，第 {e.sourcePage} 頁。{reviewed && e.sourceUrl ? <a href={e.sourceUrl} className="underline text-blue-700" target="_blank" rel="noreferrer">開啟原始來源</a> : '（尚未獨立核對）'}</p> : <p>詳解教材與頁碼：未提供，待查核。</p>}</div>
    {question.sourcedTags?.length > 0 && <div><h3 className="font-bold">來源分類（未經專家核可）</h3><div className="flex flex-wrap gap-3">{question.sourcedTags.map(t=><a key={t.label} href={t.source} className="underline text-blue-700" target="_blank" rel="noreferrer">{t.label} · {t.page} 頁</a>)}</div><p>分類依本題來源核對，可搜尋；不作為 OnTrack 已核可的概念證據。</p></div>}
    {reviewed && question.legacyExplanation && <details><summary>查看封存舊詳解（有已知錯誤，不作學習結論）</summary><pre className="whitespace-pre-wrap break-words text-sm">{JSON.stringify(question.legacyExplanation,null,2)}</pre></details>}
    {!reviewed && typeof raw==='string' && raw.trim() && <details><summary>原始未分段詳解（未驗證）</summary><QuestionRichText text={raw}/></details>}
    {!reviewed && e.memoryTip && <details><summary>舊記憶提示（未驗證）</summary><QuestionRichText text={e.memoryTip}/></details>}
  </section>
}
