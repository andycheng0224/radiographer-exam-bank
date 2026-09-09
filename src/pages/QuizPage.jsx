import useConfirmation from '../components/useConfirmation'
import useDialog from '../utils/useDialog'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import BackLink from '../components/BackLink'
import Button from '../components/Button'
import Navbar from '../components/Navbar'
import QuestionCard from '../components/QuestionCard'
import SeoMeta from '../components/SeoMeta'
import { EXAM_DURATION_SECONDS } from '../constants/subjects'
import {
  QUIZ_LENGTH,
  calculateExamResult,
  formatTime,
  generateRandomExamQuestions,
} from '../utils/quizUtils'
import {
  appendTodayWrongQuestions,
  getBookmarkIds,
  getQuestionKey,
  getPracticeYearRange,
  saveExamResult,
  saveSingleSubjectExamResult,
  saveWrongQuestionIds,
  toggleBookmark,
  updateTodayStats,
} from '../utils/storageUtils'
import { recordGrowthFromExamSubmission } from '../utils/growthUtils'
import {
  getAvailableYearsFromIndex,
} from '../utils/subjectUtils'
import { getQuestionIndex, loadQuestionsBySubjectAndYearRange } from '../utils/questionDataLoader'

import { clearQuizDraft, getRemainingSeconds, readQuizDraft, restoreDraftQuestions, saveQuizDraft } from '../utils/quizSessionUtils'

