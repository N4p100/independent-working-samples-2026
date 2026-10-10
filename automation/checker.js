'use strict';
function reviewCapture(capture) {
  const findings=[];
  const flag=(code,detail)=>findings.push({code,detail});
  if(!capture || Array.isArray(capture) || typeof capture!=='object') throw new Error('Capture must be a JSON object.');
  const calls=capture.request?.message?.toolCallList;
  if(!Array.isArray(calls)||!calls.length){flag('REQUEST','A nonempty message.toolCallList is required.');return findings;}
  const ids=calls.map(c=>c?.id);
  if(ids.some(x=>typeof x!=='string'||!x)){flag('REQUEST_ID','Requested calls need nonempty string IDs.');return findings;}
  if(new Set(ids).size!==ids.length)flag('DUPLICATE_REQUEST_ID','Requested call IDs are not unique.');
  if(capture.http_status!==200)flag('HTTP_STATUS','Synchronous Function responses require HTTP 200.');
  const results=capture.response?.results;
  if(!Array.isArray(results)){flag('RESULTS_ARRAY','Response must contain a results array.');return findings;}
  const seen=new Map();
  results.forEach((r,i)=>{
    if(!r||Array.isArray(r)||typeof r!=='object'){flag('RESULT_OBJECT',`Result ${i} must be an object.`);return;}
    if(typeof r.toolCallId!=='string'||!r.toolCallId)flag('RESULT_ID',`Result ${i} lacks a nonempty string toolCallId.`);
    else {seen.set(r.toolCallId,(seen.get(r.toolCallId)||0)+1);if(!ids.includes(r.toolCallId))flag('UNKNOWN_ID',`Result ${i} refers to an unrequested call.`);}
    const fields=['result','error'].filter(k=>Object.hasOwn(r,k));
    if(fields.length!==1)flag('OUTCOME',`Result ${i} needs exactly one of result or error.`);
    fields.forEach(k=>{if(typeof r[k]!=='string')flag('STRING_OUTCOME',`Result ${i} ${k} must be a string.`);else if(/[\r\n]/.test(r[k]))flag('LINE_BREAK',`Result ${i} ${k} contains a line break.`);});
  });
  new Set(ids).forEach(id=>{if(!seen.get(id))flag('MISSING_ID','A requested call has no response.');else if(seen.get(id)>1)flag('DUPLICATE_RESULT','A requested call has multiple responses.');});
  return findings;
}
if(typeof module!=='undefined')module.exports={reviewCapture};
