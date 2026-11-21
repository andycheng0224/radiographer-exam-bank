import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import supplements from '../src/data/verifiedSupplements.js'
import {applyContentReview} from '../src/utils/contentReview.js'
import {listPapers,selectPracticeQuestions,reliableTags,searchableTags} from '../src/utils/practiceSelection.js'
import {questionMetadata,readStudyState,recordSubmissionAttempts,requestStudyAdvice,setStudyAgentAdapter} from '../src/utils/studyAgentAdapter.js'
import {readUserScopedStorageValue,writeUserScopedStorageValue} from '../src/utils/storageUtils.js'
import {calculateExamResult} from '../src/utils/quizUtils.js'
const base=JSON.parse(readFileSync(new URL('../src/data/fiinal_enriched_questions.json',import.meta.url)))
const values=new Map()
globalThis.window={__RADIOGRAPHER_CURRENT_USER__:{id:'phase3-test'},localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}}
const KEY='radiographer_exam_bank_advice_v1'
test('115 first round contains six complete 80-question number sets after two reviewed additions',()=>{
 const papers=listPapers([...base,...supplements]).filter(p=>p.year===115&&p.round==='第一次')
 assert.equal(papers.length,6)
 for(const p of papers){assert.equal(p.questions.length,80,p.subject);assert.deepEqual(p.missingNumbers,[])}
})
test('equipment four figures match pinned official extraction files and remain complete PNGs',()=>{
 const q=supplements.find(q=>q.question_number===9)
 assert.equal(q.answer,'A');assert.equal(q.sourceProvenance.questionPages.join(','),'2,3')
 assert.equal(q.sourceProvenance.images.length,4)
 for(const asset of q.sourceProvenance.images){
  const b=readFileSync(new URL('../src'+asset.path,import.meta.url))
  assert.equal(createHash('sha256').update(b).digest('hex'),asset.sha256)
  assert.equal(b.readUInt32BE(16),asset.width);assert.equal(b.readUInt32BE(20),asset.height)
 }
})
test('sourced revisions preserve old explanations and supply six structured sections with source page',()=>{
 for(const id of ['100-2-放射線治療原理與技術學-080','115-1-醫學物理學與輻射安全-011']){
  const old=base.find(q=>q.id===id),q=applyContentReview(old)
  assert.equal(q.legacyExplanation,old.explanation)
  assert.equal(q.contentReview.status,'source-checked')
  for(const key of ['testedConcept','background','reasoningSteps','optionAnalysis','confusingConcepts','sourcePage','sourceUrl'])assert.ok(q.explanation[key])
  assert.deepEqual(applyContentReview(q),q)
 }
 assert.equal(Number((82.5*(101.5/104.5)**2).toFixed(1)),77.8)
})
test('source-aligned tags search across subjects but never become approved OnTrack concepts',()=>{
 const items=base.map(applyContentReview)
 const found=selectPracticeQuestions(items,{startYear:100,endYear:115,tag:'放射治療劑量計算'})
 assert.equal(found.length,2);assert.equal(new Set(found.map(q=>q.subject)).size,2)
 for(const q of found){assert.ok(searchableTags(q).includes('放射治療劑量計算'));assert.deepEqual(reliableTags(q),[]);assert.deepEqual(questionMetadata(q).conceptIds,[])}
 assert.equal(selectPracticeQuestions(items,{startYear:115,endYear:115,tag:'放射治療劑量計算'}).length,1)
})
test('incompatible plugin state stays intact and does not prevent question scoring',()=>{
 values.clear();const old={version:'future-or-corrupt',events:'keep this',privateNote:'preserve'}
 writeUserScopedStorageValue(KEY,old)
 assert.match(readStudyState().hostStateError,/保留/)
 const q=base[0],result=calculateExamResult([q],{[q.id]:q.answer})
 assert.equal(result.score,100)
 assert.equal(recordSubmissionAttempts({sessionId:'x',submittedAt:1000},result.perQuestionResults).ok,false)
 assert.deepEqual(readUserScopedStorageValue(KEY),old)
 assert.throws(()=>requestStudyAdvice({requestId:'x',catalog:[questionMetadata(q)],yearFrom:100,yearTo:100,count:1}))
 assert.deepEqual(readUserScopedStorageValue(KEY),old)
})
test('invalid plugin return value cannot overwrite valid observation history',()=>{
 values.clear();const q=base[0],result=calculateExamResult([q],{[q.id]:q.answer})
 recordSubmissionAttempts({sessionId:'good',submittedAt:1000},result.perQuestionResults)
 const before=readUserScopedStorageValue(KEY)
 const restore=setStudyAgentAdapter({recordAttempt:()=>({state:{invalid:true}})})
 assert.equal(recordSubmissionAttempts({sessionId:'bad',submittedAt:2000},result.perQuestionResults).ok,false)
 assert.deepEqual(readUserScopedStorageValue(KEY),before);restore()
})

test('bank rules do not overwrite or silently migrate former standalone-plugin state',()=>{
 values.clear()
 const former='radiographer_exam_bank_ontrack_v1'
 const old={version:'ontrack-plugin-v1',events:[],tasks:[],requests:[]}
 writeUserScopedStorageValue(former,old)
 assert.equal(readStudyState().version,'bank-study-rules-v1')
 assert.deepEqual(readUserScopedStorageValue(former),old)
})
