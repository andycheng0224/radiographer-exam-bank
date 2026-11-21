import { useState } from 'react'
import { reconcileSavedGrading } from '../utils/reconcileGrading'
import { Link } from 'react-router-dom'
import BackLink from '../components/BackLink'
import Button from '../components/Button'
import Navbar from '../components/Navbar'
import SeoMeta from '../components/SeoMeta'
import StudyStatusStrip from '../components/StudyStatusStrip'
import { EXAM_SUBJECTS } from '../constants/subjects'
import {
  getSevenDayGrowthData,
  getSubjectPowerStats,
} from '../utils/growthUtils'
import {
  getWrongQuestionStatusSummary,
} from '../utils/recommendationUtils'

function CoreMetric({ label, value, hint }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
      {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
    </article>
  )
}

function GrowthPage() {
  const [migrationMessage,setMigrationMessage]=useState(''),[migrating,setMigrating]=useState(false)
  const migrate=async()=>{setMigrating(true);try{const r=await reconcileSavedGrading();setMigrationMessage(`已核對 ${r.scanned} 份現存作答快照；每日統計修正 ${r.statsUpdated} 份、成長紀錄修正 ${r.growthUpdated} 題、插件事件修正 ${r.pluginUpdated} 筆。${r.preserved} 份缺少統計證據，保留原值。`)}catch(error){setMigrationMessage(error.message)}finally{setMigrating(false)}}

  const sevenDayTrend = getSevenDayGrowthData()
  const subjectPower = getSubjectPowerStats()
  const wrongSummary = getWrongQuestionStatusSummary()
  const weakestSubject = subjectPower.weakestSubject
  const subjectRows = EXAM_SUBJECTS.map((subject) => {
    const row = subjectPower.rows.find((item) => item.subject === subject.name)
    return {
      name: subject.name,
      accuracy: row?.accuracy ?? null,
      answeredCount: row?.answeredCount ?? 0,
      needsFocus: Boolean(weakestSubject && weakestSubject.subject === subject.name),
    }
  })

  return (
    <main className="min-h-screen px-4 py-6 md:px-6 md:py-8">
      <SeoMeta
        title="我的成長｜刷題紀錄、科目戰力與錯題清除"
        description="我的成長頁呈現本週作答、目前正確率、待複習錯題與下一步學習建議。"
        canonicalPath="/growth"
        robots="noindex,nofollow"
      />
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <BackLink label="返回首頁" fallbackTo="/" />
        <Navbar subtitle="我的成長" title="學習紀錄" /><p className="rounded-xl bg-amber-50 p-4 text-amber-900">官方更正只依現存作答快照、收據與可唯一對應的紀錄核對；沒有證據的舊資料、XP 與複習權重保留歷史值。來源標籤不等於專家核准或精熟判定。</p>
        <Button disabled={migrating} onClick={migrate}>{migrating ? '核對中…' : '核對已保存作答的官方更正'}</Button>{migrationMessage && <p role="status">{migrationMessage}</p>}
        <StudyStatusStrip compact />

        <section className="grid gap-3 md:grid-cols-3">
          <CoreMetric label="本週作答" value={`${sevenDayTrend.totalAnswered} 題`} hint="最近 7 天累積" />
          <CoreMetric
            label="目前正確率"
            value={sevenDayTrend.totalAnswered > 0 ? `${sevenDayTrend.averageAccuracy}%` : '—'}
            hint={sevenDayTrend.totalAnswered > 0 ? '最近 7 天平均' : '完成作答後顯示'}
          />
          <CoreMetric label="待複習錯題" value={`${wrongSummary.dueWrongCount} 題`} hint="依現有複習紀錄計算" />
        </section>

        <div><Button as={Link} to="/study" variant="secondary">主動查看 OnTrack 學習建議</Button></div>

        <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-slate-950">錯題狀態</h2>
                <Button as={Link} to="/wrong-review" variant="secondary">
                  複習錯題
                </Button>
              </div>
            <p className="mt-3 text-sm leading-7 text-slate-700">{wrongSummary.conclusion}</p>
            <div className="mt-4 grid gap-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-600">待複習</span>
                <span className="text-lg font-black text-slate-950">{wrongSummary.dueWrongCount} 題</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-600">高風險</span>
                <span className="text-lg font-black text-slate-950">{wrongSummary.highRiskCount} 題</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-600">已清除</span>
                <span className="text-lg font-black text-slate-950">{wrongSummary.clearedCount} 題</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-semibold text-slate-600">今日新增 / 已複習</span>
                <span className="text-lg font-black text-slate-950">{wrongSummary.todayWrongCount} / {wrongSummary.todayReviewedCount}</span>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">各科狀況</h2>
            <p className="mt-1 text-sm text-slate-500">單科測驗累計；作答至少 10 題後評估弱科。</p>
            <div className="mt-4 space-y-3">
              {subjectRows.map((row) => (
                <Link
                  key={row.name}
                  to={`/quiz/${encodeURIComponent(row.name)}`}
                  className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-white"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{row.name}</p>
                        {row.needsFocus ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                            需加強
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${row.needsFocus ? 'bg-amber-500' : 'bg-blue-600'}`}
                          style={{ width: `${row.accuracy === null ? 0 : row.accuracy}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-20 text-right">
                      <p className="text-lg font-black text-slate-950">{row.accuracy === null ? '--' : `${row.accuracy}%`}</p>
                      <p className="text-xs text-slate-500">{row.answeredCount > 0 ? `${row.answeredCount} 題` : '尚無資料'}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">最近 7 天</h2>
              <p className="mt-1 text-sm text-slate-500">{sevenDayTrend.insight}</p>
            </div>
            {sevenDayTrend.totalAnswered === 0 ? (
              <Button as={Link} to="/radiographer" variant="secondary">
                開始刷題
              </Button>
            ) : null}
          </div>
          {sevenDayTrend.totalAnswered > 0 ? (
            <div className="mt-4 grid grid-cols-7 gap-2">
              {sevenDayTrend.days.map((day) => (
                <div key={day.dateKey} className="text-center">
                  <div className="flex h-20 items-end justify-center rounded-lg bg-slate-50 px-1 py-2">
                    <div
                      className="w-5 rounded-t bg-blue-600"
                      style={{
                        height: `${sevenDayTrend.maxAnsweredCount > 0
                          ? Math.round((day.answeredCount / sevenDayTrend.maxAnsweredCount) * 56)
                          : 0}px`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{day.label}</p>
                  <p className="text-xs font-bold text-slate-700">{day.answeredCount}</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}

export default GrowthPage
