const fields = ['mode','startYear','endYear','subject','paper','keyword','tag']
export function selectionSearch(value) {
  const input = typeof value === 'string' ? new URLSearchParams(value) : new URLSearchParams(Object.entries(value || {}).map(([key,v])=>[key,String(v ?? '')]))
  const result = new URLSearchParams()
  for (const key of fields) if (input.has(key)) result.set(key,input.get(key))
  result.set('mode',input.get('mode')==='paper'?'paper':'practice')
  return result.toString()
}
export const selectionUrl = value => `/practice?${selectionSearch(value)}`
export function resultSelectionTarget(result) {
  const params = new URLSearchParams(result?.selectionSearch || '')
  if(params.get('mode')==='task')return {to:'/study',label:'返回學習任務'}
  if(!['paper','practice'].includes(params.get('mode')))return {to:'/radiographer',label:'回到科目'}
  params.set('subject',result?.subject || '全部科目')
  return {to:selectionUrl(params.toString()),label:'調整選題條件'}
}
