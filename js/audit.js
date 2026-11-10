// runAudit() loop, sheet dates, 3rd "tie-break" reading, reconcile(): merges the readings per cell, flags the rest.
/* ================= AUDIT ================= */
function log(s){ const l=$('#log'); l.textContent+=s+'\n'; l.scrollTop=l.scrollHeight; }
const norm=s=>(s||'').toLowerCase().replace(/tab(let)?s?|cap(sule)?s?|syp|syrup|inj|\bpid\b|[^a-z0-9.]/g,'').replace(/\.(?!\d)/g,'');
function drugOf(half,col,extra){
  if(col>0){ const arr=half==='A'?HALF_A:HALF_B; if(col<=arr.length) return {k:half+col,label:arr[col-1]}; }
  const label=scrub(extra,60)||'Unknown handwritten drug'; return {k:'X:'+norm(label),label,extra:true};
}
// "29-06-26", "29/6/2026" -> "2026-06-29"; anything odd -> '' (then the date is taken from the photo before)
function parseSheetDate(s){
  const m=String(s||'').match(/(\d{1,2})\s*[-\/.,]\s*(\d{1,2})\s*[-\/.,]\s*(\d{2,4})/); if(!m) return '';
  let d=+m[1], mo=+m[2], y=+m[3]; if(y<100) y+=2000;
  const t=new Date(Date.UTC(y,mo-1,d)); if(t.getUTCMonth()!==mo-1||t.getUTCDate()!==d) return '';
  if(t.getTime()>Date.now()+2*864e5||t.getTime()<Date.now()-730*864e5) return '';
  return t.toISOString().slice(0,10);
}
// AI reply -> only what we need, filtered for names BEFORE it is kept anywhere
function cleanRes(r){ r=r||{}; return {half:r.half==='B'?'B':'A', sheet_date:parseSheetDate(r.sheet_date),
  entries:(r.entries||[]).map(e=>({row:+e.row||0,col:+e.col||0,qty:+e.qty||0,confident:e.confident!==false,raw:rawNum(e.raw),extra_name:scrub(e.extra_name,60)})),
  extra_columns:(r.extra_columns||[]).map(x=>({as_written:scrub(x.as_written,60),interpreted:scrub(x.interpreted,60)})),
  notes:(r.notes||[]).map(n=>scrub(n))}; }
// one AI call; on "daily free limit used up" move to the next free Flash model and try again
async function askAI(b64,pass,tb,tried){ for(;;){ try{ return await gemini(b64,pass,tb); }catch(e){ if(e.quota&&switchModel(tried)) continue; throw e; } } }

