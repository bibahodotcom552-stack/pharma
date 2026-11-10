// Totals table, review flags, manual add, CSV/copy/print, saved-days history.
/* ================= RESULTS ================= */
function allDrugs(ex=day.extras){
  const L=[...HALF_A.map((l,i)=>({k:'A'+(i+1),label:l})),...HALF_B.map((l,i)=>({k:'B'+(i+1),label:l}))];
  for(const [k,l] of Object.entries(ex||{})) L.push({k,label:l+' ✍️',extra:true});
  return L;
}
function totals(d=day){
  const t={}; for(const c of Object.values(d.cells)){ if(!(c.final>0)) continue;
    const o=t[c.dk]=t[c.dk]||{pages:{},total:0,flag:false}; o.pages[c.page]=(o.pages[c.page]||0)+c.final; o.total+=c.final; if(c.flag&&!c.ok) o.flag=true; }
  return t;
}
function render(){ $('#resultCard').style.display='block'; $('#resTitle').textContent='3 · Results — '+day.date; renderTable(); renderFlags(); renderNotes(); fillManual(); }
function renderTable(){
  const t=totals(), P=day.pages, all=$('#showAll').checked;
  const cells=Object.values(day.cells); const fl=cells.filter(c=>c.flag&&!c.ok).length;
  $('#stats').innerHTML=`${cells.filter(c=>c.final>0).length} dispensing entries · ${Object.keys(t).length} drugs used · ${day.photos||P} photo(s) · <span style="color:var(--warn)">${fl} to review</span>${cells.some(c=>c.settled)?` · ${cells.filter(c=>c.settled).length} settled by 3rd reading`:''}`;
  let h=`<thead><tr><th>Drug</th><th class="n">Total</th></tr></thead><tbody>`;   // one line per register item, whole date
  for(const d of allDrugs()){
    const o=t[d.k]; if(!o&&!all) continue;
    h+=`<tr class="${o&&o.flag?'flag':''} ${d.extra?'extra':''}"><td>${esc(d.label)}${o&&o.flag?' ⚠️':''}<div class="noprint"><a href="#" style="color:var(--mut);font-size:11px" onclick="editDrug('${d.k}',this);return false">edit</a></div></td>`+
      `<td class="n"><b>${o?o.total:0}</b></td></tr>`;
  }
  $('#tbl').innerHTML=h+'</tbody>';
}
function editDrug(k,a){
  const box=a.parentNode; const ex=box.querySelector('.drugedit'); if(ex){ex.remove();return}
  const cs=Object.entries(day.cells).filter(([,c])=>c.dk===k).sort((x,y)=>x[1].page-y[1].page||x[1].row-y[1].row);
  const d=document.createElement('div'); d.className='drugedit';
  d.innerHTML=(cs.map(([key,c])=>`<div>Photo ${c.page} row ${c.row}: <input type="number" value="${c.final}" onchange="setCell('${key}',this.value)"> ${c.v2!==null&&c.v1!==c.v2?`<span class="badge b-w">${c.v1} vs ${c.v2}</span>`:''}</div>`).join('')||'<div>No entries</div>')
    +(k.startsWith('X:')?`<div>Rename: <input type="text" style="width:160px" value="${esc(day.extras[k])}" onchange="renameExtra('${k}',this.value)"></div>`:'');
  box.appendChild(d);
}
function setCell(key,v){ const c=day.cells[key]; c.final=+v||0; c.ok=true; saveDay(); renderTable(); renderFlags(); }
function renameExtra(k,v){ const nk='X:'+norm(v); for(const c of Object.values(day.cells)) if(c.dk===k){c.dk=nk;c.label=v} delete day.extras[k]; day.extras[nk]=v; saveDay(); render(); }
function renderFlags(){
  const fs=Object.entries(day.cells).filter(([,c])=>c.flag&&!c.ok).sort((a,b)=>a[1].page-b[1].page||a[1].row-b[1].row);
  $('#flagCount').textContent=fs.length?`(${fs.length})`:'';
  $('#t-flags').innerHTML = fs.length? '<p class="mut">Check each against the paper register, correct the number, tap ✔.</p>'+fs.map(([key,c])=>
    `<div class="flagbox"><b>Photo ${c.page} · half ${c.half} · row ${c.row}</b><br>${esc(c.label)}<br>
     ${c.v2!==null?`Reading 1: <b>${c.v1||'—'}</b>, reading 2: <b>${c.v2||'—'}</b>`:''}${c.v3!==undefined?`, 3rd reading: <b>${c.v3||'—'}</b>`:''} ${!c.conf?`· AI unsure (saw "${esc(c.raw)}")`:''}<br>
     Final: <input type="number" value="${c.final}" id="f_${btoa(key).replace(/=/g,'')}"> <button onclick="setCell('${key}',document.getElementById('f_${btoa(key).replace(/=/g,'')}').value)">✔ Confirm</button></div>`).join('')
    : '<p>✅ Nothing to review.</p>';
}
function renderNotes(){ $('#t-notes').innerHTML = day.notes.length? '<ul>'+day.notes.map(n=>`<li>${esc(n)}</li>`).join('')+'</ul>':'No notes.'; }
function tab(t){ document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t)); ['sum','flags','notes'].forEach(x=>$('#t-'+x).style.display=x===t?'block':'none'); }
function fillManual(){ $('#mDrug').innerHTML=allDrugs().map(d=>`<option value="${esc(d.k)}">${esc(d.label)}</option>`).join(''); }
function manualAdd(){
  const pg=+$('#mPage').value||0, q=+$('#mQty').value; if(!q){alert('Enter quantity');return}
  let k=$('#mDrug').value, label=allDrugs().find(d=>d.k===k)?.label, nn=$('#mNew').value.trim();
  if(nn){k='X:'+norm(nn);label=nn;day.extras[k]=nn}
  const key=`${pg}|M|${Date.now()}|${k}`; day.cells[key]={page:pg,half:'M',row:0,dk:k,label,extra:k.startsWith('X:'),v1:q,v2:null,final:q,conf:true,flag:false,raw:'manual'};
  day.pages=Math.max(day.pages,pg); $('#mQty').value='';$('#mNew').value=''; saveDay(); render();
}

