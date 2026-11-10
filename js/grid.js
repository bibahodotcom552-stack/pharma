// On-phone grid finder — NO AI, nothing leaves the phone.
// Finds the printed table lines in a register photo, so the app can (1) turn the photo upright,
// (2) tell the left half (names / P-No column) from the right half and (3) black out the names by itself.
const GRID_MAX = 1000;   // analyse a small copy (fast on a phone)

async function gridScan(file){
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, GRID_MAX/Math.max(bmp.width,bmp.height));
  const W = Math.round(bmp.width*s), H = Math.round(bmp.height*s);
  const c = document.createElement('canvas'); c.width=W; c.height=H;
  const cx = c.getContext('2d', {willReadFrequently:true}); cx.drawImage(bmp,0,0,W,H); bmp.close&&bmp.close();
  const px = cx.getImageData(0,0,W,H).data;
  const g = new Float32Array(W*H);                       // darkest colour channel: catches grey, blue or green print
  for(let i=0;i<W*H;i++){ const j=i*4; g[i]=Math.min(px[j],px[j+1],px[j+2]); }
  // thin-line detector: a pixel darker than the paper 2 px to both sides = part of a thin line
  const V=[], Hh=[], T=6;
  for(let y=2;y<H-2;y++) for(let x=2;x<W-2;x++){ const i=y*W+x, v=g[i];
    if(g[i-2]<12||g[i+2]<12||g[i-2*W]<12||g[i+2*W]<12) continue;   // next to a black-out box: not a printed line
    const dv=(g[i-2]+g[i+2])/2-v, dh=(g[i-2*W]+g[i+2*W])/2-v;
    if(dv>T && dv>dh) V.push(x,y,Math.min(dv,60));         // vertical line pixel
    if(dh>T && dh>dv) Hh.push(x,y,Math.min(dh,60)); }       // horizontal line pixel
  return {W,H,v:gridLines(V,W,H,0), h:gridLines(Hh,H,W,1)};
}

// Lines of one direction: try small tilts (photo not held straight), keep the sharpest, return peak positions.
// dir 0 = vertical lines (position along x), 1 = horizontal lines (position along y).
function gridLines(P,len,other,dir){
  const n=P.length/3; let best=null;
  const prof=t=>{ const k=Math.tan(t*Math.PI/180), off=Math.ceil(Math.abs(k)*other), A=new Float32Array(len+2*off+1);
    for(let i=0;i<n;i++){ const a=P[3*i+dir], b=P[3*i+1-dir]; const q=Math.round(a-b*k)+off; if(q>=0&&q<A.length) A[q]+=P[3*i+2]; }
    let sc=0; for(let i=0;i<A.length;i++) sc+=A[i]*A[i]; return {t,k,off,A,sc}; };
  for(let t=-7;t<=7;t+=0.5){ const p=prof(t); if(!best||p.sc>best.sc) best=p; }
  for(const d of [-0.25,0.25]){ const p=prof(best.t+d); if(p.sc>best.sc) best=p; }
  const A=best.A, S=new Float32Array(A.length);
  for(let i=0;i<A.length;i++) S[i]=(A[i-1]||0)+2*A[i]+(A[i+1]||0);
  let mx=0; for(const v of S) mx=Math.max(mx,v);
  const pk=[]; for(let i=1;i<S.length-1;i++) if(S[i]>=0.22*mx&&S[i]>=S[i-1]&&S[i]>S[i+1]) pk.push(i);
  const out=[];                                                     // merge double edges of one thick line
  for(const i of pk){ const l=out[out.length-1]; if(l!==undefined&&i-l<=3){ if(S[i]>S[l]) out[out.length-1]=i; } else out.push(i); }
  return {t:best.t, k:best.k, off:best.off, pos:out, str:out.map(i=>Math.round(100*S[i]/mx))};
}