async function runAudit(){
  if(!photos.length){alert('Add photos first');return}
  if(photos.some(p=>p.prep)){alert('Still preparing the photos on the phone — wait a few seconds.');return}
  const todo=photos.filter(p=>p.status!=='done'&&p.file);
  if(!todo.length){alert('All photos are already read and saved.\nTap "Clear all photos" to start a new batch.');return}
  const unsafe=todo.filter(p=>!p.masked&&!p.noNames);
  if(unsafe.length && !confirm(`${unsafe.length} photo(s) marked ❗ have no black-out and are not marked "No names".\nPatient names could be sent to Google.\n\nSend anyway?`)) return;
  const auto=todo.filter(p=>p.auto&&(p.masked||p.noNames));
  if(auto.length){
    if(!confirm(`Quick privacy look (10 seconds): ${auto.length} photo(s) were prepared AUTOMATICALLY.\nIn the small previews, every LEFT half (names side) must show a black bar over the names / P-No column. Right halves have no names column.\n\nOK = looked, all fine. Cancel = go back (tap Mask on any photo to fix it).`)) return;
    auto.forEach(p=>p.auto=false); renderPhotos();
  }
  const passes=+$('#passes').value||2, tbOn=passes>1&&$('#tbOn').checked;
  if(todo.length>2 && !confirm(`${todo.length} photo(s) to read = about ${todo.length*passes} AI requests${tbOn?' (+ one short 3rd reading for photos with disagreements)':''}.\nEach date is saved as soon as its photos are read. If the free daily limit runs out, the app tries another free model; if all are used up it stops — open the app later and tap Start again (the photos stay on this phone).\n\nStart?`)) return;
  $('#runBtn').disabled=true; $('#log').textContent=''; $('#pending').textContent='';
  log('🔒 Keeping masked copies on this phone (for resuming)…');
  for(const p of todo){ try{ await bake(p); }catch(e){} }
  renderPhotos();
  todo.sort((a,b)=>(a.date?0:1)-(b.date?0:1)||String(a.date).localeCompare(String(b.date))||a.no-b.no);
  const total=todo.length*passes; let done=0, stop=false, saved=0; const tried=new Set([$('#model').value]);
  const bar=()=>$('#bar').style.width=(100*done/total)+'%'; bar();
  for(const p of todo){
    p.status='run'; p.res=[]; p.tb=null; renderPhotos();
    try{
      log(`📷 Photo ${p.no}${p.date?' · '+fmtD(p.date):''}`);
      const b64=await prepImage(p);
      for(let k=0;k<passes;k++){
        log(`  🔎 reading ${k+1}/${passes} (${k?'column-wise':'row-wise'})…`);
        p.res.push(cleanRes(await askAI(b64,k,null,tried))); done++; bar();
      }
      p.half=p.res[0].half;
      const ds=p.res.map(r=>r.sheet_date).filter(Boolean);
      p.sheetDate = ds.length&&ds.every(x=>x===ds[0]) ? ds[0] : '';
      if(ds.length>1&&!p.sheetDate) log('  📅 the two readings saw different dates — date taken from the photo before');
      if(tbOn){ const list=disputes(p);
        if(list.length){ log(`  ⚖ 3rd reading of ${list.length} disputed cell(s)…`);
          try{ p.tb=tbMap(await askAI(b64,'tb',{half:p.half,list},tried),list); }catch(e){ log('  (3rd reading skipped: '+e.message+')'); if(e.quota) stop=true; } } }
      if(p.autoHalf==='B'&&p.half==='A') log(`  ⚠ PRIVACY: the AI says photo ${p.no} is a LEFT half (names side), but the phone sent it without a black-out. Check this photo.`);
      p.status='done';
      log(`  ✔ half ${p.half}${p.sheetDate?' · date '+fmtD(p.sheetDate):''}: ${p.res.map(r=>r.entries.length).join(' / ')} entries`);
    }catch(e){
      log('  ✖ '+e.message); done+=passes-p.res.length; bar();
      if(e.quota||/quota|API key|model/i.test(e.message)){ p.status='new'; stop=true; } else p.status='err';
    }
    await keepPut(p); renderPhotos();
    saved+=saveReadyDates();
    if(stop) break;
  }
  $('#runBtn').disabled=false;
  const left=photos.filter(p=>p.status!=='done'), nod=photos.filter(p=>p.status==='done'&&!dateOf(p));
  if(stop) log(`\n⏸ Stopped: free daily limit used up (or key/model problem). ${left.length} photo(s) left.\nThey stay on this phone: open the app after ~2 PM Bangladesh time and tap Start again — only those are read.`);
  else log(left.length? `\n⚠ Finished, but ${left.length} photo(s) had errors. Tap Start again to retry them.` : '\n✅ Finished.');
  if(nod.length) log(`❗ No date could be read for photo(s) ${nod.map(p=>p.no).join(', ')}. Type the date in the 📅 box on those photos — they are saved then.`);
  if(saved) log(`💾 ${saved} date(s) saved.`);
  if(lastSaved){ day=(store.get().days||{})[lastSaved]||day; } if(day) render();
  const ds=[...new Set(todo.filter(p=>p.status==='done').map(dateOf).filter(Boolean))].sort();
  if(ds.length>1&&saved){ $('#pFrom').value=ds[0]; $('#pTo').value=ds[ds.length-1]; renderPeriod(); $('#periodCard').scrollIntoView({behavior:'smooth'}); }
}
// On a daily-quota error: move to the next free Flash model not tried yet (each model has its own daily limit).
function switchModel(tried){
  const d=store.get(); const next=(d.models||[]).find(m=>/flash/i.test(m)&&!/pro/i.test(m)&&!tried.has(m));
  if(!next) return false;
  tried.add(next); $('#model').value=next; log(`  🔁 daily limit reached — switching to ${next}`); return true;
}

