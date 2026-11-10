// Gemini REST call with 429 back-off. API key "MOCK" returns canned data for offline testing.
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// pass 0 / 1 = full readings; pass 'tb' = tie-break of the cells in `tb` = {half,list}
async function gemini(b64,pass,tb){
  const d=store.get(); const key=d.key||$('#apikey').value.trim(); const model=$('#model').value||d.model;
  if(key==='MOCK') return mockReply(pass,tb);
  if(!key||!model) throw new Error('Set API key & model in ⚙️ settings');
  const body={contents:[{role:'user',parts:[{text:BASE+'\n\n'+(pass==='tb'?tbText(tb.half,tb.list):PASS_TXT[pass])},{inline_data:{mime_type:'image/jpeg',data:b64}}]}],
    generationConfig:{temperature:0,responseMimeType:'application/json',responseSchema:pass==='tb'?TB_SCHEMA:SCHEMA}};
  for(let attempt=0;attempt<5;attempt++){
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    if(r.status===429||r.status>=500){
      let wait=30; const ri=(j.error?.details||[]).find(x=>x.retryDelay); if(ri) wait=parseInt(ri.retryDelay)+2;
      if(/per day|PerDay/i.test(j.error?.message||'')){ const er=new Error(`Daily free quota used up for ${model}.`); er.quota=true; throw er; }
      log(`  ⏳ rate-limited, waiting ${wait}s…`); await sleep(wait*1000); continue;
    }
    if(!r.ok) throw new Error(j.error?.message||('HTTP '+r.status));
    const txt=(j.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('');
    try{ return JSON.parse(txt); }catch(e){ const m=txt.match(/\{[\s\S]*\}/); if(m) return JSON.parse(m[0]); throw new Error('Unreadable AI reply'); }
  }
  throw new Error('Too many retries');
}

/* Offline test data — used when API key is "MOCK". Pass 2 deliberately disagrees so flags + tie-break can be tested.
   Tests may set window.mockDates = ['01-11-26','', …]: one sheet date per photo (read on pass 1). */
let mockDate='', mockHalf='B';   // tests may also set window.mockHalves = ['A','B',…]
async function mockReply(pass,tb){
  await sleep(200);
  if(window.mockQuota){ const er=new Error('Daily free quota used up for mock.'); er.quota=true; throw er; }   // tests: simulate the daily limit
  if(pass==='tb') return {cells:tb.list.map((c,i)=>({n:i+1,qty:c.row===1?10:3,confident:true}))};   // row 1: agrees with pass 1 -> settled; row 5: a 3rd different number -> stays flagged
  if(pass===0){ mockDate=(window.mockDates&&window.mockDates.length)?window.mockDates.shift():''; mockHalf=(window.mockHalves&&window.mockHalves.length)?window.mockHalves.shift():'B'; }
  const e=[{row:1,col:25,qty:pass?16:10,raw:'10',confident:true},
           {row:3,col:0,extra_name:pass?'Famotidine 20 mg':'Famotidine 20mg',qty:6,raw:'6',confident:true},
           {row:5,col:23,qty:2,raw:'2',confident:pass===1}];
  return {half:mockHalf,sheet_date:mockDate,entries:e,extra_columns:pass?[]:[{as_written:'Famotid 20mg',interpreted:'Famotidine 20mg'}],notes:pass?[]:['mock data']};
}
