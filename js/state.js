// Global state + localStorage helpers.
/* ================= STATE ================= */
let photos = [];        // {id,file,url,page,masked,noNames,rot,rects,status,half,res:[]}
let day = null;         // {date, cells:{key:{...}}, notes:[], extras:{norm:label}, pages:n}
let ed = null;
const $ = s => document.querySelector(s);
const store = {
  get(){ try{return JSON.parse(localStorage.getItem('ledgerAudit')||'{}')}catch(e){return {}} },
  set(o){ try{localStorage.setItem('ledgerAudit',JSON.stringify(o))}catch(e){alert('Could not save: '+e.message)} }
};
