import { readFile, stat } from 'node:fs/promises'
import {setTimeout as delay} from 'node:timers/promises'
export async function readAsset(path, timeoutMs = 30000, io = {readFile,stat}) {
  const deadline=Date.now()+timeoutMs
  let lastError
  for(let attempt=0;attempt<2;attempt++) {
    try {
      const expected=(await io.stat(path)).size
      const bytes=await io.readFile(path,{signal:AbortSignal.timeout(Math.max(1,deadline-Date.now()))})
      if(bytes.length!==expected) throw Object.assign(new Error(`Incomplete file read: expected ${expected} bytes, received ${bytes.length}`),{code:'ASSET_SHORT_READ'})
      return bytes
    } catch(error) {
      lastError=error
      if(error.code==='ENOENT' || Date.now()>=deadline) break
      if(attempt===0) await delay(Math.min(250,Math.max(0,deadline-Date.now())))
    }
  }
  throw new Error(`Asset read failed/timed out: ${path}: ${lastError.message}`, {cause:lastError})
}
export async function mapAssets(items, callback, concurrency = 8) {
  let index = 0, completed = 0, failed = false
  await Promise.all(Array.from({length: Math.min(concurrency,items.length)}, async () => {
    while (!failed && index < items.length) {
      const i = index++
      try { await callback(items[i], i) } catch (e) { failed = true; throw e }
      completed++
      if (completed % 250 === 0 || completed === items.length) console.log(`[assets] ${completed}/${items.length}`)
    }
  }))
}
