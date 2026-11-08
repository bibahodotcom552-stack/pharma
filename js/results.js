// Totals table, review flags, manual add, CSV/copy/print, saved-days history.
/* ================= RESULTS ================= */
function allDrugs(){
  const L=[...HALF_A.map((l,i)=>({k:'A'+(i+1),label:l})),...HALF_B.map((l,i)=>({k:'B'+(i+1),label:l}))];
  for(const [k,l] of Object.entries(day.extras)) L.push({k,label:l+' ✍️',extra:true});
  return L;
}
function totals(){
  const t={}; for(const c of Object.values(day.cells)){ if(!(c.final>0)) continue;
    const o=t[c.dk]=t[c.dk]||{pages:{},total:0,flag:false}; o.pages[c.page]=(o.pages[c.page]||0)+c.final; o.total+=c.final; if(c.flag&&!c.ok) o.flag=true; }
  return t;
}
function render(){ $('#resultCard').style.display='block'; $('#resTitle').textContent='3 · Results — '+day.date; renderTable(); renderFlags(); renderNotes(); fillManual(); }
function renderTable(){
  const t=totals(), P=day.pages, all=$('#showAll').checked;
  const cells=Object.values(day.cells); const fl=cells.filter(c=>c.flag&&!c.ok).length;
  $('#stats').innerHTML=`${cells.filter(c=>c.final>0).length} dispensing entries · ${Object.keys(t).length} drugs used · ${P} page(s) · <span style="color:var(--warn)">${fl} to review</span>`;
  let h=`<thead><tr><th>Drug</th>${Array.from({length:P},(_,i)=>`<th class="n">P${i+1}</th>`).join('')}<th class="n">Total</th></tr></thead><tbody>`;
  for(const d of allDrugs()){
    const o=t[d.k]; if(!o&&!all) continue;
    h+=`<tr class="${o&&o.flag?'flag':''} ${d.extra?'extra':''}"><td>${esc(d.label)}${o&&o.flag?' ⚠️':''}<div class="noprint"><a href="#" style="color:var(--mut);font-size:11px" onclick="editDrug('${d.k}',this);return false">edit</a></div></td>`+
      Array.from({length:P},(_,i)=>`<td class="n">${o&&o.pages[i+1]?o.pages[i+1]:''}</td>`).join('')+`<td class="n"><b>${o?o.total:0}</b></td></tr>`;
  }
  $('#tbl').innerHTML=h+'</tbody>';
}
function editDrug(k,a){
  const box=a.parentNode; const ex=box.querySelector('.drugedit'); if(ex){ex.remove();return}
  const cs=Object.entries(day.cells).filter(([,c])=>c.dk===k).sort((x,y)=>x[1].page-y[1].page||x[1].row-y[1].row);
  const d=document.createElement('div'); d.className='drugedit';
  d.innerHTML=(cs.map(([key,c])=>`<div>P${c.page} row ${c.row}: <input type="number" value="${c.final}" onchange="setCell('${key}',this.value)"> ${c.v2!==null&&c.v1!==c.v2?`<span class="badge b-w">${c.v1} vs ${c.v2}</span>`:''}</div>`).join('')||'<div>No entries</div>')
    +(k.startsWith('X:')?`<div>Rename: <input type="text" style="width:160px" value="${esc(day.extras[k])}" onchange="renameExtra('${k}',this.value)"></div>`:'');
  box.appendChild(d);
}
function setCell(key,v){ const c=day.cells[key]; c.final=+v||0; c.ok=true; saveDay(); renderTable(); renderFlags(); }
function renameExtra(k,v){ const nk='X:'+norm(v); for(const c of Object.values(day.cells)) if(c.dk===k){c.dk=nk;c.label=v} delete day.extras[k]; day.extras[nk]=v; saveDay(); render(); }
function renderFlags(){
  const fs=Object.entries(day.cells).filter(([,c])=>c.flag&&!c.ok).sort((a,b)=>a[1].page-b[1].page||a[1].row-b[1].row);
  $('#flagCount').textContent=fs.length?`(${fs.length})`:'';
  $('#t-flags').innerHTML = fs.length? '<p class="mut">Check each against the paper register, correct the number, tap ✔.</p>'+fs.map(([key,c])=>
    `<div class="flagbox"><b>Page ${c.page} · half ${c.half} · row ${c.row}</b><br>${esc(c.label)}<br>
     ${c.v2!==null?`Pass 1 read <b>${c.v1||'—'}</b>, pass 2 read <b>${c.v2||'—'}</b>`:''} ${!c.conf?`· AI unsure (saw "${esc(c.raw)}")`:''}<br>
     Final: <input type="number" value="${c.final}" id="f_${btoa(key).replace(/=/g,'')}"> <button onclick="setCell('${key}',document.getElementById('f_${btoa(key).replace(/=/g,'')}').value)">✔ Confirm</button></div>`).join('')
    : '<p>✅ Nothing to review.</p>';
}
function renderNotes(){ $('#t-notes').innerHTML = day.notes.length? '<ul>'+day.notes.map(n=>`<li>${esc(n)}</li>`).join('')+'</ul>':'No notes.'; }
function tab(t){ document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t)); ['sum','flags','notes'].forEach(x=>$('#t-'+x).style.display=x===t?'block':'none'); }
function fillManual(){ $('#mDrug').innerHTML=allDrugs().map(d=>`<option value="${esc(d.k)}">${esc(d.label)}</option>`).join(''); }
function manualAdd(){
  const pg=+$('#mPage').value||1, q=+$('#mQty').value; if(!q){alert('Enter quantity');return}
  let k=$('#mDrug').value, label=allDrugs().find(d=>d.k===k)?.label, nn=$('#mNew').value.trim();
  if(nn){k='X:'+norm(nn);label=nn;day.extras[k]=nn}
  const key=`${pg}|M|${Date.now()}|${k}`; day.cells[key]={page:pg,half:'M',row:0,dk:k,label,extra:k.startsWith('X:'),v1:q,v2:null,final:q,conf:true,flag:false,raw:'manual'};
  day.pages=Math.max(day.pages,pg); $('#mQty').value='';$('#mNew').value=''; saveDay(); render();
}

/* ================= EXPORT / HISTORY ================= */
function exportCSV(){
  const t=totals(),P=day.pages; const q=s=>`"${String(s).replace(/"/g,'""')}"`;
  let csv='Date,Drug,'+Array.from({length:P},(_,i)=>'Page '+(i+1)).join(',')+',Total,Needs review\n';
  for(const d of allDrugs()){ const o=t[d.k]; if(!o) continue;
    csv+=[day.date,q(d.label.replace(' ✍️',' (handwritten)')),...Array.from({length:P},(_,i)=>o.pages[i+1]||0),o.total,o.flag?'YES':''].join(',')+'\n'; }
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
