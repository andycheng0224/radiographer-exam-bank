import test from 'node:test'
import assert from 'node:assert/strict'
import corrections from '../src/data/reviewedAnswerCorrections.json' with {type:'json'}
import {stageOfficialIngestCapture} from '../scripts/stage-official-ingest-capture.mjs'
const v=corrections.find(r=>r.paperKey==='115-1-放射線診斷原理與技術學'&&r.questionNumber===48)
const u=(t)=>`https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx?t=${t}&code=115020&c=309&s=0603&q=1`
function capture(){
 const questions=Array.from({length:80},(_,i)=>({question_number:i+1,question:'Synthetic structure only',options:{A:'1',B:'2',C:'3',D:'4'},rawAnswer:'B',extractionIssues:[],questionSourcePage:1,answerSourcePage:1}))
 Object.assign(questions[47],{rawAnswer:'#',officialCorrectionReviewed:true,answerVersions:[v.version]})
 return {schemaVersion:1,status:'quarantined',countEvidence:'official answer-grid numbers 01–80',expectedCount:80,paperKey:v.paperKey,questionUrl:u('Q'),answerUrl:u('M'),questionSha256:v.questionSha256,answerSha256:v.answerSha256,questions}
}
test('captured # resolves only with verified paired-source correction and stays preview-only on replay',()=>{
 const c=capture(), a=stageOfficialIngestCapture(c), b=stageOfficialIngestCapture(c,a)
 assert.equal(a.status,'preview-only');assert.equal(b.status,'already-planned');assert.equal(a.stageId,b.stageId)
 assert.deepEqual(a.plan.selected[47].version.rule.acceptedSets,['A','AB','B'])
 assert.equal(a.plan.gates.canonicalWrite,false)
 assert.match(a.plan.gates.ragIndexRefresh,/blocked/)
 assert.ok(!JSON.stringify(a).includes('Synthetic structure only'))
})
test('forged correction, unresolved mark, mismatched paper, and changed text cannot pass quota-independent gates',()=>{
 const make=capture()
 const first=stageOfficialIngestCapture(make)
 assert.throws(()=>stageOfficialIngestCapture({...make,answerSha256:'0'.repeat(64)}),/correction/)
 assert.throws(()=>stageOfficialIngestCapture({...make,answerUrl:u('M').replace('0603','0602')}),/mismatched/)
 const drift=capture();drift.questions[0].question='Different text';assert.throws(()=>stageOfficialIngestCapture(drift,first),/capture drift/)
 const invalid=capture();invalid.questions[0].rawAnswer='#';assert.throws(()=>stageOfficialIngestCapture(invalid),/reviewed correction/)
})
