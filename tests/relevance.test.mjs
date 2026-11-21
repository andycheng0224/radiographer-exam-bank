import test from 'node:test'
import assert from 'node:assert/strict'
import {selectPracticeQuestions,questionRelevance,paperId} from '../src/utils/practiceSelection.js'
const q=(id,question,options={},extra={})=>({id,question,options,year:110,exam_round:'第一次',subject:'基礎醫學',question_number:Number(id)||1,...extra})
test('stem phrase outranks option phrase and input order is not mutated',()=>{
 const input=[q('1','其他',{A:'CT noise'}),q('2','CT noise 的測量')];assert.deepEqual(selectPracticeQuestions(input,{keyword:'ct NOISE'}).map(x=>x.id),['2','1']);assert.equal(input[0].id,'1');assert.deepEqual(questionRelevance(input[0],'CT noise').matches,['選項'])
})
test('Chinese concept and fullwidth English normalize; years and cross-subject scope hold',()=>{
 const input=[q('1','粒線體 CT',{}, {year:109}),q('2','粒線體 CT',{}, {subject:'核子醫學診療原理與技術學'}),q('3','粒線體 CT')];assert.deepEqual(selectPracticeQuestions(input,{keyword:'粒線體 ＣＴ',startYear:110,endYear:110}).map(x=>x.id).sort(),['2','3']);assert.equal(selectPracticeQuestions(input,{keyword:'粒線體 CT',subject:'基礎醫學',startYear:110,endYear:110}).length,1)
})
test('unreviewed tags and image filenames do not match; all query terms required',()=>{
 const input=[q('1','{{image:ct-noise.png}}',{}, {explanation:{tags:['CT noise']}}),q('2','CT alone')];assert.equal(selectPracticeQuestions(input,{keyword:'CT noise'}).length,0);assert.equal(selectPracticeQuestions(input,{keyword:'不存在'}).length,0)
})
test('sourced tags provide an explicit match reason without pretending expert approval',()=>{
 const item=q('1','題目',{}, {sourcedTags:[{label:'CT 雜訊',source:'https://example.org/source',page:1,status:'source-aligned'}]});assert.deepEqual(questionRelevance(item,'雜訊').matches,['來源標籤']);assert.equal(selectPracticeQuestions([item],{keyword:'雜訊'}).length,1)
})
test('paper ignores keyword ranking and keeps original number order',()=>{
 const input=[q('2','CT noise'),q('1','其他')];assert.deepEqual(selectPracticeQuestions(input,{mode:'paper',paper:paperId(input[0]),keyword:'CT noise'}).map(x=>x.id),['1','2'])
})
test('equal relevance has deterministic exam order and whitespace means no ranking',()=>{
 const input=[q('2','CT'),q('1','CT')];assert.deepEqual(selectPracticeQuestions(input,{keyword:'CT'}).map(x=>x.id),['1','2']);assert.deepEqual(selectPracticeQuestions(input,{keyword:'  '}).map(x=>x.id),['1','2']);assert.equal(selectPracticeQuestions(input,{keyword:'CT',startYear:111,endYear:110}).length,0)
})

test('English acronym matches word boundaries, including Chinese adjacency, not function or SPECT',()=>{
 const input=[q('1','function noise'),q('2','SPECT noise'),q('3','CT雜訊 noise'),q('4','CT/MRI noise')];assert.deepEqual(selectPracticeQuestions(input,{keyword:'CT noise'}).map(q=>q.id),['3','4'])
})

test('visible lexical score inputs rank monotonically after year and subject filters, with stable numbered ties',()=>{
 const keyword='CT noise'
 const input=[
  q('3','其他',{A:'CT noise'}),
  q('2','CT noise 的測量'),
  q('1','CT noise 的測量'),
  q('4','CT noise',{A:'CT noise'},{year:109}),
  q('5','CT noise',{A:'CT noise'},{subject:'核子醫學診療原理與技術學'}),
 ]
 const results=selectPracticeQuestions(input,{keyword,startYear:110,endYear:110,subject:'基礎醫學'})
 assert.deepEqual(results.map(row=>row.id),['1','2','3'])
 assert.deepEqual(results.map(row=>questionRelevance(row,keyword).score),[28,28,14])
 assert.equal(questionRelevance(results[0],'  ').score,0)
})