/* ---- dates ---- */
// The date is handwritten only on LEFT halves (top of the names column). Photos without a readable date (right halves)
// are placed by upload/gallery order: between two different dates, the earlier date first takes as many right halves
// as it still needs (each page = 1 left + 1 right half), the rest go to the next date.
// One odd date between two equal dates is noted for you to check.
function assignDates(){
  const A=photos.filter(p=>!p.date).sort((a,b)=>a.no-b.no);
  // known: your correction, else the date read on the sheet, else the date it was already saved under (placements stick)
  const k0=A.map(p=>p.dateFix||(p.status==='done'?(p.sheetDate||p.savedEff):'')||''), known=[...k0], idx=k0.map((v,i)=>v?i:-1).filter(i=>i>=0);
  // a date that differs from the same date on both sides is only NOTED (it may be a mis-read) — never changed by itself
  idx.forEach((i,j)=>{ A[i].dateNote='';
    if(A[i].dateFix||!A[i].sheetDate||j===0||j===idx.length-1) return;
    const pv=k0[idx[j-1]], nx=k0[idx[j+1]];
    if(pv===nx&&k0[i]!==pv) A[i].dateNote=`Photo ${A[i].no}: date read as ${fmtD(k0[i])}, but the photos before and after are ${fmtD(pv)} — check this photo's date.`; });
  const cnt={}, first=known.find(Boolean)||'';
  const put=(p,d)=>{ p.eff=d; if(d&&p.status==='done'){ const c=cnt[d]=cnt[d]||{A:0,B:0}; c[p.half==='B'?'B':'A']++; } };
  let cur='';
  for(let j=0;j<A.length;){
    if(known[j]){ cur=known[j]; put(A[j],cur); j++; continue; }
    let e=j; while(e<A.length&&!known[e]) e++;                 // photos j..e-1 have no date
    const next=e<A.length?known[e]:'';
    if(!cur||!next||next===cur) for(let q=j;q<e;q++) put(A[q],cur||next||first);
    else { let need=Math.max(0,(cnt[cur]||{A:0}).A-(cnt[cur]||{B:0}).B);
      for(let q=j;q<e;q++){ const p=A[q]; if(need>0){ put(p,cur); need+=p.half==='B'?-1:1; } else put(p,next); } }
    j=e;
  }
}
// Save every date whose photos are all read. Returns how many dates were (re)saved.
const savedSig={}; let lastSaved='';
function saveReadyDates(){
  assignDates();
  const by={}; for(const p of photos){ const d=dateOf(p); if(d) (by[d]=by[d]||[]).push(p); }
  const st=store.get(); st.days=st.days||{}; let n=0;
  for(const [d,ps] of Object.entries(by)){
    if(!ps.every(p=>p.status==='done'||p.status==='err')||!ps.some(p=>p.status==='done')) continue;
    const sig=ps.map(p=>p.id+p.status+(p.dateNote||'')+(p.tb?1:0)).join();
    if(savedSig[d]===sig) continue;
    st.days[d]={...keepEdits(buildDay(d,ps),st.days[d]),saved:Date.now()}; savedSig[d]=sig; lastSaved=d; n++;
    for(const p of ps) if(p.savedEff!==d){ p.savedEff=d; keepPut(p); }
  }
  // a date made only from these photos that now has none (you changed their date): remove it — unless you edited it
  for(const [d,dd] of Object.entries(st.days)){
    if(by[d]||!dd.ids||!dd.ids.length||Object.values(dd.cells).some(c=>c.half==='M'||c.ok)) continue;
    if(dd.ids.every(id=>photos.some(p=>p.id===id))){ delete st.days[d]; delete savedSig[d]; n++; }
  }
  if(n){ store.set(st); fillHistory();
    if(day&&day.date){ day=st.days[day.date]||null; if(day) render(); else $('#resultCard').style.display='none'; } }   // screen = what is saved
  return n;
}
function buildDay(date,ps){
  const d={date,cells:{},notes:[],extras:{},pages:ps.length,photos:ps.length,ids:ps.map(p=>p.id)};
  const miss=ps.filter(p=>p.status!=='done').length;
  if(miss){ d.missing=miss; d.notes.push(`${miss} photo(s) could not be read — totals for this date are INCOMPLETE. Tap Start again to retry, or add entries manually.`); }
  const guessed=ps.filter(p=>!p.date&&!p.dateFix&&!p.sheetDate&&p.status==='done').map(p=>p.no);
  if(guessed.length) d.notes.push(`Photo(s) ${guessed.join(', ')}: no date on the sheet (right half) — date chosen from the gallery order. Change it on the photo if wrong.`);
  for(const p of ps) if(p.dateNote) d.notes.push(p.dateNote);
  reconcile(d,ps); return d;
}
// Re-reading a date that was saved before: keep your ✔ confirmed numbers, manual entries and renamed handwritten drugs.
// Cells of a photo you removed from the list stay counted (unless ALL photos of the date are new = a fresh re-audit).
function keepEdits(d,old){
  if(!old) return d;
  const now=new Set(photos.map(p=>p.id)), overlap=(old.ids||[]).some(id=>d.ids.includes(id));
  let lost=0;
  for(const [k,c] of Object.entries(old.cells||{})){
    if(c.half==='M'){ d.cells[k]=c; continue; }
    if(overlap&&c.pid&&!now.has(c.pid)){ d.cells[k]=c; if(!d.ids.includes(c.pid)) d.ids.push(c.pid); continue; }
    const n=d.cells[k]; if(!n){ if(c.ok&&overlap) lost++; continue; }
    if(c.ok){ n.final=c.final; n.ok=true; }
    if(c.extra&&c.dk!==n.dk){ n.dk=c.dk; n.label=c.label; }
  }
  if(lost) d.notes.push(`${lost} number(s) you had confirmed ✔ could not be matched after re-reading — check them again.`);
  d.extras={}; for(const c of Object.values(d.cells)) if(c.extra) d.extras[c.dk]=d.extras[c.dk]||c.label;
  return d;
}
/* ---- cells ---- */
function cellMaps(p){   // one map per reading: "row|drugKey" -> {qty,conf,raw,d,col}
  return p.res.map(r=>{ const m={};
    for(const e of r.entries||[]){
      if(!(e.row>=1&&e.row<=ROWS)||!(e.qty>0)) continue;
      const d=drugOf(p.half,e.col,e.extra_name), k=e.row+'|'+d.k, raw=e.raw||String(e.qty);
      if(m[k]){ m[k].qty+=e.qty; m[k].conf=false; m[k].raw+='+'+raw; } else m[k]={qty:e.qty,conf:e.confident,raw,d,col:e.col};
    }
    return m; });
}
function disputes(p){
  const [a,b]=cellMaps(p), out=[];
  for(const k of new Set([...Object.keys(a),...Object.keys(b||{})])){
    const x=a[k], y=b?b[k]:undefined, s=x||y;
    if(!(x?x.conf:true)||!(y?y.conf:true)||(b&&(x?x.qty:0)!==(y?y.qty:0))) out.push({key:k,row:+k.split('|')[0],col:s.d.extra?0:s.col,label:s.d.label});
  }
  return out.slice(0,40);
}
const tbMap=(r,list)=>{ const m={}; for(const c of (r&&r.cells)||[]){ const it=list[c.n-1]; if(it) m[it.key]={qty:Math.max(0,+c.qty||0),conf:c.confident!==false}; } return m; };

