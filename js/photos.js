// Photo list UI, privacy-mask editor, prepImage() = the ONLY image data that leaves the phone.
/* ================= PHOTOS ================= */
$('#files').onchange = e => {
  const date=$('#date').value; if(!date){alert('Pick the register date first');e.target.value='';return}
  for(const f of e.target.files){
    const page=nextPage(date);
    if(!page){alert(`Max 30 photos (15 pages) for ${fmtD(date)}`);break}
    photos.push({id:Math.random().toString(36).slice(2),file:f,url:URL.createObjectURL(f),date,page,masked:false,noNames:false,auto:false,rot:0,rects:[],status:'new',res:[]});
  }
  e.target.value=''; renderPhotos();
};
// lowest page number of that date that still has fewer than 2 photos (left + right half)
function nextPage(date){ for(let pg=1;pg<=15;pg++) if(photos.filter(p=>p.date===date&&p.page===pg).length<2) return pg; return 0; }
const pagePhotos = p => photos.filter(q=>q.date===p.date&&q.page===p.page);
// GUESS from upload order: on a page with exactly 2 photos, the 1st is the left half (names / P-No column).
// Anything set from this guess is marked auto=true and must be confirmed by the user before sending.
const isLeft  = p => { const g=pagePhotos(p); return g.length===2&&g[0]===p; };
const isRight = p => { const g=pagePhotos(p); return g.length===2&&g[1]===p; };
function renderPhotos(){
  const dates=[...new Set(photos.map(p=>p.date))].sort();
  $('#photoSum').textContent = photos.length? `${dates.length} date(s) · ${photos.length} photo(s) added` : '';
  $('#photos').innerHTML = dates.map(dt=>{
    const ps=photos.map((p,i)=>[p,i]).filter(([p])=>p.date===dt);
    return `<div class="grp"><b>📅 ${fmtD(dt)}</b> · ${ps.length} photo(s)
      <button onclick="rightNoNames('${dt}')">Right halves → No names</button><button onclick="delDate('${dt}')">✕ Remove date</button></div>`+
    ps.map(([p,i])=>{
    const safe=p.masked||p.noNames;
    const st={new:'',run:'<span class="badge b-i st">reading…</span>',done:`<span class="badge b-ok st">✔ ${p.half?('half '+p.half):''}</span>`,err:'<span class="badge b-bad st">error</span>'}[p.status];
    return `<div class="ph ${safe?'':'warn'}">${st}<img loading="lazy" src="${p.thumb||p.url}" style="transform:rotate(${p.thumb?0:p.rot}deg)">
    <div class="b">Page <select onchange="photos[${i}].page=+this.value">${Array.from({length:15},(_,k)=>`<option ${p.page==k+1?'selected':''}>${k+1}</option>`).join('')}</select>
    ${p.masked?'<span class="badge b-ok">masked</span>':p.noNames?'<span class="badge b-ok">no names</span>':'<span class="badge b-w">names?</span>'}${p.auto&&(p.masked||p.noNames)?' <span class="badge b-w">auto · check</span>':''}
    <div class="bt"><button onclick="openEd(${i})">Mask</button><button onclick="photos[${i}].noNames=!photos[${i}].noNames;photos[${i}].auto=false;renderPhotos()">${p.noNames?'Undo':'No names'}</button><button onclick="delPhoto(${i})">✕</button></div></div></div>`;
    }).join('');
  }).join('');
}
function rightNoNames(dt){
  let n=0; for(const p of photos) if(p.date===dt&&isRight(p)&&!p.masked&&!p.noNames&&p.status!=='done'){ p.noNames=true; p.auto=true; n++; }
  renderPhotos();
  alert(n? `${n} photo(s) marked "No names" — the 2nd photo of each page with 2 photos.\nLook at each one marked "auto · check": it must be a RIGHT half (Glibenclamide … Zinc Oxide, no names column). If not, tap Undo on it.`
         : 'Nothing marked. This works only on pages that have exactly 2 photos (left half first, then right half).');
}
function delDate(dt){ if(!confirm(`Remove all photos of ${fmtD(dt)}?`))return; photos.filter(p=>p.date===dt).forEach(p=>URL.revokeObjectURL(p.url)); photos=photos.filter(p=>p.date!==dt); renderPhotos(); }
function clearPhotos(){ if(photos.length&&!confirm('Remove ALL photos from the list? (Saved results are kept.)'))return; photos.forEach(p=>URL.revokeObjectURL(p.url)); photos=[]; renderPhotos(); }
function delPhoto(i){ URL.revokeObjectURL(photos[i].url); photos.splice(i,1); renderPhotos(); }

