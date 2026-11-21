// Local stdout draft only; deliberately not an operation of the lookup tool.
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { openQuestionLookup } from './question-lookup.mjs'
import { createQuestionIssueDraft } from '../src/utils/questionIssueDraft.js'
export async function makeLocalCorrectionDraft(lookup,input) {
 if (!input || typeof input!=='object' || Array.isArray(input) ||
     Object.keys(input).some(k=>!['id','category','description','evidence','imageId'].includes(k))) throw Error('unsupported draft fields')
 const {catalog,result}=await lookup({op:'fetch',id:input.id})
 if (!result) throw Error('unknown exact question id')
 return createQuestionIssueDraft({question:{id:result.id,year:result.year,exam_round:result.examRound,subject:result.subject,question_number:result.questionNumber},
  snapshotId:catalog.indexSha256+':'+catalog.keyMapSha256,officialSourceUrl:result.source?.url,
  category:input.category,description:input.description,evidence:input.evidence,imageId:input.imageId})
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 try {
  if (process.argv.length!==3) throw Error('missing local catalog')
  let raw=''
  for await(const b of process.stdin){raw+=b;if(Buffer.byteLength(raw)>12000)throw Error('draft input too long')}
  console.log(JSON.stringify(await makeLocalCorrectionDraft(await openQuestionLookup(process.argv[2]),JSON.parse(raw))))
 } catch {
  console.error(JSON.stringify({error:'invalid-local-draft-or-unavailable-catalog'}));process.exitCode=1
 }
}