function QuizPage() {
  const [confirm, confirmationDialog] = useConfirmation()
  const navigate = useNavigate()
  const { subject: subjectParam } = useParams()
  const [searchParams] = useSearchParams()
  const subject = subjectParam || ''
  const [questionIndex, setQuestionIndex] = useState([])
  const [subjectQuestions, setSubjectQuestions] = useState([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true)
  const [loadError, setLoadError] = useState('')
  const availableYears = useMemo(() => getAvailableYearsFromIndex(questionIndex), [questionIndex])
  const savedRange = useMemo(() => getPracticeYearRange(), [])
  const defaultStartYear = availableYears.includes(savedRange.startYear) ? savedRange.startYear : availableYears[0] ?? 100
  const defaultEndYear = availableYears.includes(savedRange.endYear) ? savedRange.endYear : availableYears[availableYears.length - 1] ?? 115
  const requestedStartYear = Number(searchParams.get('startYear')) || defaultStartYear
  const requestedEndYear = Number(searchParams.get('endYear')) || defaultEndYear
  const startYear = availableYears.includes(requestedStartYear) ? requestedStartYear : defaultStartYear
  const endYearCandidate = availableYears.includes(requestedEndYear) ? requestedEndYear : defaultEndYear
  const endYear = Math.max(startYear, endYearCandidate)
  const hasEnoughQuestions = subjectQuestions.length >= QUIZ_LENGTH
  const [examQuestions, setExamQuestions] = useState(() =>
    generateRandomExamQuestions(subjectQuestions, QUIZ_LENGTH),
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answerMap, setAnswerMap] = useState({})
  const [bookmarkIds, setBookmarkIds] = useState(() => getBookmarkIds())
  const [flaggedQuestionKeys, setFlaggedQuestionKeys] = useState([])
  const [secondsLeft, setSecondsLeft] = useState(EXAM_DURATION_SECONDS)
  const [hasShownFiveMinuteWarning, setHasShownFiveMinuteWarning] = useState(false)
  const [showTimeWarning, setShowTimeWarning] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false)
  const navigatorRef = useDialog(isNavigatorOpen, () => setIsNavigatorOpen(false))
  const submittedRef = useRef(false)
  const [deadline, setDeadline] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  const getQuestionStateKey = (question) => getQuestionKey(question) || question?.id || ''
  const getStoredAnswer = (question) => {
    const questionStateKey = getQuestionStateKey(question)

    if (!questionStateKey) {
      return ''
    }

    return answerMap[questionStateKey] || ''
  }

  const currentQuestion = examQuestions[currentIndex]
  const currentQuestionKey = currentQuestion ? getQuestionStateKey(currentQuestion) : ''
  const selectedAnswer = currentQuestion ? getStoredAnswer(currentQuestion) : ''
  const isCurrentQuestionFlagged = currentQuestionKey ? flaggedQuestionKeys.includes(currentQuestionKey) : false
  const answeredCount = Object.keys(answerMap).length
  const timerTextColorClassName = secondsLeft <= 599 ? 'text-rose-600' : 'text-slate-950'

  useEffect(() => {
    let isCancelled = false

    async function loadMetadata() {
      try {
        const nextIndex = await getQuestionIndex()

        if (!isCancelled) {
          setQuestionIndex(nextIndex)
        }
      } catch {
        if (!isCancelled) {
          setLoadError('題庫索引載入失敗，請重新整理後再試。')
          setIsLoadingQuestions(false)
        }
      }
    }

    loadMetadata()

    return () => {
      isCancelled = true
    }
  }, [retryCount])

  useEffect(() => {
    if (questionIndex.length === 0) {
      return
    }

    let isCancelled = false

    async function loadQuestions() {
      try {
        setIsLoadingQuestions(true)
        setLoadError('')
        const nextQuestions = await loadQuestionsBySubjectAndYearRange(subject, startYear, endYear)

        if (!isCancelled) {
          setSubjectQuestions(nextQuestions)
        }
      } catch {
        if (!isCancelled) {
          setSubjectQuestions([])
          setLoadError('題庫資料載入失敗，請稍後再試。')
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingQuestions(false)
        }
      }
    }

    loadQuestions()

    return () => {
      isCancelled = true
    }
  }, [questionIndex, subject, startYear, endYear, retryCount])

  useEffect(() => {
    if (isLoadingQuestions) return
    if (!hasEnoughQuestions || loadError) { setExamQuestions([]); setDeadline(null); return }
    const draft = readQuizDraft('exam', subject, startYear, endYear)
    const restored = restoreDraftQuestions(draft, subjectQuestions)
    const canRestore = restored.length === QUIZ_LENGTH
    const nextDeadline = canRestore ? draft.deadline : Date.now() + EXAM_DURATION_SECONDS * 1000
    setExamQuestions(canRestore ? restored : generateRandomExamQuestions(subjectQuestions, QUIZ_LENGTH))
    setCurrentIndex(canRestore ? Math.max(0, Math.min(QUIZ_LENGTH - 1, Number(draft.currentIndex) || 0)) : 0)
    setAnswerMap(canRestore ? Object.fromEntries(Object.entries(draft.answers).filter(([key, answer]) => draft.questionKeys.includes(key) && ['A','B','C','D'].includes(answer))) : {})
    setFlaggedQuestionKeys(canRestore && Array.isArray(draft.flaggedKeys) ? draft.flaggedKeys.filter((key) => draft.questionKeys.includes(key)) : [])
    setDeadline(nextDeadline)
    setSecondsLeft(getRemainingSeconds(nextDeadline))
    setHasShownFiveMinuteWarning(false)
    setShowTimeWarning(false)
    setIsSubmitted(false)
    submittedRef.current = false
    setIsNavigatorOpen(false)
  }, [subject, startYear, endYear, hasEnoughQuestions, isLoadingQuestions, subjectQuestions, loadError])

  useEffect(() => {
    if (!deadline || isSubmitted || isLoadingQuestions || !examQuestions.length) return
    saveQuizDraft('exam', { subject, startYear, endYear, deadline,
      questionKeys: examQuestions.map(getQuestionKey), answers: answerMap, currentIndex, flaggedKeys: flaggedQuestionKeys })
  }, [subject, startYear, endYear, deadline, examQuestions, answerMap, currentIndex, flaggedQuestionKeys, isSubmitted, isLoadingQuestions])

  useEffect(() => {
    if (!deadline || isSubmitted || isLoadingQuestions) return
    const tick = () => setSecondsLeft(getRemainingSeconds(deadline))
    const timer = window.setInterval(tick, 1000)
    window.addEventListener('focus', tick)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick) }
  }, [deadline, isSubmitted, isLoadingQuestions])

  useEffect(() => {
    if (secondsLeft > 300 || secondsLeft === 0 || hasShownFiveMinuteWarning || isSubmitted || !deadline) {
      return undefined
    }

    setShowTimeWarning(true)
    setHasShownFiveMinuteWarning(true)


  }, [secondsLeft, hasShownFiveMinuteWarning, isSubmitted])

  useEffect(() => {
    if (secondsLeft !== 0 || isSubmitted || !hasEnoughQuestions) {
      return
    }

    autoSubmitExam()
  }, [secondsLeft, isSubmitted, hasEnoughQuestions])

  const submitExam = (submissionType) => {
    if (submittedRef.current || isLoadingQuestions || !examQuestions.length) return
    submittedRef.current = true

    const calculatedResult = calculateExamResult(examQuestions, answerMap)
    const summary = calculatedResult
    const perQuestionResults = calculatedResult.perQuestionResults
    const wrongQuestions = perQuestionResults.filter((question) => question.status === 'wrong')
    const elapsedSeconds = EXAM_DURATION_SECONDS - Math.min(EXAM_DURATION_SECONDS, getRemainingSeconds(deadline))
    const submittedAt = Date.now()
    const resultPayload = {
      examId: `${subject}-${submittedAt}`,
      subject,
      startYear,
      endYear,
      yearRange: `${startYear}–${endYear} 年`,
      questionsSnapshot: examQuestions,
      userAnswersSnapshot: answerMap,
      elapsedSeconds,
      submissionType,
      submittedAt,
    }

    setIsSubmitted(true)
    updateTodayStats({
      answeredCountDelta: summary.correctCount + summary.wrongCount,
      correctCountDelta: summary.correctCount,
      wrongCountDelta: summary.wrongCount,
    })
    saveSingleSubjectExamResult({
      type: 'single_subject',
      subject,
      totalQuestions: summary.totalCount,
      correctCount: summary.correctCount,
      wrongCount: summary.wrongCount,
      unansweredCount: summary.unansweredCount,
      score: summary.score,
      elapsedTime: elapsedSeconds,
      yearRange: `${startYear}–${endYear} 年`,
      wrongQuestions,
      submittedAt,
    })
    appendTodayWrongQuestions(wrongQuestions)
    saveWrongQuestionIds(wrongQuestions)
    saveExamResult(subject, resultPayload)
    recordGrowthFromExamSubmission({ ...resultPayload, perQuestionResults })
    clearQuizDraft('exam', subject, startYear, endYear)

    navigate(`/results/${encodeURIComponent(subject)}?startYear=${startYear}&endYear=${endYear}`, {
      state: resultPayload,
      replace: true,
    })
  }

  const autoSubmitExam = () => {
    submitExam('auto')
  }

  const handleSelectAnswer = (answer) => {
    if (!currentQuestion || isSubmitted) {
      return
    }

    const questionKey = getQuestionStateKey(currentQuestion)

    if (!questionKey) {
      return
    }

    setAnswerMap((prev) => ({
      ...prev,
      [questionKey]: answer,
    }))
  }

  const handleMoveQuestion = (nextIndex) => {
    if (nextIndex < 0 || nextIndex > examQuestions.length - 1) {
      return
    }

    setCurrentIndex(nextIndex)
    setIsNavigatorOpen(false)
    document.getElementById('question-card')?.scrollIntoView({ block: 'start' })
  }

  const handleRestart = async () => {
    if (!hasEnoughQuestions) {
      return
    }

    const shouldRestart = await confirm('重新抽題會清除目前作答進度、答案與剩餘時間，確定要重新抽題嗎？')

    if (!shouldRestart) {
      return
    }

    setExamQuestions(generateRandomExamQuestions(subjectQuestions, QUIZ_LENGTH))
    setCurrentIndex(0)
    setAnswerMap({})
    setFlaggedQuestionKeys([])
    clearQuizDraft('exam', subject, startYear, endYear)
    submittedRef.current = false
    setDeadline(Date.now() + EXAM_DURATION_SECONDS * 1000)
    setSecondsLeft(EXAM_DURATION_SECONDS)
    setHasShownFiveMinuteWarning(false)
    setShowTimeWarning(false)
    setIsSubmitted(false)
    setIsNavigatorOpen(false)
  }

  const handleToggleBookmark = () => {
    if (!currentQuestion) {
      return
    }

    setBookmarkIds(toggleBookmark(currentQuestion))
  }

  const handleToggleFlagged = () => {
    if (!currentQuestionKey) {
      return
    }

    setFlaggedQuestionKeys((prev) =>
      prev.includes(currentQuestionKey)
        ? prev.filter((questionKey) => questionKey !== currentQuestionKey)
        : [...prev, currentQuestionKey],
    )
  }

  const handleSubmitClick = async () => {
    const unanswered = examQuestions.length - answeredCount
    const message = `本次已作答 ${answeredCount} 題，未作答 ${unanswered} 題，標注 ${flaggedQuestionKeys.length} 題。\n確定要繳交嗎？繳交後無法修改答案。`
    if (!(await confirm(message, '確認交卷', '確認交卷'))) return
    submitExam('manual')
  }

  return (
    <main className="min-h-screen px-4 py-8 pb-28 md:px-6 md:pb-8">
      <SeoMeta
        title={`${subject || '單科測驗'}｜放射師國考刷題庫`}
        description="單科限時測驗頁面提供歷屆試題作答與計時練習。"
        canonicalPath={`/quiz/${encodeURIComponent(subject || '')}`}
        robots="noindex,nofollow"
      />
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <BackLink label="返回放射師國考" fallbackTo="/radiographer" />
        <Navbar
          subtitle="Timed Subject Exam"
          title={subject}
          actions={
            <>
              <div className="rounded-xl border border-slate-300 bg-slate-50 px-5 py-3 text-sm font-bold text-slate-700">
                剩餘時間
                <span className={`ml-3 text-lg ${timerTextColorClassName}`}>{formatTime(secondsLeft)}</span>
              </div>
              <Button type="button" onClick={handleRestart} variant="ghost">
                重新抽題
              </Button>
            </>
          }
        />

        {loadError && (
          <section className="rounded-[1.75rem] border border-rose-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <p className="text-lg font-bold text-rose-700">{loadError}</p>
            <Button onClick={() => setRetryCount((value) => value + 1)} className="mt-4">重試載入</Button>
          </section>
        )}

        {isLoadingQuestions && !loadError && (
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <p className="text-lg font-bold text-slate-900">正在載入題庫資料...</p>
            <p className="mt-2 text-slate-600">
              目前年份範圍：民國 {startYear} 年至 {endYear} 年
            </p>
          </section>
        )}

        {!isLoadingQuestions && !loadError && !hasEnoughQuestions && (
          <section className="rounded-[1.75rem] border border-rose-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <p className="text-lg font-bold text-rose-700">
              此科目題庫不足 80 題，無法開始單科限時測驗
            </p>
            <p className="mt-2 text-slate-600">
              目前年份範圍：民國 {startYear} 年至 {endYear} 年
            </p>
            <p className="mt-1 text-slate-600">目前可用題數：{subjectQuestions.length} 題</p>
            <Button className="mt-4" onClick={() => navigate('/settings')}>調整年份範圍</Button>
          </section>
        )}

        {!isLoadingQuestions && !loadError && hasEnoughQuestions && currentQuestion && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              {showTimeWarning && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900 shadow-[0_12px_30px_rgba(245,158,11,0.12)]">
                  作答時間不到 5 分鐘，請確認尚未作答的題目。
                </div>
              )}

              <section className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 shadow-[0_16px_35px_rgba(15,23,42,0.05)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      測驗資訊
                    </p>
                    <h2 className="mt-2 text-lg font-bold text-slate-950">
                      醫事放射師單科限時測驗
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                      科目：{subject}｜題數：{QUIZ_LENGTH} 題｜年份：民國 {startYear} 年至 {endYear} 年
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
                      <p className="mt-1 text-xl font-black text-slate-950">{QUIZ_LENGTH - answeredCount}</p>
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
                totalQuestions={QUIZ_LENGTH}
                question={currentQuestion}
                selectedAnswer={selectedAnswer}
                isBookmarked={bookmarkIds.includes(currentQuestionKey)}
                isFlagged={isCurrentQuestionFlagged}
                onSelectAnswer={handleSelectAnswer}
                onToggleBookmark={handleToggleBookmark}
                onToggleFlagged={handleToggleFlagged}
              />

              <div className="hidden md:sticky md:bottom-4 md:z-20 md:block">
                <div className="flex flex-wrap justify-end gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_16px_35px_rgba(15,23,42,0.08)] backdrop-blur">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleMoveQuestion(currentIndex - 1)}
                    disabled={currentIndex === 0}
                    className={currentIndex === 0 ? 'pointer-events-none opacity-50' : ''}
                  >
                    上一題
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleMoveQuestion(currentIndex + 1)}
                    disabled={currentIndex === QUIZ_LENGTH - 1}
                    className={currentIndex === QUIZ_LENGTH - 1 ? 'pointer-events-none opacity-50' : ''}
                  >
                    下一題
                  </Button>
                  <Button type="button" onClick={handleSubmitClick}>
                    確認繳交
                  </Button>
                </div>
              </div>
            </div>

            <aside className="hidden rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_45px_rgba(15,23,42,0.06)] md:block">
              <div className="border-b border-slate-200 pb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">作答導覽</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  已作答 {answeredCount} / {QUIZ_LENGTH}
                </p>
                <p className="mt-1 text-sm text-slate-500">作答進度自動儲存，可離開後繼續；每日統計於交卷後更新。</p>
              </div>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {examQuestions.map((question, index) => {
                  const questionStateKey = getQuestionStateKey(question)
                  const isAnswered = Boolean(questionStateKey && answerMap[questionStateKey])
                  const isFlagged = Boolean(questionStateKey && flaggedQuestionKeys.includes(questionStateKey))
                  const isCurrent = currentIndex === index
                  const className = isCurrent
                    ? 'border-slate-900 bg-slate-900 text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]'
                    : isFlagged
                      ? 'border-amber-300 bg-amber-100 text-amber-900'
                    : isAnswered
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 bg-white text-slate-600'

                  return (
                    <button
                      key={questionStateKey || question.id || index}
                      type="button"
                      onClick={() => handleMoveQuestion(index)}
                      className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${className}`}
                    >
                      {index + 1}
                    </button>
                  )
                })}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                深色為目前題目，黃色為已標注，綠色為已作答，白色為未作答。
              </p>
            </aside>
          </div>
        )}
      </div>

      {hasEnoughQuestions && currentQuestion && (
        <>
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
            <div className="mx-auto grid max-w-7xl grid-cols-4 gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleMoveQuestion(currentIndex - 1)}
                disabled={currentIndex === 0}
                className={currentIndex === 0 ? 'pointer-events-none opacity-50' : ''}
              >
                上一題
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsNavigatorOpen(true)}
              >
                題號
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleMoveQuestion(currentIndex + 1)}
                disabled={currentIndex === QUIZ_LENGTH - 1}
                className={currentIndex === QUIZ_LENGTH - 1 ? 'pointer-events-none opacity-50' : ''}
              >
                下一題
              </Button>
              <Button type="button" onClick={handleSubmitClick}>
                交卷
              </Button>
            </div>
          </div>

          {isNavigatorOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/40 md:hidden" onClick={() => setIsNavigatorOpen(false)}>
              <div
                ref={navigatorRef} role="dialog" aria-modal="true" aria-label="題號導覽"
                className="absolute inset-x-0 bottom-0 max-h-[72vh] rounded-t-[2rem] border border-slate-200 bg-white p-5 shadow-[0_-20px_50px_rgba(15,23,42,0.16)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">作答導覽</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      已作答 {answeredCount} / {QUIZ_LENGTH}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" className="px-4 py-2" onClick={() => setIsNavigatorOpen(false)}>
                    關閉
                  </Button>
                </div>
                <div className="mt-4 grid max-h-[52vh] grid-cols-5 gap-2 overflow-y-auto pr-1">
                  {examQuestions.map((question, index) => {
                    const questionStateKey = getQuestionStateKey(question)
                    const isAnswered = Boolean(questionStateKey && answerMap[questionStateKey])
                    const isFlagged = Boolean(questionStateKey && flaggedQuestionKeys.includes(questionStateKey))
                    const isCurrent = currentIndex === index
                    const className = isCurrent
                      ? 'border-slate-900 bg-slate-900 text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]'
                      : isFlagged
                        ? 'border-amber-300 bg-amber-100 text-amber-900'
                      : isAnswered
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 bg-white text-slate-600'

                    return (
                      <button
                        key={questionStateKey || question.id || index}
                        type="button"
                        onClick={() => handleMoveQuestion(index)}
                        className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${className}`}
                      >
                        {index + 1}
                      </button>
                    )
                  })}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-slate-500">
                  深色為目前題目，黃色為已標注，綠色為已作答，白色為未作答。
                </p>
              </div>
            </div>
          )}
        </>
      )}
      {confirmationDialog}
    </main>
  )
}

export default QuizPage