/* ---------- decisions from the lines ---------- */
const gapsOf = pos => pos.slice(1).map((v,i)=>v-pos[i]);
function gridUnit(G){                       // typical spacing (row height or column width), ignores noise
  const h={}; for(const v of G) if(v>=6) h[v]=(h[v]||0)+1;
  let bv=0,best=0; for(const k in h){ const s=h[k]+0.5*((h[+k-1]||0)+(h[+k+1]||0)); if(s>best){best=s;bv=+k} }
  const near=G.filter(v=>Math.abs(v-bv)<=0.2*bv); return near.length? near.reduce((a,b)=>a+b,0)/near.length : bv;
}
// header = the 1–2 very wide bands at one end of the row direction
function gridHead(pos,u){
  const G=gapsOf(pos), m=Math.min(5,G.length), out=[];
  for(const side of [0,1]){ const idx=[...Array(m).keys()].map(i=>side?G.length-1-i:i);
    const big=idx.map(i=>G[i]).sort((a,b)=>b-a); out.push({side,score:((big[0]||0)+(big[1]||0))/u,idx}); }
  return out.sort((a,b)=>b.score-a.score)[0];
}
// where the regular drug columns start, scanning from the names side (5 even gaps in a row)
function gridRegStart(pos,u,fromHigh){
  const G=gapsOf(pos), ok=v=>v>=0.78*u&&v<=1.25*u, R=5;
  if(!fromHigh){ for(let i=0;i+R<=G.length;i++) if(G.slice(i,i+R).every(ok)) return pos[i]; }
  else { for(let j=G.length-1;j-R+1>=0;j--) if(G.slice(j-R+1,j+1).every(ok)) return pos[j+1]; }
  return null;
}
function gridAnalyze(sc){
  const res={ok:false,why:[]};
  const cand=['v','h'].map(a=>{ const L=sc[a], u=gridUnit(gapsOf(L.pos)); return {a,L,u,hd:gridHead(L.pos,u)}; });
  const [r,c]=cand[0].hd.score>=cand[1].hd.score? cand : [cand[1],cand[0]];   // r = row direction (has the header)
  Object.assign(res,{rowAxis:r.a, rowH:+r.u.toFixed(1), colW:+c.u.toFixed(1), headScore:+r.hd.score.toFixed(1), otherScore:+c.hd.score.toFixed(1),
    nRow:r.L.pos.length, nCol:c.L.pos.length});
  if(r.L.pos.length<25||c.L.pos.length<25) res.why.push('too few lines');
  if(r.hd.score<8) res.why.push('no clear header');
  if(c.hd.score>0.8*r.hd.score) res.why.push('header side unclear');
  if(!(r.u<c.u*0.95)) res.why.push('rows not narrower than columns');
  // upright turn (clockwise) and which end of the column direction holds the sheet's LEFT side (names)
  const hiHead=r.hd.side===1;
  if(r.a==='h'){ res.rot=hiHead?180:0;  res.namesHigh=hiHead; }
  else         { res.rot=hiHead?270:90; res.namesHigh=!hiHead; }
  const P=c.L.pos, span=P[P.length-1]-P[0], edge=res.namesHigh?P[P.length-1]:P[0];
  const b=gridRegStart(P,c.u,res.namesHigh);
  if(b===null){ res.why.push('no regular columns'); return res; }
  res.left=+(Math.abs(b-edge)/span).toFixed(3);                // share of the width before the regular drug columns
  res.ratio=+(c.u/r.u).toFixed(2);
  res.cols=+(Math.abs((res.namesHigh?P[0]:P[P.length-1])-b)/c.u).toFixed(1);
  // LEFT half (names) vs RIGHT half: 3 independent signs (tested on real photos: A = 0.17–0.22 / 1.67–1.76 / 41–44,
  // B = 0.01–0.11 / 1.46–1.55 / 57–60). All 3 must agree, otherwise the photo is left for you to check.
  const votesA=[res.left>=0.14, res.ratio>=1.61, res.cols<=50].filter(Boolean).length;
  res.half = votesA===3?'A' : votesA===0?'B' : null;
  if(!res.half) res.why.push('left/right half unclear');
  if(res.half==='A') res.poly=gridNamesPoly(sc,r,c,b,res.namesHigh);
  res.ok=!res.why.length;
  return res;
}
// Black-out shape over the names / P-No zone (follows the tilt of the printed lines), in 0..1 photo coordinates.
// Runs from the inner edge of the printed header (where the stock / patient rows start) to the far edge of the photo.
// The header itself stays visible: the register date is handwritten there, at the top of the names column.
function gridNamesPoly(sc,r,c,bound,namesHigh){
  const vC=c.a==='v', Amax=vC?sc.W:sc.H, Bmax=vC?sc.H:sc.W;            // a = across columns, b = along rows
  const m=0.25*c.u, A0=bound-c.L.off+(namesHigh?-m:m), ab=b=>A0+b*c.L.k;
  const G=gapsOf(r.L.pos), big=r.hd.idx.filter(i=>G[i]>3*r.u), hiHead=r.hd.side===1;
  const hq = hiHead? r.L.pos[Math.min(...big)] : r.L.pos[Math.max(...big)+1];
  const B0=hq-r.L.off+(hiHead?0.3*r.u:-0.3*r.u), bh=a=>B0+a*r.L.k;    // header inner line (+ small margin into the header)
  const aEdge=namesHigh?Amax:0, bFar=hiHead?0:Bmax;
  const b1=bh(aEdge), a2=ab(b1), b2=bh(a2);
  const pts=[[aEdge,b1],[a2,b2],[ab(bFar),bFar],[aEdge,bFar]];
  return pts.map(([a,b])=>vC?[a/sc.W,b/sc.H]:[b/sc.W,a/sc.H]).map(([x,y])=>[Math.min(1,Math.max(0,x)),Math.min(1,Math.max(0,y))]);
}
// turn a 0..1 point by `rot` degrees clockwise (same turn the photo gets)
function rotPt([x,y],rot){ for(let k=0;k<(rot/90)%4;k++) [x,y]=[1-y,x]; return [x,y]; }

// Run on every new photo: upright turn + half + names black-out, all on the phone.
async function autoPrep(p){
  try{
    const a=gridAnalyze(await gridScan(p.file));
    p.grid={ok:a.ok,half:a.half,why:a.why};
    if(!a.ok){ p.auto=false; return; }                         // unclear photo: you mask it by hand (badge "check")
    p.rot=a.rot; p.rects=[]; p.autoHalf=a.half; p.auto=true;
    if(a.half==='A'){ p.polys=[a.poly.map(q=>rotPt(q,a.rot))]; p.masked=true; p.noNames=false; }
    else { p.polys=[]; p.masked=false; p.noNames=true; }
  }catch(e){ p.grid={ok:false,why:['could not analyse: '+e.message]}; }
}