function reconcile(day,ps){   // fills day.cells from the photos ps of ONE date
  const done=ps.filter(p=>p.status==='done');
  const sig=p=>(p.res[0].entries||[]).filter(e=>e.qty>0).map(e=>`${e.row}|${e.col}|${e.qty}`).sort().join(',');
  done.forEach((p,i)=>done.slice(i+1).forEach(q=>{ if(q.half===p.half&&(p.res[0].entries||[]).length>=5&&sig(p)===sig(q))
    day.notes.push(`Photos ${p.no} and ${q.no} look identical (same half photographed twice?). BOTH are counted — delete one and re-run if so.`); }));
  for(const p of done){
    const half=p.half, maps=cellMaps(p);
    if(p.res[1] && p.res[1].half!==half) day.notes.push(`Photo ${p.no}: the readings disagreed on which half (A/B) — check this photo.`);
    if(p.autoHalf && p.autoHalf!==half) day.notes.push(`Photo ${p.no}: the phone thought half ${p.autoHalf}, the AI read the headers as half ${half} — counted as half ${half}.`);
    p.res.forEach((r,ri)=>{
      for(const n of (r.notes||[])) day.notes.push(`Photo ${p.no} half ${half} (reading ${ri+1}): ${scrub(n)}`);
      for(const x of (r.extra_columns||[])) day.notes.push(`Photo ${p.no}: handwritten drug "${scrub(x.as_written,60)}" → read as "${scrub(x.interpreted,60)}"`);
    });
    for(const k of new Set(maps.flatMap(m=>Object.keys(m)))){
      const a=maps[0][k], b=maps[1]?maps[1][k]:undefined, src=a||b;
      const c={page:p.no,pid:p.id,half,row:+k.split('|')[0],dk:src.d.k,label:src.d.label,extra:!!src.d.extra,
        v1:a?a.qty:0, v2:maps[1]?(b?b.qty:0):null, raw:rawNum(src.raw), conf:(a?a.conf:true)&&(b?b.conf:true)};
      c.final = a? a.qty : b.qty;   // reading 1 wins unless the 3rd reading settles it
      c.flag = !c.conf || (c.v2!==null && c.v1!==c.v2);
      const t=p.tb&&p.tb[k];
      if(t){ c.v3=t.qty;
        if(c.flag&&t.conf){ if(t.qty===c.v1){ c.final=c.v1; c.flag=false; c.settled=true; }
          else if(c.v2!==null&&c.v1!==c.v2&&t.qty===c.v2){ c.final=c.v2; c.flag=false; c.settled=true; } } }
      if(c.extra) day.extras[c.dk]=day.extras[c.dk]||c.label;
      day.cells[`${p.id}|${half}|${c.row}|${c.dk}`]=c;   // photo id: stable, so ✔ edits find their cell again
    }
  }
}
