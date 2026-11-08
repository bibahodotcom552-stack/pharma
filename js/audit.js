// runAudit() loop + reconcile(): merges pass 1 & 2 per cell, flags disagreements.
/* ================= AUDIT ================= */
function log(s){ const l=$('#log'); l.textContent+=s+'\n'; l.scrollTop=l.scrollHeight; }
const norm=s=>(s||'').toLowerCase().replace(/tab(let)?s?|cap(sule)?s?|syp|syrup|inj|\bpid\b|[^a-z0-9.]/g,'').replace(/\.(?!\d)/g,'');
function drugOf(half,col,extra){
  if(col>0){ const arr=half==='A'?HALF_A:HALF_B; if(col<=arr.length) return {k:half+col,label:arr[col-1]}; }
  const label=(extra||'Unknown handwritten drug').trim(); return {k:'X:'+norm(label),label,extra:true};
}

async function runAudit(){
  if(!photos.length){alert('Add photos first');return}
  const date=$('#date').value; if(!date){alert('Pick the register date');return}
  const unsafe=photos.filter(p=>!p.masked&&!p.noNames);
  if(unsafe.length && !confirm(`${unsafe.length} photo(s) have no privacy mask and are not marked "No names".\nPatient names could be sent to Google.\n\nSend anyway?`)) return;
  const passes=+$('#passes').value||2;
  $('#runBtn').disabled=true; $('#log').textContent='';
  day={date,cells:{},notes:[],extras:{},pages:Math.max(...photos.map(p=>p.page))};
  const total=photos.length*passes; let done=0;
  for(const p of photos){
    p.status='run'; p.res=[]; renderPhotos();
    try{
      log(`📄 Page ${p.page}: preparing image…`);
      const b64=await prepImage(p);
      for(let k=0;k<passes;k++){
        log(`  🔎 pass ${k+1}/${passes} (${k?'column-wise':'row-wise'})…`);
        p.res.push(await gemini(b64,k));
        done++; $('#bar').style.width=(100*done/total)+'%';
      }
      p.half=p.res[0].half; p.status='done';
      log(`  ✔ half ${p.half}: ${p.res.map(r=>(r.entries||[]).length).join(' / ')} entries`);
    }catch(e){ p.status='err'; log('  ✖ '+e.message); done+=passes-p.res.length; $('#bar').style.width=(100*done/total)+'%'; if(/quota|API key|model/i.test(e.message)) break; }
    renderPhotos();
  }
  reconcile(); saveDay(); render(); $('#runBtn').disabled=false; log('✅ Finished.');
}

function reconcile(){
  for(const p of photos){
    if(p.status!=='done') continue;
    const half=p.half; const maps=p.res.map(()=>({}));
    if(p.res[1] && p.res[1].half!==half) day.notes.push(`Page ${p.page}: passes disagreed on which half (A/B) — check this photo.`);
    p.res.forEach((r,ri)=>{
      for(const e of (r.entries||[])){
        if(!(e.row>=1&&e.row<=ROWS)||!(e.qty>0)) continue;
        const d=drugOf(half,e.col,e.extra_name);
        const key=`${p.page}|${half}|${e.row}|${d.k}`;
        const m=maps[ri]; if(m[key]){ m[key].qty+=e.qty; m[key].conf=false; m[key].raw+='+'+(e.raw||e.qty); }
        else m[key]={qty:e.qty,conf:e.confident!==false,raw:e.raw||String(e.qty),d};
      }
      for(const n of (r.notes||[])) day.notes.push(`Page ${p.page} half ${half} (pass ${ri+1}): ${n}`);
      for(const x of (r.extra_columns||[])) day.notes.push(`Page ${p.page}: handwritten drug "${x.as_written}" → read as "${x.interpreted}"`);
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
