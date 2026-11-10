// Photo list UI, automatic + manual privacy mask, prepImage() = the ONLY image data that leaves the phone.
/* ================= PHOTOS ================= */
let prepQueue = Promise.resolve();
$('#files').onchange = async e => {
  await keepReady;
  const auto=$('#autoDate').checked, date=auto?'':$('#date').value;
  if(!auto&&!date){alert('Pick the register date first (or tick "read the date from each sheet")');e.target.value='';return}
  for(const f of e.target.files){
    const p={id:Math.random().toString(36).slice(2),no:nextNo(),file:f,url:URL.createObjectURL(f),date,dateFix:'',masked:false,noNames:false,auto:false,
      rot:0,rects:[],polys:[],status:'new',res:[],prep:'wait'};
    p.page=p.no; photos.push(p);
    prepQueue=prepQueue.then(async()=>{ await autoPrep(p); p.prep=''; await makeThumb(p); });
  }
  e.target.value=''; renderPhotos();
  prepQueue.then(()=>{ const bad=photos.filter(p=>!p.prep&&p.status!=='done'&&!p.masked&&!p.noNames).length;
    $('#prepMsg').textContent = bad? `❗ ${bad} photo(s) need you: the phone could not find the table clearly. Tap Mask (cover the names) or "No names" on each.` : ''; });
};
const nextNo = () => photos.reduce((m,p)=>Math.max(m,p.no||0),0)+1;
const dateOf = p => p.date || p.dateFix || p.eff || '';
function renderPhotos(){
  const groups=[...new Set(photos.map(p=>p.date||'auto'))].sort();
  const n=photos.length, prep=photos.filter(p=>p.prep).length;
  $('#photoSum').textContent = n? `${n} photo(s)`+(prep?` · preparing ${n-prep}/${n} on the phone…`:'') : '';
  $('#photos').innerHTML = groups.map(g=>{
    const ps=photos.map((p,i)=>[p,i]).filter(([p])=>(p.date||'auto')===g);
    return `<div class="grp"><b>📅 ${g==='auto'?'Date read from each sheet':fmtD(g)}</b> · ${ps.length} photo(s)
      <button onclick="delDate('${g}')">✕ Remove</button></div>`+
    ps.map(([p,i])=>{
    const safe=p.masked||p.noNames;
    const st={new:'',run:'<span class="badge b-i st">reading…</span>',done:`<span class="badge b-ok st">✔ ${p.half?('half '+p.half):''}</span>`,err:'<span class="badge b-bad st">error</span>'}[p.status];
    const kind = p.prep? '<span class="badge b-i">preparing…</span>'
      : p.masked? `<span class="badge b-ok">${p.autoHalf==='A'&&p.auto?'left half · names hidden':'masked'}</span>`
      : p.noNames? `<span class="badge b-ok">${p.autoHalf==='B'&&p.auto?'right half · no names':'no names'}</span>`
      : '<span class="badge b-bad">❗ mask by hand</span>';
    const dt = !p.date&&p.status==='done' ? `<div>📅 <input type="date" class="pd" value="${dateOf(p)}" onchange="fixDate(${i},this.value)" title="Date of this sheet — change if wrong">${p.sheetDate||p.dateFix?'':' <span class="badge b-w">guessed</span>'}</div>` : '';
    return `<div class="ph ${safe||p.prep?'':'warn'}">${st}<img loading="lazy" src="${p.thumb||p.url}" style="transform:rotate(${p.thumb?0:p.rot}deg)">
    <div class="b">Photo ${p.no} ${kind}${p.auto&&safe?' <span class="badge b-w">auto · check</span>':''}${dt}
    <div class="bt">${p.status==='done'?'':`<button onclick="rot90(${i})" title="Rotate">↻</button><button onclick="openEd(${i})">Mask</button><button onclick="photos[${i}].noNames=!photos[${i}].noNames;photos[${i}].auto=false;renderPhotos()">${p.noNames?'Undo':'No names'}</button>`}<button onclick="delPhoto(${i})">✕</button></div></div></div>`;
    }).join('');
  }).join('');
}
function delDate(g){ const ps=photos.filter(p=>(p.date||'auto')===g); if(!confirm(`Remove these ${ps.length} photo(s)? (Saved results are kept.)`))return;
  ps.forEach(p=>{URL.revokeObjectURL(p.url); keepDel(p.id);}); photos=photos.filter(p=>!ps.includes(p)); renderPhotos(); }
