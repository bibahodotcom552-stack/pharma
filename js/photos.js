// Photo list UI, privacy-mask editor, prepImage() = the ONLY image data that leaves the phone.
/* ================= PHOTOS ================= */
$('#files').onchange = e => {
  for(const f of e.target.files){
    if(photos.length>=30){alert('Max 30 photos (15 pages) per date');break}
    const i=photos.length;
    photos.push({id:Math.random().toString(36).slice(2),file:f,url:URL.createObjectURL(f),page:Math.floor(i/2)+1,masked:false,noNames:false,rot:0,rects:[],status:'new',res:[]});
  }
  e.target.value=''; renderPhotos();
};
function renderPhotos(){
  $('#photos').innerHTML = photos.map((p,i)=>{
    const safe=p.masked||p.noNames;
    const st={new:'',run:'<span class="badge b-i st">reading…</span>',done:`<span class="badge b-ok st">✔ ${p.half?('half '+p.half):''}</span>`,err:'<span class="badge b-bad st">error</span>'}[p.status];
    return `<div class="ph ${safe?'':'warn'}">${st}<img src="${p.url}" style="transform:rotate(${p.rot}deg)">
    <div class="b">Page <select onchange="photos[${i}].page=+this.value">${Array.from({length:15},(_,k)=>`<option ${p.page==k+1?'selected':''}>${k+1}</option>`).join('')}</select>
    ${p.masked?'<span class="badge b-ok">masked</span>':p.noNames?'<span class="badge b-ok">no names</span>':'<span class="badge b-w">names?</span>'}
    <div class="bt"><button onclick="openEd(${i})">Mask</button><button onclick="photos[${i}].noNames=!photos[${i}].noNames;renderPhotos()">${p.noNames?'Undo':'No names'}</button><button onclick="delPhoto(${i})">✕</button></div></div></div>`;
  }).join('');
}
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
function edDone(){ const p=photos[ed.i]; p.rot=ed.rot; p.rects=ed.rects; p.masked=ed.rects.length>0; ed.bmp.close&&ed.bmp.close(); ed=null; $('#ed').style.display='none'; renderPhotos(); }

/* produce masked, rotated, resized JPEG base64 — this is the ONLY image data that leaves the phone */
async function prepImage(p){
  const bmp=await createImageBitmap(p.file);
  const r=p.rot%180!==0; const W=r?bmp.height:bmp.width, H=r?bmp.width:bmp.height;
  const s=Math.min(1,2600/Math.max(W,H));
  const c=document.createElement('canvas'); c.width=Math.round(W*s); c.height=Math.round(H*s);
  const x=c.getContext('2d'); x.save(); x.scale(s,s); drawRotated(x,bmp,p.rot,W,H); x.restore();
  x.fillStyle='#000'; for(const q of p.rects) x.fillRect(q.x*c.width,q.y*c.height,q.w*c.width,q.h*c.height);
  bmp.close&&bmp.close();
  return c.toDataURL('image/jpeg',0.9).split(',')[1];
}
