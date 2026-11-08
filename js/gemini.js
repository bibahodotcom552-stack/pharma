// Gemini REST call with 429 back-off. API key "MOCK" returns canned data for offline testing.
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gemini(b64,pass){
  const d=store.get(); const key=d.key||$('#apikey').value.trim(); const model=$('#model').value||d.model;
  if(key==='MOCK') return mockReply(pass);
  if(!key||!model) throw new Error('Set API key & model in ⚙️ settings');
  const body={contents:[{role:'user',parts:[{text:BASE+'\n\n'+PASS_TXT[pass]},{inline_data:{mime_type:'image/jpeg',data:b64}}]}],
    generationConfig:{temperature:0,responseMimeType:'application/json',responseSchema:SCHEMA}};
  for(let attempt=0;attempt<5;attempt++){
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    if(r.status===429||r.status>=500){
      let wait=30; const ri=(j.error?.details||[]).find(x=>x.retryDelay); if(ri) wait=parseInt(ri.retryDelay)+2;
      if(/per day|PerDay/i.test(j.error?.message||'')) throw new Error('Daily free quota used up — try again after ~2 PM Bangladesh time (midnight Pacific).');
      log(`  ⏳ rate-limited, waiting ${wait}s…`); await sleep(wait*1000); continue;
    }
    if(!r.ok) throw new Error(j.error?.message||('HTTP '+r.status));
    const txt=(j.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('');
    try{ return JSON.parse(txt); }catch(e){ const m=txt.match(/\{[\s\S]*\}/); if(m) return JSON.parse(m[0]); throw new Error('Unreadable AI reply'); }
  }
  throw new Error('Too many retries');
}

/* Offline test data — used when API key is "MOCK". Pass 2 deliberately disagrees once so flags can be tested. */
async function mockReply(pass){
  await sleep(300);
  const e=[{row:1,col:25,qty:pass?16:10,raw:'10',confident:true},
           {row:3,col:0,extra_name:pass?'Famotidine 20 mg':'Famotidine 20mg',qty:6,raw:'6',confident:true},
           {row:5,col:23,qty:2,raw:'2',confident:pass===1}];
  return {half:'B',entries:e,extra_columns:pass?[]:[{as_written:'Famotid 20mg',interpreted:'Famotidine 20mg'}],notes:pass?[]:['mock data']};
}
