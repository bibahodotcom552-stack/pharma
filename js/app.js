// Init + service-worker registration.
/* ================= INIT ================= */
(function init(){
  const d=store.get(); if(d.key) $('#apikey').value=d.key; else $('#settings').style.display='block';
  if(d.models) $('#model').innerHTML=d.models.map(m=>`<option ${m===d.model?'selected':''}>${m}</option>`).join('');
  if(d.passes) $('#passes').value=d.passes;
  $('#date').value=new Date(Date.now()+6*3600e3).toISOString().slice(0,10);
  fillHistory();
})();

if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js');
