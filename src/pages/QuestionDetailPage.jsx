import { selectionUrl } from '../utils/selectionNavigation'
import ExplanationSections from '../components/ExplanationSections'
import { answerRuleLabel, getAnswerRule } from '../utils/answerRules'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import BackLink from '../components/BackLink'
import Button from '../components/Button'
import Navbar from '../components/Navbar'
import QuestionContent, { QuestionRichText } from '../components/QuestionContent'
import SeoMeta from '../components/SeoMeta'
import {
  extractQuestionTags,
  getBookmarkIds,
  getExamResult,
  getLatestSubmittedAnswer,
  getQuestionKey,
  getWrongBookItems,
  toggleBookmark,
  updateWrongQuestionStatus,
} from '../utils/storageUtils'
import { getAnswerStatus, calculateExamResult, getAcceptedAnswers } from '../utils/quizUtils'
import { formatQuestionMetadata, getWrongQuestionDetail, normalizeQuestionKey } from '../utils/subjectUtils'
import { getQuestionByKey } from '../utils/questionDataLoader'

function formatTags(question) {
  return extractQuestionTags(question)
}

function QuestionDetailPage() {
  const { subject, questionId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const decodedQuestionId = questionId || ''
  const examResult = useMemo(() => subject ? getExamResult(subject) : null, [subject, questionId])
  const normalizedRouteKey = normalizeQuestionKey(decodedQuestionId)
  const wrongBookItems = useMemo(() => getWrongBookItems(), [questionId])
  const resultQuestionItems = useMemo(() => [
    ...(location.state?.question ? [location.state.question] : []),
    ...calculateExamResult(examResult?.questionsSnapshot || [], examResult?.userAnswersSnapshot || {}).perQuestionResults,
    ...(Array.isArray(examResult?.perQuestionResults) ? examResult.perQuestionResults : []),
    ...(Array.isArray(examResult?.calculatedResult?.perQuestionResults)
      ? examResult.calculatedResult.perQuestionResults
      : []),
    ...(Array.isArray(examResult?.wrongQuestions) ? examResult.wrongQuestions : []),
  ], [examResult, location.state])
  const reviewedQuestion =
    resultQuestionItems.find((item) => normalizeQuestionKey(item) === normalizedRouteKey) || null
  const wrongBookItem =
    wrongBookItems.find(
      (item) =>
        item.key === decodedQuestionId ||
        item.questionKey === decodedQuestionId ||
        normalizeQuestionKey(item) === normalizedRouteKey,
    ) || null
  const [resolvedQuestion, setResolvedQuestion] = useState(null)
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(true)
  const [bookmarkIds, setBookmarkIds] = useState(() => getBookmarkIds())

  useEffect(() => {
    let isCancelled = false

    async function resolveQuestion() {
      try {
        setIsLoadingQuestion(true)
        const loadedQuestion = await getQuestionByKey(decodedQuestionId)
        const mergedQuestion = getWrongQuestionDetail(
          reviewedQuestion || wrongBookItem || loadedQuestion || { id: decodedQuestionId },
          loadedQuestion ? [loadedQuestion] : [],
          {
            questionId,
            decodedQuestionId,
            routeKey: decodedQuestionId,
          },
        )

        if (!isCancelled) {
          setResolvedQuestion(mergedQuestion || loadedQuestion || wrongBookItem || reviewedQuestion || null)
        }
      } catch {
        if (!isCancelled) {
          const mergedQuestion = getWrongQuestionDetail(
            reviewedQuestion || wrongBookItem || { id: decodedQuestionId },
            [],
            {
              questionId,
              decodedQuestionId,
              routeKey: decodedQuestionId,
            },
          )

          setResolvedQuestion(mergedQuestion || wrongBookItem || reviewedQuestion || null)
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingQuestion(false)
        }
      }
    }

    resolveQuestion()

    return () => {
      isCancelled = true
    }
  }, [decodedQuestionId, questionId, reviewedQuestion, wrongBookItem])

  const question = resolvedQuestion
  const fromUncertain=location.state?.from==='uncertain' || new URLSearchParams(location.search).get('from')==='uncertain'
  const savedAttempt=getLatestSubmittedAnswer(decodedQuestionId,{flaggedOnly:fromUncertain})
  const userAnswer = fromUncertain && savedAttempt ? savedAttempt.answer : question?.userAnswer || reviewedQuestion?.userAnswer || wrongBookItem?.userAnswer || savedAttempt?.answer || ''
  const questionKey = question ? getQuestionKey(question) : decodedQuestionId
  const tags = question ? formatTags(question) : []
  const isUsingCachedWrongItem = Boolean(question?._usedCachedWrongItem)
  const questionMetadataLabel = formatQuestionMetadata(
    question || wrongBookItem || reviewedQuestion || { id: decodedQuestionId },
    {
      prefix: '歷屆來源：',
      fallback: '歷屆來源：未標記',
    },
  )
  const detailParams = new URLSearchParams(location.search)
  const returnTarget =
    detailParams.get('from') === 'practice'
      ? {to:selectionUrl(detailParams.get('selection') || ''),label:'返回選題條件'}
      : location.state?.from === 'sources'
      ? { to: '/sources', label: '返回來源查核' }
      : location.state?.from === 'wrong-review-result'
      ? { to: `/wrong-review/${encodeURIComponent(location.state.subject)}/result`, label: '返回複習結果' }
      : fromUncertain
      ? {to:'/uncertain',label:'返回猶豫題'}
      : location.state?.from === 'bookmarks'
      ? { to: '/bookmarks', label: '返回收藏題' }
      : location.state?.from === 'results' || Boolean(subject)
        ? { to: `/results/${encodeURIComponent(location.state?.subject || subject || '')}`, label: '返回測驗結果' }
        : { to: '/wrong-book', label: '返回錯題本' }

  const handleResolveQuestion = () => {
    updateWrongQuestionStatus(questionKey, 'resolved')
    navigate(returnTarget.to)
  }

  const handleAddBookmark = () => {
    setBookmarkIds(toggleBookmark(question || questionKey))
  }

  if (isLoadingQuestion) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-6">
        <SeoMeta
          title="題目詳情｜放射師國考刷題庫"
          description="題目詳情頁可查看完整題目內容、答案與詳解。"
          canonicalPath={`/questions/${encodeURIComponent(questionKey || decodedQuestionId || '')}`}
          robots="noindex,nofollow"
        />
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <BackLink label={returnTarget.label} fallbackTo={returnTarget.to} />
          <Navbar subtitle="Question Review" title="題目詳情" />
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-8">
            <p className="text-slate-700">正在載入題目資料...</p>
          </section>
        </div>
      </main>
    )
  }

  if (!question) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-6">
        <SeoMeta
          title="題目詳情｜放射師國考刷題庫"
          description="題目詳情頁可查看完整題目內容、答案與詳解。"
          canonicalPath={`/questions/${encodeURIComponent(questionKey || decodedQuestionId || '')}`}
          robots="noindex,nofollow"
        />
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <BackLink label={returnTarget.label} fallbackTo={returnTarget.to} />
          <Navbar subtitle="Question Review" title="題目詳情" />
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-8">
            <p className="text-slate-700">找不到原始題目資料，請確認題庫資料是否已載入</p>
            <div className="mt-4">
              <Button as={Link} to={returnTarget.to} variant="secondary">
                {returnTarget.label}
              </Button>
            </div>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-6">
      <SeoMeta
        title="題目詳情｜放射師國考刷題庫"
        description="題目詳情頁可查看完整題目內容、答案與詳解。"
        canonicalPath={`/questions/${encodeURIComponent(questionKey || decodedQuestionId || '')}`}
        robots="noindex,nofollow"
      />
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <BackLink label={returnTarget.label} fallbackTo={returnTarget.to} />
        <Navbar
          subtitle="Question Review"
          title="題目詳情"
          actions={
            <>
              <Button as={Link} to={returnTarget.to} variant="secondary">
                {returnTarget.label}
              </Button>
              {wrongBookItem && <Button type="button" variant="ghost" onClick={handleResolveQuestion}>
                我已經會了
              </Button>}
              <Button type="button" onClick={handleAddBookmark}>
                {bookmarkIds.includes(questionKey) ? '取消收藏' : '加入收藏題'}
              </Button>
            </>
          }
        />

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:p-8">
          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700">
            <div className="flex flex-wrap items-center gap-2">{questionMetadataLabel}</div>
          </div>

          <QuestionContent question={question} />

          {isUsingCachedWrongItem && (
            <p className="mt-4 text-sm text-slate-500">此題使用錯題紀錄中的快取資料顯示。</p>
          )}

          {tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2"><p className="w-full text-sm text-slate-600">舊匯入標籤（未經專家核可）</p>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 grid gap-3">
            {Object.entries(question.options || {}).map(([key, value]) => {
              const answerStatus = getAnswerStatus(question, userAnswer, key)
              const className =
                answerStatus === 'correct'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : answerStatus === 'wrong'
                    ? 'border-rose-300 bg-rose-50 text-rose-900'
                    : 'border-slate-200 bg-white text-slate-800'

              return (
                <div
                  key={key}
                  className={`rounded-2xl border px-4 py-4 text-base font-medium ${className}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                      {key}
                    </span>
                    <div className="min-w-0 flex-1">
                      <QuestionRichText
                        text={value}
                        alt={`${question.id}-${key}`}
                        textClassName="whitespace-pre-line leading-relaxed"
                        imageClassName="max-h-[24rem] w-full object-contain"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {answerStatus === 'wrong' && (
                          <span className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                            你的答案
                          </span>
                        )}
                        {answerStatus === 'correct' && (
                          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            正確答案
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-slate-700">
              使用者作答：
              <span className="ml-2 font-semibold text-slate-900">
                {userAnswer || '使用者未作答'}
              </span>
            </p>
            <p className="text-slate-700">
              正確答案：
              <span className="ml-2 inline-block align-top font-semibold text-slate-900">
                {answerRuleLabel(question)}
              </span>
            </p>
            <QuestionRichText
              text={getAcceptedAnswers(getAnswerRule(question)).map((key) => `${key}. ${question.options?.[key] || ''}`).join('\n')}
              alt={`${question.id}-answer`}
              textClassName="whitespace-pre-line leading-relaxed text-slate-700"
              imageClassName="max-h-[20rem] w-full object-contain"
            />
          </div>

          <ExplanationSections question={question} />
        </section>
      </div>
    </main>
  )
}

export default QuestionDetailPage
