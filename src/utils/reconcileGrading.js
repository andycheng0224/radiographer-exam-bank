import { reconcileGrowthEvidence } from './growthCorrections.js'
import { withProgressLock } from './progressLock.js'
import { calculateExamResult } from './quizUtils.js'
import { gradingReceipt } from './gradingReceipt.js'
import { GRADING_VERSION } from './officialCorrections.js'
import { reconcileSubmissionStats, reconcileScoreHistory, getSavedSubmissionSnapshots } from './storageUtils.js'
import { reconcileStudyAttempts } from './studyAgentAdapter.js'
export function reconcileGrading(payload) {
  if(!payload?.sessionId || !Array.isArray(payload.questionsSnapshot) || !payload.userAnswersSnapshot) return {status:'insufficient-evidence'}
  const result=calculateExamResult(payload.questionsSnapshot,payload.userAnswersSnapshot)
  const stats=reconcileSubmissionStats(payload.sessionId,gradingReceipt(result))
  const historyUpdated=reconcileScoreHistory(payload.sessionId,result,GRADING_VERSION)
  const plugin=reconcileStudyAttempts(payload,result.perQuestionResults)
  const growth=reconcileGrowthEvidence(payload,result.perQuestionResults)
  return {status:stats.status,stats,historyUpdated,plugin,growth}
}
export function reconciliationMessage(report) {
  if(!report) return ''
  if(report.status==='storage-unavailable') return '目前無法取得進度儲存鎖；本頁仍依官方規則計分，歷史統計尚未核對。'
  const stats=['current','updated'].includes(report.status) ? '本次可追溯的每日統計已核對目前評分規則。' : '本次缺少可追溯的舊統計收據；保留歷史總計，未推估回填。'
  return stats + (report.plugin?.ok ? ' 有作答證據的 OnTrack 更正事件已核對，任務完成數不增加。' : ' 插件未更新，題庫評分不受影響。') + ' 有唯一作答證據的成長答對／答錯數已核對；XP、舊複習權重及無證據資料仍保留歷史值。'
}

export function reconcileSavedGrading(lockOptions) {
  return withProgressLock(()=>{
    const unique=new Map()
    for(const payload of getSavedSubmissionSnapshots()) if(payload?.sessionId) unique.set(payload.sessionId,payload)
    const reports=[...unique.values()].map(payload=>({sessionId:payload.sessionId,...reconcileGrading(payload)}))
    return {scanned:reports.length,statsUpdated:reports.filter(r=>r.status==='updated').length,
      growthUpdated:reports.reduce((n,r)=>n+(r.growth?.updated||0),0),pluginUpdated:reports.reduce((n,r)=>n+(r.plugin?.updated||0),0),
      preserved:reports.filter(r=>!['updated','current'].includes(r.status)).length,reports}
  },lockOptions)
}
