import test from 'node:test'
import assert from 'node:assert/strict'
import {planOfflineOfficialIngest} from '../scripts/plan-official-ingest.mjs'
import {officialCorrection} from '../src/utils/officialCorrections.js'
import {acceptsSelection} from '../src/utils/answerRules.js'
const s=(type,sha256,page)=>({url:`https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx?t=${type}&code=114020&c=309&s=0603&q=1`,sha256,page})
const doc={schemaVersion:1,paperKey:'114-1-diagnostic-demo',examCode:'114020',expectedCount:2,questionSource:s('Q','1'.repeat(64)),answerSource:s('S','2'.repeat(64)),
 rows:[{number:2,answer:{kind:'accepted-sets',acceptedSets:['A']}},{number:1,answer:{kind:'accepted-sets',acceptedSets:['B']}}],corrections:[]}
test('new plan and exact replay are idempotent, no live effects or explanatory refresh',()=>{
 const draft=planOfflineOfficialIngest(doc)
 assert.equal(draft.status,'preview-only')
 assert.equal(planOfflineOfficialIngest(doc,draft.version).status,'already-planned')
 assert.equal(draft.gates.canonicalWrite,false);assert.equal(draft.gates.publish,false)
 assert.match(draft.gates.ragIndexRefresh,/blocked/)
})
test('existing verified MOEX Q36 correction outranks original, preserves alternatives not joint answer',()=>{
 const v=officialCorrection({id:'114-1-放射線診斷原理與技術學-036'})
 const fix={number:1,revision:v.revision,rule:v.rule,source:{url:v.sourceUrl,sha256:v.sourceSha256,page:v.page}}
 const prior=planOfflineOfficialIngest(doc)
 const p=planOfflineOfficialIngest({...doc,corrections:[fix]},prior.version)
 assert.notEqual(p.planId,prior.planId);assert.equal(p.selected[0].version.authority,'official-correction')
 assert.equal(acceptsSelection(p.selected[0].version.rule,'C'),true);assert.equal(acceptsSelection(p.selected[0].version.rule,'BC'),false)
 assert.throws(()=>planOfflineOfficialIngest(doc,p.version),/removal/)
 assert.throws(()=>planOfflineOfficialIngest({...doc,rows:[doc.rows[0],{...doc.rows[1],answer:{kind:'accepted-sets',acceptedSets:['D']}}],corrections:[fix]},prior.version),/original answer parse changed/)

 assert.throws(()=>planOfflineOfficialIngest({...doc,corrections:[{...fix,rule:{kind:'all-credit'}}]},p.version),/version drift/)
})
test('hash drift, wrong authority, partial/ambiguous answers, and duplicates fail closed',()=>{
 const prev=planOfflineOfficialIngest(doc).version
 assert.throws(()=>planOfflineOfficialIngest({...doc,questionSource:s('Q','a'.repeat(64))},prev),/hash drift/)
 assert.throws(()=>planOfflineOfficialIngest({...doc,answerSource:s('A','a'.repeat(64))}),/URL/)
 assert.throws(()=>planOfflineOfficialIngest({...doc,rows:[doc.rows[0]]}),/incomplete/)
 for(const answer of ['A?','BA','AA'])assert.throws(()=>planOfflineOfficialIngest({...doc,rows:[doc.rows[0],{...doc.rows[1],answer:{kind:'accepted-sets',acceptedSets:[answer]}}]}),/invalid/)
 assert.throws(()=>planOfflineOfficialIngest({...doc,rows:[doc.rows[0],doc.rows[0]]}),/duplicate/)
 const all=planOfflineOfficialIngest({...doc,rows:[doc.rows[0],{...doc.rows[1],answer:{kind:'all-credit'}}]})
 assert.equal(all.selected[0].version.rule.kind,'all-credit')
})