function clearPhotos(){ if(photos.length&&!confirm('Remove ALL photos from the list? (Saved results are kept.)'))return; photos.forEach(p=>URL.revokeObjectURL(p.url)); photos=[]; keepClear(); renderPhotos(); }
// quick 90° turn from the thumbnail (mask boxes turn with the photo)
function rot90(i){ const p=photos[i]; if(p.status==='done')return; p.rects=p.rects.map(r=>({x:1-r.y-r.h,y:r.x,w:r.h,h:r.w})); p.polys=(p.polys||[]).map(pl=>pl.map(q=>rotPt(q,90)));
  p.rot=(p.rot+90)%360; p.thumb=null; renderPhotos(); makeThumb(p); }
function delPhoto(i){ URL.revokeObjectURL(photos[i].url); keepDel(photos[i].id); photos.splice(i,1); renderPhotos(); }
// you corrected the date of a photo whose date was read (or guessed) from the sheet
function fixDate(i,v){ photos[i].dateFix=v; for(const p of photos) if(!p.date&&!p.dateFix&&!p.sheetDate) p.savedEff='';   // re-place the undated photos around your correction
  keepPut(photos[i]); saveReadyDates(); renderPhotos(); }

/* ---- mask editor ---- */
async function openEd(i){
  const p=photos[i]; if(!p.file){alert('This photo is no longer on the phone.');return}
  const bmp=await createImageBitmap(p.file);
  ed={i,bmp,rot:p.rot,rects:JSON.parse(JSON.stringify(p.rects)),polys:JSON.parse(JSON.stringify(p.polys||[])),drag:null};
  $('#ed').style.display='flex'; edDraw();
}
function edDims(){ const r=ed.rot%180!==0; return r?[ed.bmp.height,ed.bmp.width]:[ed.bmp.width,ed.bmp.height]; }
function drawRotated(ctx,bmp,rot,W,H){
  ctx.save(); ctx.translate(W/2,H/2); ctx.rotate(rot*Math.PI/180);
  ctx.drawImage(bmp,-bmp.width/2,-bmp.height/2); ctx.restore();
}
function fillMasks(x,rects,polys,W,H){
  x.fillStyle='#000';
  for(const r of rects) x.fillRect(r.x*W,r.y*H,r.w*W,r.h*H);
  for(const pl of polys||[]){ x.beginPath(); pl.forEach(([a,b],k)=>k?x.lineTo(a*W,b*H):x.moveTo(a*W,b*H)); x.closePath(); x.fill(); }
}
function edDraw(){
  const c=$('#edc'); const [W,H]=edDims(); const s=Math.min(1,1600/Math.max(W,H));
  c.width=W*s; c.height=H*s; const x=c.getContext('2d');
  x.save(); x.scale(s,s); drawRotated(x,ed.bmp,ed.rot,W,H); x.restore();
  fillMasks(x,ed.rects,ed.polys,c.width,c.height);
  if(ed.drag){x.strokeStyle='#38bdf8';x.lineWidth=3;const d=ed.drag;x.strokeRect(d.x*c.width,d.y*c.height,d.w*c.width,d.h*c.height)}
}
function edPos(ev){ const c=$('#edc'),b=c.getBoundingClientRect(); const t=ev.touches?ev.touches[0]:ev;
  return {x:Math.min(1,Math.max(0,(t.clientX-b.left)/b.width)),y:Math.min(1,Math.max(0,(t.clientY-b.top)/b.height))}; }
const cv=$('#edc');
const down=ev=>{ev.preventDefault();const p=edPos(ev);ed.start=p;ed.drag={x:p.x,y:p.y,w:0,h:0};};
const move=ev=>{if(!ed||!ed.start)return;ev.preventDefault();const p=edPos(ev),s=ed.start;
  ed.drag={x:Math.min(s.x,p.x),y:Math.min(s.y,p.y),w:Math.abs(p.x-s.x),h:Math.abs(p.y-s.y)};edDraw();};
