// Keeps the photo list across a page reload (IndexedDB, on this phone only), so a stop on the free daily limit
// can continue the next day. Stored: the MASKED upright copy (only until that photo is read) + cleaned results.
// Never stored: the original photo, AI free text that was not filtered.
const KEEP_DB='ledgerAuditPhotos';
let keepReady=Promise.resolve();   // app.js sets it to keepLoad(); new photos wait for it (no duplicate photo numbers)
let keepDb=null;
function keepOpen(){
  if(keepDb) return keepDb;
  keepDb=new Promise((ok,no)=>{ try{ const r=indexedDB.open(KEEP_DB,1);
    r.onupgradeneeded=()=>r.result.createObjectStore('p',{keyPath:'id'});
    r.onsuccess=()=>ok(r.result); r.onerror=()=>no(r.error); }catch(e){ no(e); } });
  return keepDb;
}
async function keepTx(mode,fn){
  try{ const db=await keepOpen(); return await new Promise((ok,no)=>{ const t=db.transaction('p',mode), s=t.objectStore('p'); const r=fn(s);
    t.oncomplete=()=>ok(r&&r.result); t.onerror=()=>no(t.error); t.onabort=()=>no(t.error||new Error('storage full?'));
    setTimeout(()=>no(new Error('photo store timeout')),8000); }); }
  catch(e){ console.warn('photo store:',e); return null; }
}
function keepPut(p){
  if(!p.baked) return Promise.resolve();             // nothing is stored before Start (until then nothing was confirmed)
  // a photo sent WITHOUT black-out (you tapped "Send anyway"), or a right half the AI says is a left half: never store its image
  const safe=(p.masked||p.noNames)&&!(p.status==='done'&&p.half==='A'&&!p.masked);
  const rec={id:p.id,no:p.no,date:p.date,dateFix:p.dateFix||'',status:p.status==='run'?'new':p.status,half:p.half||'',autoHalf:p.autoHalf||'',
    masked:p.masked,noNames:p.noNames,res:p.res||[],tb:p.tb||null,sheetDate:p.sheetDate||'',savedEff:p.savedEff||'',thumb:safe?(p.thumb||''):'',
    jpeg:p.status==='done'||!safe?null:p.file};                // the photo itself is dropped as soon as it has been read
  return keepTx('readwrite',s=>s.put(rec));
}
const keepDel = id => keepTx('readwrite',s=>s.delete(id));
const keepClear = () => keepTx('readwrite',s=>s.clear());
async function keepLoad(){
  const all=await keepTx('readonly',s=>s.getAll()); if(!all||!all.length) return;
  for(const r of all.sort((a,b)=>a.no-b.no)){
    if(photos.some(p=>p.id===r.id)) continue;
    if(!r.jpeg&&r.status!=='done'){ keepDel(r.id); continue; }   // not kept (sent without black-out): add it again if needed
    const p={...r,file:r.jpeg||null,url:r.jpeg?URL.createObjectURL(r.jpeg):r.thumb,rot:0,rects:[],polys:[],baked:true,auto:false,prep:'',page:r.no};
    delete p.jpeg; photos.push(p);
  }
  renderPhotos();
  const left=photos.filter(p=>p.status!=='done'&&p.file).length;
  if(left) $('#pending').innerHTML=`⏸ <b>${left} photo(s) waiting from last time</b> (already masked). Tap <b>▶ Start audit</b> to continue — only these are read.`;
}
