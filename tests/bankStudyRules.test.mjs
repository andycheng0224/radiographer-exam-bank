import test from 'node:test'
import assert from 'node:assert/strict'
import {createStudyState,recordAttempt,requestAdvice,chooseTask,getProgress} from '../src/utils/bankStudyRules.js'
const q=(questionId,year=115,subjectId='diag')=>({questionId,year,subjectId})
const ev=(id,questionId,occurredAt,scoreStatus='graded')=>({schemaVersion:1,eventId:id,questionId,sessionId:'example-session',subjectId:'diag',examId:'demo',year:115,occurredAt,correct:false,scoreStatus})
const t=h=>`2026-11-21T${h}:00:00Z`
test('only explicit request creates neutral scoped task, prioritizing browser-unobserved questions',()=>{
 let s=createStudyState()
 const e=ev('a','a',t('09'));s=recordAttempt(s,e).state
 assert.equal(s.tasks.length,0)
 assert.equal(recordAttempt(s,e).state,s)
 assert.throws(()=>recordAttempt(s,{...e,correct:true}),/Conflicting/)
 const options={requestId:'request',catalog:[q('a'),q('b'),q('b'),q('c',114),q('d',115,'physics')],yearFrom:115,yearTo:115,count:2,subjectIds:['diag'],now:t('10')}
 const r=requestAdvice(s,options)
 assert.deepEqual(r.task.questionIds,['b','a'])
 assert.equal(r.task.evidence.status,'insufficient_evidence')
 assert.equal(requestAdvice(r.state,options).state,r.state)
 assert.equal(getProgress(r.state,r.task.id).completed,0)
})
test('progress only credits unique eligible records after acceptance, not all-credit or unverified',()=>{
 let s=createStudyState()
 const r=requestAdvice(s,{requestId:'request',catalog:[q('a'),q('b')],yearFrom:115,yearTo:115,now:t('09')})
 s=chooseTask(r.state,r.task.id,'accept',t('10'))
 for(const e of [ev('old','a',t('08')),ev('all','a',t('11'),'all-credit'),ev('unknown','b',t('11'),'unverified'),ev('valid','b',t('12')),ev('again','b',t('13'))])s=recordAttempt(s,e).state
 assert.deepEqual(getProgress(s,r.task.id),{completed:1,total:2,percent:50,complete:false})
 assert.equal(getProgress(recordAttempt(s,ev('done','a',t('14'))).state,r.task.id).complete,true)
})
