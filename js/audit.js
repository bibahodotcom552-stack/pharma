// runAudit() loop + reconcile(): merges pass 1 & 2 per cell, flags disagreements.
/* ================= AUDIT ================= */
function log(s){ const l=$('#log'); l.textContent+=s+'\n'; l.scrollTop=l.scrollHeight; }
const norm=s=>(s||'').toLowerCase().replace(/tab(let)?s?|cap(sule)?s?|syp|syrup|inj|\bpid\b|[^a-z0-9.]/g,'').replace(/\.(?!\d)/g,'');
function drugOf(half,col,extra){
  if(col>0){ const arr=half==='A'?HALF_A:HALF_B; if(col<=arr.length) return {k:half+col,label:arr[col-1]}; }
  const label=scrub(extra,60)||'Unknown handwritten drug'; return {k:'X:'+norm(label),label,extra:true};
}

async function runAudit(){
  if(!photos.length){alert('Add photos first');return}
  const todo=photos.filter(p=>p.status!=='done');
  if(!todo.length){alert('All photos are already read and saved.\nTap "Clear all photos" to start a new batch.');return}
  const unsafe=todo.filter(p=>!p.masked&&!p.noNames);
  if(unsafe.length && !confirm(`${unsafe.length} photo(s) have no privacy mask and are not marked "No names".\nPatient names could be sent to Google.\n\nSend anyway?`)) return;
  const auto=todo.filter(p=>p.auto&&(p.masked||p.noNames));
  if(auto.length){
    if(!confirm(`${auto.length} photo(s) were masked or marked "No names" AUTOMATICALLY (badge "auto · check").\nDid you look at every one?\n• copied mask: black box covers ALL names / P-No\n• "No names": it really is a RIGHT half\n\nOK = yes, all checked. Cancel = go back and check.`)) return;
    auto.forEach(p=>p.auto=false); renderPhotos();
  }
  const passes=+$('#passes').value||2;
  const dates=[...new Set(photos.map(p=>p.date))].sort();
  if(dates.length>1 && !confirm(`${dates.length} dates, ${todo.length} photo(s) to read = about ${todo.length*passes} AI requests.\nEach date is saved as soon as it is finished. If the free daily limit runs out, the app tries another free model; if all are used up it stops and you press Start again later.\n\nStart?`)) return;
  $('#runBtn').disabled=true; $('#log').textContent='';
  const total=todo.length*passes; let done=0, stop=false, saved=0; const tried=new Set([$('#model').value]);
  const bar=()=>$('#bar').style.width=(100*done/total)+'%'; bar();
  for(const date of dates){
    const ps=photos.filter(p=>p.date===date);
    if(ps.every(p=>p.status==='done')) continue;          // finished in an earlier run, already saved
    log(`📅 ${fmtD(date)} — ${ps.length} photo(s)`);
    for(const p of ps){
      if(p.status==='done') continue;
      p.status='run'; p.res=[]; renderPhotos();
      try{
        log(`📄 Page ${p.page}: preparing image…`);
        const b64=await prepImage(p);
        for(let k=0;k<passes;k++){
          log(`  🔎 pass ${k+1}/${passes} (${k?'column-wise':'row-wise'})…`);
          try{ p.res.push(await gemini(b64,k)); }
          catch(e){ if(e.quota&&switchModel(tried)){ k--; continue; } throw e; }
          done++; bar();
        }
        for(const r of p.res) r.half = r.half==='B'?'B':'A';   // only A/B ever reaches the screen
        p.half=p.res[0].half; p.status='done';
        log(`  ✔ half ${p.half}: ${p.res.map(r=>(r.entries||[]).length).join(' / ')} entries`);
      }catch(e){
        p.status='err'; log('  ✖ '+e.message); done+=passes-p.res.length; bar();
        if(e.quota||/quota|API key|model/i.test(e.message)){ stop=true; renderPhotos(); break; }
      }
      renderPhotos();
    }
    if(stop && !ps.every(p=>p.status==='done')){ log(`  ⏸ ${fmtD(date)} not finished — not saved yet.`); break; }
    day=keepEdits(buildDay(date,ps)); saveDay(); saved++; log(`  💾 ${fmtD(date)} saved.`);
  }
  $('#runBtn').disabled=false;
  const left=[...new Set(photos.filter(p=>p.status!=='done').map(p=>p.date))].sort();
  if(stop) log(`\n⏸ Stopped: free daily limit used up on all free models.\nLeft to do: ${left.map(fmtD).join(', ')}\nKeep this page open and press Start again after ~2 PM Bangladesh time — only the unfinished photos are read. (If you close the page, add the photos of those dates again.)`);
  else log(left.length? `\n⚠ Finished, but some photos had errors (${left.map(fmtD).join(', ')}). Press Start again to retry them.` : '\n✅ Finished.');
  if(day) render();
  if(dates.length>1&&saved){ $('#pFrom').value=dates[0]; $('#pTo').value=dates[dates.length-1]; renderPeriod(); $('#periodCard').scrollIntoView({behavior:'smooth'}); }
}
// On a daily-quota error: move to the next free Flash model not tried yet (each model has its own daily limit).
function switchModel(tried){
  const d=store.get(); const next=(d.models||[]).find(m=>/flash/i.test(m)&&!/pro/i.test(m)&&!tried.has(m));
  if(!next) return false;
  tried.add(next); $('#model').value=next; log(`  🔁 daily limit reached — switching to ${next}`); return true;
}
function buildDay(date,ps){
  const d={date,cells:{},notes:[],extras:{},pages:Math.max(...ps.map(p=>p.page)),photos:ps.length};
  const miss=ps.filter(p=>p.status!=='done').length;
  if(miss){ d.missing=miss; d.notes.push(`${miss} photo(s) could not be read — totals for this date are INCOMPLETE. Add them again and re-run, or add entries manually.`); }
  reconcile(d,ps); return d;
}
// Re-reading a date that was saved before: keep your ✔ confirmed numbers, manual entries and renamed handwritten drugs.
function keepEdits(d){
  const old=(store.get().days||{})[d.date]; if(!old) return d;
  for(const [k,c] of Object.entries(old.cells||{})){
    if(c.half==='M'){ d.cells[k]=c; d.pages=Math.max(d.pages,c.page); continue; }
    const n=d.cells[k]; if(!n) continue;
    if(c.ok){ n.final=c.final; n.ok=true; }
    if(c.extra&&c.dk!==n.dk){ n.dk=c.dk; n.label=c.label; }
  }
  d.extras={}; for(const c of Object.values(d.cells)) if(c.extra) d.extras[c.dk]=d.extras[c.dk]||c.label;
  return d;
}