const up=()=>{if(!ed||!ed.start)return;if(ed.drag&&ed.drag.w>0.01&&ed.drag.h>0.01)ed.rects.push(ed.drag);ed.start=null;ed.drag=null;edDraw();};
cv.addEventListener('mousedown',down);cv.addEventListener('mousemove',move);window.addEventListener('mouseup',up);
cv.addEventListener('touchstart',down,{passive:false});cv.addEventListener('touchmove',move,{passive:false});cv.addEventListener('touchend',up);
function edRotate(){ // rotate boxes with image (90° cw)
  ed.rects=ed.rects.map(r=>({x:1-r.y-r.h,y:r.x,w:r.h,h:r.w})); ed.polys=ed.polys.map(pl=>pl.map(q=>rotPt(q,90))); ed.rot=(ed.rot+90)%360; edDraw(); }
function edUndo(){ if(ed.rects.length) ed.rects.pop(); else ed.polys.pop(); edDraw(); }
function edClear(){ed.rects=[];ed.polys=[];edDraw()}
function edDone(all){
  const p=photos[ed.i]; p.rot=ed.rot; p.rects=ed.rects; p.polys=ed.polys; p.masked=ed.rects.length+ed.polys.length>0; p.auto=false;   // you checked this one yourself
  if(p.masked) p.noNames=false;
  const targets=[p];
  // copy only to photos the phone could NOT prepare by itself (❗) — each copy is marked "auto · check"
  if(all&&p.masked) for(const q of photos) if(q!==p&&q.status!=='done'&&!q.masked&&!q.noNames&&!q.prep){ q.rot=p.rot; q.rects=JSON.parse(JSON.stringify(p.rects)); q.polys=JSON.parse(JSON.stringify(p.polys)); q.masked=true; q.auto=true; targets.push(q); }
  ed.bmp.close&&ed.bmp.close(); ed=null; $('#ed').style.display='none'; renderPhotos();
  for(const q of targets) makeThumb(q);
  if(targets.length>1) alert(`Same mask copied to ${targets.length-1} other ❗ photo(s).\nCheck every thumbnail marked "auto · check": the black box must cover ALL names / P-No. If not, tap Mask on that photo and fix it.`);
  else if(all) alert('No other photos got the mask (it is copied only to ❗ photos that have no mask yet).');
}
// small masked preview so you can SEE that the names are covered
async function makeThumb(p){ try{ if(p.file){ p.thumb='data:image/jpeg;base64,'+await prepImage(p,360,0.6); } renderPhotos(); }catch(e){ renderPhotos(); } }

/* masked, rotated, resized JPEG — this is the ONLY image data that leaves the phone */
async function prepCanvas(p,max){
  const {file,rot,rects,polys}=p;          // copy first: bake() may swap the photo while we wait
  const bmp=await createImageBitmap(file);
  const r=rot%180!==0; const W=r?bmp.height:bmp.width, H=r?bmp.width:bmp.height;
  const s=Math.min(1,max/Math.max(W,H));
  const c=document.createElement('canvas'); c.width=Math.round(W*s); c.height=Math.round(H*s);
  const x=c.getContext('2d'); x.save(); x.scale(s,s); drawRotated(x,bmp,rot,W,H); x.restore();
  fillMasks(x,rects,polys,c.width,c.height);
  bmp.close&&bmp.close(); return c;
}
const isBaked = p => p.baked && !p.rot && !p.rects.length && !(p.polys||[]).length;
async function prepImage(p,max=2600,q=0.9){
  if(isBaked(p)&&max>=2600) return blobB64(p.file);            // already masked + upright copy kept on the phone
  return (await prepCanvas(p,max)).toDataURL('image/jpeg',q).split(',')[1];
}
const blobB64 = b => new Promise((ok,no)=>{ const r=new FileReader(); r.onload=()=>ok(String(r.result).split(',')[1]); r.onerror=no; r.readAsDataURL(b); });
// Before sending: replace the original photo by its masked, upright copy (kept on the phone so a stop can resume later).
async function bake(p){
  if(isBaked(p)) return;
  const c=await prepCanvas(p,2600); const b=await new Promise(ok=>c.toBlob(ok,'image/jpeg',0.9));
  URL.revokeObjectURL(p.url); p.file=b; p.url=URL.createObjectURL(b); p.rot=0; p.rects=[]; p.polys=[]; p.baked=true;
  await keepPut(p);
}
