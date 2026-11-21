import { resultSelectionTarget } from '../utils/selectionNavigation'
import { withProgressLock } from '../utils/progressLock'
import { reconcileGrading, reconciliationMessage } from '../utils/reconcileGrading'
import { answerRuleLabel } from '../utils/answerRules'
import { GRADING_VERSION } from '../utils/officialCorrections'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import Button from '../components/Button'
import OnTrackHandoff from '../components/OnTrackHandoff'
import Navbar from '../components/Navbar'
import { QuestionRichText } from '../components/QuestionContent'
import ResultSummary from '../components/ResultSummary'
import SeoMeta from '../components/SeoMeta'
import { getExamResult, getQuestionKey } from '../utils/storageUtils'
import { calculateExamResult } from '../utils/quizUtils'
import { formatQuestionMetadata } from '../utils/subjectUtils'

function ResultPage() {
  const location = useLocation()
  const { subject: subjectParam } = useParams()
  const subject = subjectParam || ''
  const resultPayload = useMemo(() => location.state || getExamResult(subject), [location.state, subject])
  const [reconciliation,setReconciliation] = useState(null)
  useEffect(()=> {let active=true;withProgressLock(()=>reconcileGrading(resultPayload)).then(report=>{if(active)setReconciliation(report)}).catch(()=>{if(active)setReconciliation({status:'storage-unavailable'})});return()=>{active=false}},[resultPayload])
  const [statusFilter, setStatusFilter] = useState('all')
  const selectionTarget = resultSelectionTarget(resultPayload)
  const selectionParams = new URLSearchParams(resultPayload?.selectionSearch || '')
  const retrySearch = resultPayload?.selectionSearch ? `?${resultPayload.selectionSearch}` : resultPayload?.startYear && resultPayload?.endYear
    ? `?startYear=${resultPayload.startYear}&endYear=${resultPayload.endYear}`
    : location.search



  const calculatedResult = useMemo(() => {
    if (!resultPayload?.questionsSnapshot?.length && resultPayload?.calculatedResult?.perQuestionResults?.length) {
      return resultPayload.calculatedResult
    }

    const questionsSnapshot = resultPayload?.questionsSnapshot || resultPayload?.questions || []
    const userAnswersSnapshot = resultPayload?.userAnswersSnapshot || resultPayload?.answers || {}
    return calculateExamResult(questionsSnapshot, userAnswersSnapshot)
  }, [resultPayload])

  const summary = calculatedResult
  const invariantCheck =
    summary.correctCount + summary.wrongCount + summary.unansweredCount === summary.totalCount &&
    summary.totalCount === summary.perQuestionResults.length

  const perQuestionResults = useMemo(
    () =>
      (summary.perQuestionResults || []).map((question, index) => ({
        ...question,
        _examIndex: index + 1,
        _listKey: question.questionKey || getQuestionKey(question) || question.id || `${index}`,
        _metadataLabel: formatQuestionMetadata(
          {
            ...question,
            subject: question.subject || subject || '',
          },
          {
            fallback: '來源資訊未提供',
          },
        ),
        _displayQuestionText: question.question || question.questionText || question.stem || '',
        _displayAnswer: answerRuleLabel(question) || '',
      })),
    [summary.perQuestionResults, subject],
  )

  const visibleQuestions = useMemo(() => {
    if (statusFilter === 'flagged') return perQuestionResults.filter(q=>resultPayload?.flaggedKeys?.includes(q._listKey))
    if (statusFilter === 'all') {
      return perQuestionResults
    }

    return perQuestionResults.filter((question) => question.status === statusFilter)
  }, [perQuestionResults, statusFilter, resultPayload])

  if (!resultPayload) return <Navigate to="/radiographer" replace />

  if (!invariantCheck) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-6">
        <SeoMeta
          title={`${subject || '測驗結果'}｜放射師國考刷題庫`}
          description="測驗結果頁會整理當次作答的答對、答錯與未作答狀態。"
          canonicalPath={`/results/${encodeURIComponent(subject || '')}`}
          robots="noindex,nofollow"
        />
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <Navbar subtitle="Timed Subject Result" title="測驗結果" />
          <section className="rounded-[1.75rem] border border-rose-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-8">
            <p className="text-base font-semibold text-rose-700">本次測驗結果資料不一致，請重新作答或重新載入頁面。</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button as={Link} to={`/quiz/${encodeURIComponent(subject)}${retrySearch}`}>
                再練習相同範圍
              </Button>
              <Button as={Link} to="/" variant="secondary">
                回首頁
              </Button>
            </div>
          </section>
        </div>
      </main>
    )
  }

  const filterButtons = [
    { key: 'all', label: `全部 ${summary.totalCount}` },
    { key: 'correct', label: `答對／給分 ${summary.correctCount}` },
    { key: 'wrong', label: `答錯 ${summary.wrongCount}` },
    { key: 'unanswered', label: `未作答 ${summary.unansweredCount}` },
    { key: 'flagged', label: `猶豫標注 ${resultPayload?.flaggedKeys?.length || 0}` },
  ]

  return (
    <main className="min-h-screen px-4 py-8 md:px-6">
      <SeoMeta
        title={`${subject || '測驗結果'}｜放射師國考刷題庫`}
        description="測驗結果頁會整理當次作答的答對、答錯與未作答狀態。"
        canonicalPath={`/results/${encodeURIComponent(subject || '')}`}
        robots="noindex,nofollow"
      />
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Link className="font-semibold text-blue-700" to={selectionTarget.to}>← {selectionTarget.label}</Link>
        <Navbar subtitle="Timed Subject Result" title={subject ? `${subject} 練習結果` : '練習結果'} />

        {['practice','paper'].includes(selectionParams.get('mode')) && <p className="text-slate-700">本次條件：{resultPayload.startYear}–{resultPayload.endYear} 年 · {subject}{selectionParams.get('keyword') ? ` · 關鍵字：${selectionParams.get('keyword')}` : ''}{selectionParams.get('tag') ? ` · 來源標籤：${selectionParams.get('tag')}` : ''}</p>}
        {resultPayload.submissionNotice && <p role="status">{resultPayload.submissionNotice}</p>}
        {resultPayload.duplicateSubmission && <p role="status">此份作答已交卷；本次沒有重複計入統計。</p>}
        {resultPayload.studyAgentWarning && <p role="status">{resultPayload.studyAgentWarning}</p>}
        <p className="rounded-xl bg-amber-50 p-4 text-amber-900">本頁依目前官方更正計分，原作答快照保留。{reconciliationMessage(reconciliation)}</p>
        <section className="grid gap-4 md:grid-cols-4">
          <ResultSummary label="總題數" value={summary.totalCount} unit="題" />
          <ResultSummary label="答對／給分" value={summary.correctCount} unit="題" tone="emerald" />
          <ResultSummary label="答錯" value={summary.wrongCount} unit="題" tone="rose" />
          <ResultSummary label="未作答" value={summary.unansweredCount} unit="題" tone="sky" />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <ResultSummary label="本次得分" value={summary.score.toFixed(2)} unit="分" tone="sky" />
          <ResultSummary
            label="結果"
            value={summary.passed ? '及格' : '未及格'}
            unit="60 分以上及格"
            tone={summary.passed ? 'emerald' : 'rose'}
          />
          <ResultSummary label="練習計分方式" value={summary.totalCount ? (100 / summary.totalCount).toFixed(2) : 0} unit="每題分數（總分 100）" />
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-8">
          <p className="mb-4 text-slate-700">實際作答 {summary.answeredCount} 題。全給分 {summary.allCreditCount} 題（含未作答），計入分數，不作為精熟證據。</p>
          <div className="mb-5 flex flex-wrap gap-4"><Button as={Link} to="/wrong-book" variant="secondary">查看錯題</Button><Button as={Link} to="/uncertain" variant="secondary">複習猶豫題</Button><Button as={Link} to="/study" variant="secondary">查看學習建議</Button></div>
          <OnTrackHandoff key={resultPayload.sessionId} sessionId={resultPayload.sessionId} />

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button as={Link} to={`/quiz/${encodeURIComponent(subject)}${retrySearch}`} className="w-full sm:w-auto">
              再練習相同範圍
            </Button>
            <Button as={Link} to={selectionTarget.to} variant="secondary" className="w-full sm:w-auto">
              {selectionTarget.label}
            </Button>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="flex flex-wrap gap-2">
              {filterButtons.map((filter) => (
                <Button
                  key={filter.key}
                  type="button"
                  variant={statusFilter === filter.key ? 'primary' : 'secondary'}
                  className="px-4 py-2"
                  onClick={() => setStatusFilter(filter.key)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>

            {visibleQuestions.length === 0 && (
              <p className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
                目前這個篩選條件下沒有題目可顯示。
              </p>
            )}

            {visibleQuestions.map((question, index) => (
              <article
                key={question._listKey}
                className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700">
                      測驗第 {question._examIndex} 題｜{question._metadataLabel}
                    </p>
                    <div className="mt-2 text-lg font-bold leading-relaxed text-slate-900">
                      <QuestionRichText text={question._displayQuestionText} alt="題目附圖" />
                    </div>
                  </div>

                  <span
                    className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
                      question.status === 'correct'
                        ? 'bg-emerald-100 text-emerald-800'
                        : question.status === 'wrong'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {question.status === 'correct'
                      ? (question.scoreStatus === 'all-credit' ? '一律給分' : '答對')
                      : question.status === 'wrong'
                        ? '答錯'
                        : '未作答'}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                  <p>
                    使用者作答：
                    <span className="ml-2 font-semibold text-slate-950">
                      {question.userAnswer || '未作答'}
                    </span>
                  </p>
                  <p>
                    正確答案：
                    <span className="ml-2 font-semibold text-slate-950">{question._displayAnswer}</span>
                  </p>
                </div>

                <Button
                  as={Link}
                  to={`/results/${encodeURIComponent(subject)}/question/${encodeURIComponent(question.questionKey || getQuestionKey(question) || question.id)}`}
                  state={{ from: 'results', subject, question }}
                  variant="secondary"
                  className="mt-4"
                >
                  查看題目詳情
                </Button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

export default ResultPage