/* ================= EXPORT / HISTORY ================= */
function exportCSV(){
  const t=totals(); const q=s=>`"${String(s).replace(/"/g,'""')}"`;
  let csv='Date,Drug,Total,Needs review\n';
  for(const d of allDrugs()){ const o=t[d.k]; if(!o) continue;
    csv+=[day.date,q(d.label.replace(' ✍️',' (handwritten)')),o.total,o.flag?'YES':''].join(',')+'\n'; }
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv'})); a.download=`consumption_${day.date}.csv`; a.click();
}
function copyText(){
  const t=totals(); let s=`Daily consumption — ${day.date}\n`;
  for(const d of allDrugs()){ const o=t[d.k]; if(o) s+=`${d.label.replace(' ✍️','*')}: ${o.total}${o.flag?' (check)':''}\n`; }
  navigator.clipboard.writeText(s).then(()=>alert('Copied — paste into WhatsApp / notes'));
}
function saveDay(){ const d=store.get(); d.days=d.days||{}; d.days[day.date]={...day,saved:Date.now()}; store.set(d); fillHistory(); }
function fillHistory(){ const d=store.get(); const ks=Object.keys(d.days||{}).sort().reverse();
  $('#history').innerHTML='<option value="">— open saved —</option>'+ks.map(k=>`<option>${esc(k)}</option>`).join(''); }
function openDay(k){ if(!k)return; const d=store.get(); day=d.days[k]; $('#date').value=k; render(); }

