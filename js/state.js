// Global state + localStorage helpers.
/* ================= STATE ================= */
let photos = [];        // {id,file,url,page,masked,noNames,rot,rects,status,half,res:[]}
let day = null;         // {date, cells:{key:{...}}, notes:[], extras:{norm:label}, pages:n}
let ed = null;
const $ = s => document.querySelector(s);
const fmtD = d => String(d||'').split('-').reverse().join('-');   // 2026-11-08 -> 08-11-2026
// Safe display: AI/user text is shown as text, never as HTML.
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Privacy filter for AI free text, applied BEFORE anything is stored (backup in case a mask missed a name).
// Hides Bangla script, long digit runs (P/NO, phone, ID) and whole strings containing name/ID hints.
const NAME_HINT = /\b(?:name|patient|mr|mrs|ms|md|mst|mosammat|mohammad|mohammed|muhammad|begum|khatun|akter|akhter|bibi|sheikh|uddin|hossain|hussain|rahman|islam|ahmed|ahmad|alam|miah|mia|chowdhury|sarker|sarkar|das|roy|p\s*\/\s*no|p-?no|reg(?:istration)?\s*no|id\s*no|age|s\/o|w\/o|d\/o|son of|wife of)\b/i;
function scrub(s, max=200){
  s = String(s==null?'':s).replace(/[ঀ-৿]+/g,'[Bangla text hidden]').replace(/\d(?:[-\/]?\d){4,}/g,'[number hidden]').replace(/\s+/g,' ').trim();
  if (NAME_HINT.test(s)) return '[hidden: may contain a name or ID]';
  return s.length>max ? s.slice(0,max)+'…' : s;
}
// "raw" should only ever be what a quantity cell looked like: digits and a few marks.
const rawNum = s => String(s==null?'':s).replace(/[^0-9+.\/| -]/g,'').replace(/\d{5,}/g,'?').slice(0,20);
const store = {
  get(){ try{return JSON.parse(localStorage.getItem('ledgerAudit')||'{}')}catch(e){return {}} },
  set(o){ try{localStorage.setItem('ledgerAudit',JSON.stringify(o))}catch(e){alert('Could not save: '+e.message)} }
};