function reconcile(day,ps){   // fills day.cells from the photos ps of ONE date
  for(const p of ps){
    if(p.status!=='done') continue;
    const half=p.half; const maps=p.res.map(()=>({}));
    if(p.res[1] && p.res[1].half!==half) day.notes.push(`Page ${p.page}: passes disagreed on which half (A/B) — check this photo.`);
    p.res.forEach((r,ri)=>{
      for(const e of (r.entries||[])){
        if(!(e.row>=1&&e.row<=ROWS)||!(e.qty>0)) continue;
        const d=drugOf(half,e.col,e.extra_name);
        const key=`${p.page}|${half}|${e.row}|${d.k}`;
        const raw=rawNum(e.raw)||String(e.qty);
        const m=maps[ri]; if(m[key]){ m[key].qty+=e.qty; m[key].conf=false; m[key].raw+='+'+raw; }
        else m[key]={qty:e.qty,conf:e.confident!==false,raw,d};
      }
      for(const n of (r.notes||[])) day.notes.push(`Page ${p.page} half ${half} (pass ${ri+1}): ${scrub(n)}`);
      for(const x of (r.extra_columns||[])) day.notes.push(`Page ${p.page}: handwritten drug "${scrub(x.as_written,60)}" → read as "${scrub(x.interpreted,60)}"`);
    });
    const keys=new Set(maps.flatMap(m=>Object.keys(m)));
    for(const key of keys){
      const a=maps[0][key], b=maps[1]?maps[1][key]:undefined, src=a||b;
      const [pg,hf,row]=key.split('|');
      const c={page:+pg,half:hf,row:+row,dk:src.d.k,label:src.d.label,extra:!!src.d.extra,
        v1:a?a.qty:0, v2:maps[1]?(b?b.qty:0):null, raw:src.raw, conf:(a?a.conf:true)&&(b?b.conf:true)};
      c.final = a? a.qty : b.qty;   // pass 1 wins; disagreement is flagged for you
      c.flag = !c.conf || (c.v2!==null && c.v1!==c.v2);
      if(c.extra) day.extras[c.dk]=day.extras[c.dk]||c.label;
      day.cells[key]=c;
    }
  }
}