/* ================= PERIOD REPORT (many dates) ================= */
// Adds up the SAVED dates between From and To: one line per register item, period total + each date's total.
function periodData(){
  const from=$('#pFrom').value, to=$('#pTo').value;
  if(!from||!to||from>to){ alert('Pick From and To dates (From must be before To)'); return null; }
  const all=store.get().days||{}; const dates=Object.keys(all).filter(k=>k>=from&&k<=to).sort();
  if(!dates.length){ alert(`No saved dates between ${fmtD(from)} and ${fmtD(to)}`); return null; }
  const per={}, ex={}, flagged=[], incomplete=[];
  for(const k of dates){ const d=all[k]; per[k]=totals(d);
    for(const [x,l] of Object.entries(d.extras||{})) ex[x]=ex[x]||l;
    if(Object.values(d.cells).some(c=>c.flag&&!c.ok)) flagged.push(k);
    if(d.missing) incomplete.push(k); }
  const rows=allDrugs(ex).map(dr=>{ const by=dates.map(k=>per[k][dr.k]?per[k][dr.k].total:0);
    return {...dr, by, total:by.reduce((a,b)=>a+b,0), flag:dates.some(k=>per[k][dr.k]&&per[k][dr.k].flag)}; }).filter(r=>r.total>0);
  const gaps=[]; for(let t=Date.parse(from+'T00:00Z'); t<=Date.parse(to+'T00:00Z'); t+=864e5){ const k=new Date(t).toISOString().slice(0,10); if(!all[k]) gaps.push(k); }
  return {from,to,dates,rows,flagged,incomplete,gaps};
}
function renderPeriod(){
  const P=periodData(); if(!P) return;
  const sh=k=>fmtD(k).slice(0,5);   // 08-11
  $('#pStats').innerHTML=`<b>${fmtD(P.from)} → ${fmtD(P.to)}</b> · ${P.dates.length} date(s) saved · ${P.rows.length} drugs used`+
    (P.flagged.length?`<br><span style="color:var(--warn)">⚠ Cells still to review on: ${P.flagged.map(sh).join(', ')} — open each in "Saved days" → Review flags.</span>`:'')+
    (P.incomplete.length?`<br><span style="color:var(--bad)">✖ Incomplete (photos not read): ${P.incomplete.map(sh).join(', ')}</span>`:'')+
    (P.gaps.length?`<br>No saved data for: ${P.gaps.map(sh).join(', ')}`:'');
  let h=`<thead><tr><th>Drug</th><th class="n">Period total</th>${P.dates.map(k=>`<th class="n">${sh(k)}</th>`).join('')}</tr></thead><tbody>`;
  for(const r of P.rows) h+=`<tr class="${r.flag?'flag':''} ${r.extra?'extra':''}"><td>${esc(r.label)}${r.flag?' ⚠️':''}</td><td class="n"><b>${r.total}</b></td>${r.by.map(v=>`<td class="n">${v||''}</td>`).join('')}</tr>`;
  $('#pTbl').innerHTML=h+'</tbody>';
}
function exportPeriodCSV(){
  const P=periodData(); if(!P) return; const q=s=>`"${String(s).replace(/"/g,'""')}"`;
  let csv=`Drug,Period total (${fmtD(P.from)} to ${fmtD(P.to)}),${P.dates.map(fmtD).join(',')},Needs review\n`;
  for(const r of P.rows) csv+=[q(r.label.replace(' ✍️',' (handwritten)')),r.total,...r.by,r.flag?'YES':''].join(',')+'\n';
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv'})); a.download=`consumption_${P.from}_to_${P.to}.csv`; a.click();
}
function copyPeriod(){
  const P=periodData(); if(!P) return;
  let s=`Consumption ${fmtD(P.from)} to ${fmtD(P.to)} (${P.dates.length} dates)\n`;
  for(const r of P.rows) s+=`${r.label.replace(' ✍️','*')}: ${r.total}${r.flag?' (check)':''}\n`;
  navigator.clipboard.writeText(s+'(Each date\'s totals: use ⬇ CSV)').then(()=>alert('Copied period totals'));
}
