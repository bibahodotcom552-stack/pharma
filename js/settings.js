// API key, model list (auto-discovers free Gemini Flash models), passes.
/* ================= SETTINGS ================= */
function toggleSettings(){ const s=$('#settings'); s.style.display = s.style.display==='none'?'block':'none'; }
function saveKey(){ const d=store.get(); d.key=$('#apikey').value.trim(); store.set(d); loadModels(); }
async function loadModels(){
  const key=$('#apikey').value.trim(); if(!key){alert('Paste the API key first');return}
  const sel=$('#model');
  if(key==='MOCK'){ sel.innerHTML='<option>mock</option>'; return; }
  sel.innerHTML='<option>loading…</option>';
  try{
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',{headers:{'x-goog-api-key':key}});
    const j=await r.json(); if(!r.ok) throw new Error(j.error?.message||r.status);
    let ms=j.models.filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent'))
      .map(m=>m.name.replace('models/',''))
      .filter(n=>/gemini/i.test(n)&&!/(tts|image|live|audio|embed|veo|imagen|robotics|computer)/i.test(n));
    const ver=n=>{const m=n.match(/(\d+(?:\.\d+)?)/);return m?parseFloat(m[1]):0};
    const score=n=>ver(n)*10+(/flash/i.test(n)?3:0)-(/lite/i.test(n)?1:0)-(/preview|exp/i.test(n)?2:0)-(/pro/i.test(n)?5:0);
    ms.sort((a,b)=>score(b)-score(a));
    sel.innerHTML=ms.map(m=>`<option>${m}</option>`).join('');
    const d=store.get(); if(d.model&&ms.includes(d.model)) sel.value=d.model;
    d.models=ms; store.set(d);
  }catch(e){ sel.innerHTML=''; alert('Model list failed: '+e.message); }
}
$('#model').onchange=()=>{const d=store.get();d.model=$('#model').value;store.set(d)};
$('#passes').onchange=()=>{const d=store.get();d.passes=$('#passes').value;store.set(d)};
$('#tbOn').onchange=()=>{const d=store.get();d.tbOn=$('#tbOn').checked;store.set(d)};