/* ---- mask editor ---- */
async function openEd(i){
  const p=photos[i]; const bmp=await createImageBitmap(p.file);
  ed={i,bmp,rot:p.rot,rects:JSON.parse(JSON.stringify(p.rects)),drag:null};
  $('#ed').style.display='flex'; edDraw();
}
function edDims(){ const r=ed.rot%180!==0; return r?[ed.bmp.height,ed.bmp.width]:[ed.bmp.width,ed.bmp.height]; }
function drawRotated(ctx,bmp,rot,W,H){
  ctx.save(); ctx.translate(W/2,H/2); ctx.rotate(rot*Math.PI/180);
  ctx.drawImage(bmp,-bmp.width/2,-bmp.height/2); ctx.restore();
}
function edDraw(){
  const c=$('#edc'); const [W,H]=edDims(); const s=Math.min(1,1600/Math.max(W,H));
  c.width=W*s; c.height=H*s; const x=c.getContext('2d');
  x.save(); x.scale(s,s); drawRotated(x,ed.bmp,ed.rot,W,H); x.restore();
  x.fillStyle='#000';
  for(const r of ed.rects) x.fillRect(r.x*c.width,r.y*c.height,r.w*c.width,r.h*c.height);
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
function edRotate(){ // rotate rects with image (90° cw)
  ed.rects=ed.rects.map(r=>({x:1-r.y-r.h,y:r.x,w:r.h,h:r.w})); ed.rot=(ed.rot+90)%360; edDraw(); }
function edUndo(){ed.rects.pop();edDraw()}
function edClear(){ed.rects=[];edDraw()}
function edDone(all){
  const p=photos[ed.i]; p.rot=ed.rot; p.rects=ed.rects; p.masked=ed.rects.length>0; p.auto=false;   // you drew/checked this one yourself
  const targets=[p];
  if(all&&p.masked) for(const q of photos) if(q!==p&&isLeft(q)&&!q.masked&&!q.noNames&&q.status!=='done'){ q.rot=p.rot; q.rects=JSON.parse(JSON.stringify(p.rects)); q.masked=true; q.auto=true; targets.push(q); }
  ed.bmp.close&&ed.bmp.close(); ed=null; $('#ed').style.display='none'; renderPhotos();
  for(const q of targets) makeThumb(q);
  if(targets.length>1) alert(`Same mask copied to ${targets.length-1} other left-half photo(s) (1st photo of each page with 2 photos).\nCheck every thumbnail marked "auto · check": the black box must cover ALL names / P-No. If not, tap Mask on that photo and fix it.`);
  else if(all) alert('No other photos got the mask. Copy works only on pages with exactly 2 photos (left half first) that are not yet masked.');
}
// small masked preview so you can SEE that the names are covered
async function makeThumb(p){ try{ p.thumb='data:image/jpeg;base64,'+await prepImage(p,360,0.6); renderPhotos(); }catch(e){} }

/* produce masked, rotated, resized JPEG base64 — this is the ONLY image data that leaves the phone */
async function prepImage(p,max=2600,q=0.9){
  const bmp=await createImageBitmap(p.file);
  const r=p.rot%180!==0; const W=r?bmp.height:bmp.width, H=r?bmp.width:bmp.height;
  const s=Math.min(1,max/Math.max(W,H));
  const c=document.createElement('canvas'); c.width=Math.round(W*s); c.height=Math.round(H*s);
  const x=c.getContext('2d'); x.save(); x.scale(s,s); drawRotated(x,bmp,p.rot,W,H); x.restore();
  x.fillStyle='#000'; for(const r of p.rects) x.fillRect(r.x*c.width,r.y*c.height,r.w*c.width,r.h*c.height);
  bmp.close&&bmp.close();
  return c.toDataURL('image/jpeg',q).split(',')[1];
}
