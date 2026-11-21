import { commitQuizSubmission } from '../utils/submissionService'
import { withProgressLock } from '../utils/progressLock'
import useConfirmation from '../components/useConfirmation'
import useDialog from '../utils/useDialog'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BackLink from '../components/BackLink'
import Button from '../components/Button'
import Navbar from '../components/Navbar'
import QuestionCard from '../components/QuestionCard'
import SeoMeta from '../components/SeoMeta'
import { getQuestionKey } from '../utils/storageUtils'
import { newSessionId, restoreAnswers, readQuizDraft, saveQuizDraft } from '../utils/quizSessionUtils'
import { getWrongQuestionDetail } from '../utils/subjectUtils'
import { loadQuestionsByKeys } from '../utils/questionDataLoader'
import { getWrongItemsBySubject, pickWrongReviewItems } from '../utils/wrongReviewUtils'

function WrongReviewQuizPage() {
  const [confirm, confirmationDialog] = useConfirmation()
  const navigate = useNavigate()
  const { subject: subjectParam } = useParams()
  const subject = subjectParam || ''
  const [sessionId,setSessionId] = useState('')
  const [reviewQuestions, setReviewQuestions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitError,setSubmitError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answerMap, setAnswerMap] = useState({})
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false)
  const navigatorRef = useDialog(isNavigatorOpen, () => setIsNavigatorOpen(false))
  const [retryCount, setRetryCount] = useState(0)
  const submittedRef = useRef(false)
  const currentQuestion = reviewQuestions[currentIndex]
  const currentQuestionKey = currentQuestion ? getQuestionKey(currentQuestion) : ''
  const selectedAnswer = currentQuestionKey ? answerMap[currentQuestionKey] || '' : ''
  const answeredCount = reviewQuestions.filter(q => Boolean(answerMap[getQuestionKey(q)])).length

  useEffect(() => {
    let isCancelled = false

    async function loadReviewQuestions() {
      try {
        setIsLoading(true)
        setLoadError('')
        const draft = readQuizDraft('review', subject)
        const currentItems = getWrongItemsBySubject(subject)
        const byKey = new Map(currentItems.map((item) => [getQuestionKey(item), item]))
        const draftItems = draft?.questionKeys.map((key) => byKey.get(key)).filter(Boolean) || []
        const wrongItems = draftItems.length ? draftItems : pickWrongReviewItems(currentItems)
        const wrongKeys = wrongItems.map((item) => item.questionKey || item.key || getQuestionKey(item)).filter(Boolean)
        const sourceQuestions = await loadQuestionsByKeys(wrongKeys)
        const mergedQuestions = wrongItems
          .map((wrongItem) =>
            getWrongQuestionDetail(wrongItem, sourceQuestions, {
              questionId: wrongItem.questionKey || wrongItem.key || getQuestionKey(wrongItem),
            }),
          )
          .filter(Boolean)

        if (!isCancelled) {
          setReviewQuestions(mergedQuestions)
          setSessionId(draftItems.length && draft.sessionId ? draft.sessionId : newSessionId())
          setCurrentIndex(draftItems.length ? Math.max(0, Math.min(mergedQuestions.length - 1, Number(draft.currentIndex) || 0)) : 0)
          setAnswerMap(draftItems.length ? restoreAnswers(draft,mergedQuestions) : {})
          submittedRef.current = false
        }
      } catch {
        if (!isCancelled) {
          setLoadError('錯題複習資料載入失敗，請稍後再試。')
          setReviewQuestions([])
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadReviewQuestions()

    return () => {
      isCancelled = true
    }
  }, [subject, retryCount])

  useEffect(() => {
    if (!isLoading && reviewQuestions.length && !submittedRef.current) withProgressLock(() => saveQuizDraft('review', { subject, sessionId, questionKeys: reviewQuestions.map(getQuestionKey), answers: answerMap, currentIndex })).catch(error=>setSubmitError(error.message))
  }, [subject, reviewQuestions, answerMap, currentIndex, isLoading, sessionId])

  const handleSelectAnswer = (answer) => {
    if (!currentQuestion) {
      return
    }

    const questionKey = getQuestionKey(currentQuestion)

    if (!questionKey) {
      return
    }

    setAnswerMap((prev) => ({
      ...prev,
      [questionKey]: answer,
    }))
  }

  const handleMoveQuestion = (nextIndex) => {
    if (nextIndex < 0 || nextIndex > reviewQuestions.length - 1) {
      return
    }

    setCurrentIndex(nextIndex)
    setIsNavigatorOpen(false)
    document.getElementById('question-card')?.scrollIntoView({ block: 'start' })
  }

  const handleSubmit = async () => {
    if (submittedRef.current || isLoading || !reviewQuestions.length) return
    const unansweredCount = reviewQuestions.length - answeredCount
    const message =
      unansweredCount > 0
        ? `目前還有 ${unansweredCount} 題未作答，確定要交卷嗎？`
        : '確定要繳交本次錯題複習嗎？'

    if (!(await confirm(message, '確認交卷', '確認交卷'))) {
      return
    }

    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitError('')
    try {
      const payload=await commitQuizSubmission({subject,sessionId,mode:'review',submittedAt:Date.now(),questionsSnapshot:reviewQuestions,userAnswersSnapshot:answerMap})
      navigate(`/wrong-review/${encodeURIComponent(subject)}/result`,{replace:true,state:payload})
    } catch(error) {submittedRef.current=false;setSubmitError(error.message)}

  }

  const questionButtons = useMemo(
    () =>
      reviewQuestions.map((question, index) => {
        const questionKey = getQuestionKey(question)
        const isAnswered = Boolean(questionKey && answerMap[questionKey])
        const isCurrent = currentIndex === index
        const className = isCurrent
          ? 'border-slate-900 bg-slate-900 text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]'
          : isAnswered
            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
            : 'border-slate-200 bg-white text-slate-600'

        return { questionKey, index, className }
      }),
    [answerMap, currentIndex, reviewQuestions],
  )

  return (
    <main className="min-h-screen px-4 py-8 pb-28 md:px-6 md:pb-8">
      <SeoMeta
        title={`${subject || '錯題複習'}｜放射師國考刷題庫`}
        description="錯題複習頁會以作答模式重新練習目前錯題，作答中不顯示答案與詳解。"
        canonicalPath={`/wrong-review/${encodeURIComponent(subject || '')}`}
        robots="noindex,nofollow"
      />
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <BackLink label="返回錯題複習選科" fallbackTo="/wrong-review" />
        <Navbar subtitle="Wrong Review Quiz" title={`${subject} 錯題複習`} />

        {isLoading ? (
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="font-bold text-slate-900">正在載入錯題複習題目...</p>
          </section>
        ) : null}

        {submitError && <p role="alert">{submitError}</p>}
        {!isLoading && loadError ? (
          <section className="rounded-[1.75rem] border border-rose-200 bg-white p-6 shadow-sm">
            <p className="font-bold text-rose-700">{loadError}</p>
            <Button className="mt-4" onClick={() => setRetryCount((value) => value + 1)}>重試載入</Button>
          </section>
        ) : null}

        {!isLoading && !loadError && reviewQuestions.length === 0 ? (
          <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <h2 className="text-2xl font-black text-slate-950">這個科目目前沒有錯題</h2>
            <p className="mt-3 text-sm text-slate-600">完成正式測驗後，答錯題目會自動出現在錯題複習中。</p>
            <div className="mt-6">
              <Button onClick={() => navigate('/wrong-review')}>返回選科</Button>
            </div>
          </section>
        ) : null}

        {!isLoading && !loadError && currentQuestion ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <section className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      錯題複習模式
                    </p>
                    <h2 className="mt-2 text-lg font-bold text-slate-950">作答中不顯示答案與詳解</h2>
                    <p className="mt-2 text-sm text-slate-600">
                      科目：{subject}｜本次錯題複習：{reviewQuestions.length} 題
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs text-slate-500">目前題號</p>
                      <p className="mt-1 text-xl font-black text-slate-950">{currentIndex + 1}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs text-slate-500">已作答</p>
                      <p className="mt-1 text-xl font-black text-slate-950">{answeredCount}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs text-slate-500">未作答</p>
                      <p className="mt-1 text-xl font-black text-slate-950">{reviewQuestions.length - answeredCount}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 md:hidden">
                  <Button type="button" variant="secondary" className="w-full" onClick={() => setIsNavigatorOpen(true)}>
                    題號導覽
                  </Button>
                </div>
              </section>

              <QuestionCard
                key={currentQuestionKey}
                questionNumber={currentIndex + 1}
                totalQuestions={reviewQuestions.length}
                question={currentQuestion}
                selectedAnswer={selectedAnswer}
                onSelectAnswer={handleSelectAnswer}
                showBookmark={false}
                showFlag={false}
                modeLabel="錯題複習"
              />

              <div className="hidden md:sticky md:bottom-4 md:z-20 md:block">
                <div className="flex flex-wrap justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
                  <Button type="button" variant="secondary" onClick={() => handleMoveQuestion(currentIndex - 1)} disabled={currentIndex === 0}>
                    上一題
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => handleMoveQuestion(currentIndex + 1)} disabled={currentIndex === reviewQuestions.length - 1}>
                    下一題
                  </Button>
                  <Button type="button" onClick={handleSubmit}>交卷</Button>
                </div>
              </div>
            </div>

            <aside className="hidden rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm md:block">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">作答導覽</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">已作答 {answeredCount} / {reviewQuestions.length}</p>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {questionButtons.map(({ questionKey, index, className }) => (
                  <button
                    key={questionKey || index}
                    type="button"
                    onClick={() => handleMoveQuestion(index)}
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${className}`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </aside>
          </div>
        ) : null}
      </div>

      {currentQuestion ? (
        <>
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
            <div className="mx-auto grid max-w-7xl grid-cols-4 gap-2">
              <Button type="button" variant="secondary" onClick={() => handleMoveQuestion(currentIndex - 1)} disabled={currentIndex === 0}>
                上一題
              </Button>
              <Button type="button" variant="secondary" onClick={() => setIsNavigatorOpen(true)}>
                題號
              </Button>
              <Button type="button" variant="secondary" onClick={() => handleMoveQuestion(currentIndex + 1)} disabled={currentIndex === reviewQuestions.length - 1}>
                下一題
              </Button>
              <Button type="button" onClick={handleSubmit}>交卷</Button>
            </div>
          </div>

          {isNavigatorOpen ? (
            <div className="fixed inset-0 z-50 bg-slate-950/40 md:hidden" onClick={() => setIsNavigatorOpen(false)}>
              <div
                ref={navigatorRef} role="dialog" aria-modal="true" aria-label="題號導覽"
                className="absolute inset-x-0 bottom-0 max-h-[72vh] rounded-t-[2rem] border border-slate-200 bg-white p-5 shadow-[0_-20px_50px_rgba(15,23,42,0.16)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <p className="text-sm font-bold text-slate-900">題號導覽</p>
                  <Button type="button" variant="ghost" className="px-4 py-2" onClick={() => setIsNavigatorOpen(false)}>
                    關閉
                  </Button>
                </div>
                <div className="mt-4 grid max-h-[52vh] grid-cols-5 gap-2 overflow-y-auto pr-1">
                  {questionButtons.map(({ questionKey, index, className }) => (
                    <button
                      key={questionKey || index}
                      type="button"
                      onClick={() => handleMoveQuestion(index)}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${className}`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {confirmationDialog}
    </main>
  )
}

export default WrongReviewQuizPage
