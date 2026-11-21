import test from 'node:test'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,symlink,rename} from 'node:fs/promises'
import {openQuestionLookup} from '../scripts/question-lookup.mjs'
const shared = new URL('../.cache/',import.meta.url)
const make = async () => {
 await mkdir(shared,{recursive:true})
 const root=await mkdtemp(fileURLToPath(new URL('question-lookup-',shared)))
 const subject='放射線診斷原理與技術學',subjectSlug='diagnostic-techniques',year=103
 const filePath='/data/questions/diagnostic-techniques/103.json'
 await mkdir(root+'/data/questions/diagnostic-techniques',{recursive:true})
 const output=(p,o)=>writeFile(root+p,JSON.stringify(o))
 const src={contentStatus:'transcription-reviewed',questionPage:1,questionSha256:'f'.repeat(64),questionUrl:'https://wwwq.moex.gov.tw/exam/wHandExamQandA_File.ashx?t=Q&code=103020&c=308&s=44&q=1'}
 const first={id:'q1',question_number:1,subject,year,exam_round:'第一次',question:'CT 假體 {{image:private-file.png}}',options:{A:'1',B:'2',C:'3',D:'4'},answer:'A',explanation:'do not return',sourceProvenance:src}
 const rows=[{...first,id:'q2',question_number:2},first,{...first,id:'q3',question_number:3,sourceProvenance:null},{...first,id:'q4',question_number:4,sourceProvenance:{...src,questionUrl:'https://invalid.example/t?x=Q'}}]
 await Promise.all([
  output('/data/question-index.json',[{subject,subjectSlug,year,questionCount:rows.length,filePath}]),
  output('/data/question-key-map.json',{q1:filePath,q2:filePath,q3:filePath,q4:filePath,alias:filePath,'unsafe':'/private.json'}),
  output(filePath,rows),
 ])
 return {root,filePath}
}
test('query sorts ties by original number and only serves field-projected source-linked transcriptions',async()=>{
 const {root}=await make();const lookup=await openQuestionLookup(root)
 const found=await lookup({op:'search',query:'假體',startYear:103,endYear:103,subject:'diagnostic-techniques',limit:1})
 assert.equal(found.total,2);assert.deepEqual(found.results.map(q=>q.id),['q1'])
 const result=(await lookup({op:'fetch',id:'q1'})).result
 assert.match(result.stem,/見官方原卷/);assert.ok(!JSON.stringify(result).includes('private-file.png'))
 assert.equal(result.source.url.endsWith('#page=1'),true)
 for(const k of ['answer','explanation','sourceProvenance'])assert.ok(!Object.hasOwn(result,k))
 assert.equal((await lookup({op:'fetch',id:'q3'})).result.status,'source-not-verified-for-lookup')
 assert.equal((await lookup({op:'fetch',id:'q4'})).result.stem,undefined)
 assert.equal((await lookup({op:'fetch',id:'alias'})).result,null)
})
test('rejects unsupported operations, scope, request path, key-map traversal and symlinks',async()=>{
 const {root,filePath}=await make();const lookup=await openQuestionLookup(root)
 for(const req of [{op:'update',id:'q1'},{op:'fetch',id:'q1',path:'/other'},{op:'search',query:'CT',startYear:100,endYear:115},{op:'search',query:'CT',startYear:103,endYear:103,subject:'unknown'},{op:'fetch',id:'unsafe'}])await assert.rejects(()=>lookup(req))
 await rename(root+filePath,root+'/shifted.json');await symlink(root+'/shifted.json',root+filePath)
 await assert.rejects(()=>lookup({op:'fetch',id:'q1'}),/symlink/)
})

test('cross-subject query operates only inside bounded indexed year and correction draft never changes the source',async()=>{
 const {root,filePath}=await make()
 const {readFile}=await import('node:fs/promises')
 const {EXAM_SUBJECTS}=await import('../src/constants/subjects.js')
 const {makeLocalCorrectionDraft}=await import('../scripts/question-correction-draft.mjs')
 const other=EXAM_SUBJECTS.find(s=>s.slug==='basic')
 const [entry]=JSON.parse(await readFile(root+'/data/question-index.json'))
 const before=await readFile(root+filePath)
 const [src]=JSON.parse(before)
 const otherPath='/data/questions/basic/104.json'
 await mkdir(root+'/data/questions/basic')
 await writeFile(root+otherPath,JSON.stringify([{...src,id:'q104',year:104,subject:other.name}]))
 await writeFile(root+'/data/question-index.json',JSON.stringify([entry,{filePath:otherPath,year:104,subjectSlug:other.slug,subject:other.name,questionCount:1}]))
 const lookup=await openQuestionLookup(root)
 assert.deepEqual((await lookup({op:'search',query:'假體',startYear:103,endYear:104})).results.map(q=>q.id),['q1','q2','q104'])
 assert.deepEqual((await lookup({op:'search',query:'假體',startYear:103,endYear:104,subject:'basic'})).results.map(q=>q.id),['q104'])
 const draft=await makeLocalCorrectionDraft(lookup,{id:'q1',category:'question',description:'Synthetic report only'})
 assert.equal(draft.status,'local-draft');assert.equal(draft.reference.questionId,'q1')
 assert.equal(draft.reference.officialSourceUrl.endsWith('#page=1'),true)
 assert.deepEqual(await readFile(root+filePath),before)
 await assert.rejects(()=>makeLocalCorrectionDraft(lookup,{id:'q1',category:'question',description:'x',question:{id:'other'}}))
 await assert.rejects(()=>lookup({op:'correct',id:'q1'}))
})
