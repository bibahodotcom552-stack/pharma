"""End-to-end smoke test with the built-in MOCK key (no internet, no quota, no real photos).
Run:  pip install playwright && playwright install chromium
      python tests/mock_test.py
Synthetic register sheets (drawn by the test, no patient data) check the on-phone grid finder.
"""
import sys, pathlib, base64
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parents[1]
icon = str(root / "icons/icon-512.png")
errors = []

# Draws a fake half-sheet: 2-band printed header, 43 rows, drug columns; half A also gets a scribbled names zone.
SYNTH = """([half,rot])=>{
  const A=half==='A', W=A?1000:880, H=760, c=document.createElement('canvas'); c.width=W; c.height=H;
  const x=c.getContext('2d'); x.fillStyle='#f4f1ea'; x.fillRect(0,0,W,H); x.strokeStyle='#666'; x.lineWidth=2;
  const L=(a,b,c2,d)=>{x.beginPath();x.moveTo(a,b);x.lineTo(c2,d);x.stroke();};
  const top=60, hEnd=220, rowH=11, rows=43, bot=hEnd+rows*rowH, left=20;
  const cols=[left]; if(A){cols.push(60,200,240); for(let i=1;i<=40;i++) cols.push(240+i*18.5);} else for(let i=1;i<=52;i++) cols.push(left+i*16);
  const right=cols[cols.length-1];
  for(const y of [top,140,hEnd]) L(left,y,right,y);
  for(let r=1;r<=rows;r++) L(left,hEnd+r*rowH,right,hEnd+r*rowH);
  for(const cx of cols) L(cx,top,cx,bot);
  let s=7; const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  x.strokeStyle='#223'; x.lineWidth=1.5;
  if(A) for(let r=0;r<38;r++) for(let k=0;k<14;k++){ const px=65+rnd()*170, py=hEnd+r*rowH+2+rnd()*7; L(px,py,px+3+rnd()*9,py+(rnd()-0.5)*8); }
  for(let k=0;k<60;k++){ const ci=(A?4:1)+Math.floor(rnd()*30), px=cols[ci]+5, py=hEnd+Math.floor(rnd()*38)*rowH+2; L(px,py,px+2,py+7); }
  const o=document.createElement('canvas'), r90=rot%180!==0; o.width=r90?H:W; o.height=r90?W:H;
  const y=o.getContext('2d'); y.translate(o.width/2,o.height/2); y.rotate(rot*Math.PI/180); y.drawImage(c,-W/2,-H/2);
  return o.toDataURL('image/jpeg',0.92).split(',')[1];
}"""
# share of near-black pixels in a vertical strip of the masked thumbnail (rows area only)
DARK = """async([i,x0,x1])=>{ const p=photos[i]; const im=new Image(); im.src=p.thumb; await im.decode();
  const c=document.createElement('canvas'); c.width=im.width; c.height=im.height; const g=c.getContext('2d'); g.drawImage(im,0,0);
  const d=g.getImageData(0,0,c.width,c.height).data; let k=0,t=0;
  for(let y=Math.floor(c.height*0.4);y<c.height*0.9;y++) for(let x=Math.floor(c.width*x0);x<c.width*x1;x++){ const j=(y*c.width+x)*4; t++; if(d[j]+d[j+1]+d[j+2]<40) k++; }
  return k/t; }"""

def wait_prep(pg):
    pg.wait_for_function("photos.length && photos.every(p=>!p.prep) && !document.querySelector('#photoSum').textContent.includes('preparing')", timeout=30000)

def no_names_all(pg):
    # the test icon is not a register sheet -> marked ❗ -> tap "No names" on each
    while pg.locator(".ph button:has-text('No names')").count():
        pg.locator(".ph button:has-text('No names')").first.click()

def run(pg):
    pg.click("#runBtn")
    pg.wait_for_function("document.querySelector('#log').textContent.match(/Finished|Stopped/)", timeout=30000)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 400, "height": 850})
    pg = ctx.new_page()
    pg.on("dialog", lambda d: d.accept())
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto((root / "index.html").as_uri())
    pg.fill("#apikey", "MOCK"); pg.click("text=Save key")

    # ---- 1. automatic preparation on synthetic sheets ----
    files = []
    for n, (half, rot) in enumerate([("A", 90), ("B", 180)], 1):
        files.append({"name": f"synth{n}.jpg", "mimeType": "image/jpeg", "buffer": base64.b64decode(pg.evaluate(SYNTH, [half, rot]))})
    pg.set_input_files("#files", files); wait_prep(pg)
    info = pg.evaluate("photos.map(p=>({rot:p.rot,half:p.autoHalf,masked:p.masked,noNames:p.noNames,polys:p.polys.length,why:p.grid&&p.grid.why}))")
    print("auto-prep:", info)
    assert info[0]["half"] == "A" and info[0]["masked"] and info[0]["rot"] == 270, f"left half not prepared: {info[0]}"
    assert info[1]["half"] == "B" and info[1]["noNames"] and info[1]["rot"] == 180 and not info[1]["polys"], f"right half not prepared: {info[1]}"
    names_dark, drugs_dark = pg.evaluate(DARK, [0, 0.06, 0.20]), pg.evaluate(DARK, [0, 0.35, 0.95])
    print(f"left half: names zone {names_dark:.0%} black, drug zone {drugs_dark:.0%} black")
    assert names_dark > 0.95 and drugs_dark < 0.03, "names black-out in the wrong place"
    assert pg.locator(".badge:has-text('names hidden')").count() == 1 and pg.locator(".badge:has-text('right half')").count() == 1
    pg.click("text=Clear all photos")

    # ---- 2. one date picked by hand; 3rd reading settles one disagreement, one stays flagged ----
    pg.uncheck("#autoDate"); pg.fill("#date", "2026-11-05")
    pg.set_input_files("#files", icon); wait_prep(pg)
    assert pg.locator(".badge:has-text('mask by hand')").count() == 1, "unclear photo not marked ❗"
    no_names_all(pg); run(pg)
    stats, table = pg.inner_text("#stats"), pg.inner_text("#tbl")
    print(stats); print(table)
    assert "Paracetamol 500mg Tablet" in table, "template mapping broken"
    assert "Famotidine" in table and table.count("Famotidine") == 1, "handwritten-drug merge broken"
    assert "1 to review" in stats and "1 settled by 3rd reading" in stats, "flagging / tie-break broken"
    lines = table.splitlines(); i = lines.index("Paracetamol 500mg Tablet")
    assert lines[i + 2].strip() == "10", f"tie-break should keep 10: {lines[i:i+3]!r}"

    # ---- 3. Month mode with dates picked by hand ----
    pg.click("text=Clear all photos")
    pg.fill("#date", "2026-11-01"); pg.set_input_files("#files", icon)
    pg.fill("#date", "2026-11-02"); pg.set_input_files("#files", [icon, icon]); wait_prep(pg)
    assert "3 photo(s)" in pg.inner_text("#photoSum")
    no_names_all(pg); run(pg)
    pstats, ptable = pg.inner_text("#pStats"), pg.inner_text("#pTbl")
    print(pstats); print(ptable)
    assert "2 date(s) saved" in pstats, "period dates broken"
    row = [l for l in ptable.splitlines() if l.startswith("Paracetamol 500mg Tablet")][0]
    assert row.split("\t")[1:4] == ["30", "10", "20"], f"period/per-date totals wrong: {row!r}"
    assert "Cells still to review" in pstats, "period flag warning missing"

    # ---- 4. dates read from the sheets (left halves only); right halves placed by gallery order ----
    pg.click("text=Clear all photos"); pg.check("#autoDate")
    pg.set_input_files("#files", [icon] * 5); wait_prep(pg); no_names_all(pg)
    pg.evaluate("window.mockDates=['07-11-26','','','08-11-26','']; window.mockHalves=['A','B','B','A','A']")
    run(pg)
    got = pg.evaluate("photos.map(dateOf)")
    print("dates:", got)
    assert got == ["2026-11-07", "2026-11-07", "2026-11-08", "2026-11-08", "2026-11-08"], f"date placement wrong: {got}"
    assert pg.locator(".badge:has-text('guessed')").count() == 3, "guessed dates not shown"
    assert "07-11-2026 → 08-11-2026 · 2 date(s) saved" in pg.inner_text("#pStats")
    pg.evaluate("fixDate(photos.findIndex(p=>p.no===photos[4].no),'2026-11-09')")   # you correct one photo's date
    assert "2026-11-09" in pg.inner_text("#history"), "date correction not saved"
    tot = "JSON.stringify(totals(store.get().days['2026-11-07']))"
    before = pg.evaluate(tot)
    pg.locator(".ph").nth(1).locator("button:has-text('✕')").click()          # remove photo 2 (already read) from the list
    assert pg.evaluate("saveReadyDates()") >= 1                                # date 07-11 gets saved again (as on the next Start)
    assert pg.evaluate(tot) == before, "removing a read photo dropped its counts"

    # ---- 5. stop on the daily limit, reload the page, continue ----
    pg.click("text=Clear all photos")
    pg.set_input_files("#files", icon); wait_prep(pg); no_names_all(pg)
    pg.evaluate("window.mockDates=['06-11-26']; window.mockQuota=true")
    run(pg)
    assert "Stopped" in pg.inner_text("#log")
    pg.reload(); pg.wait_for_function("photos.length===1")
    assert "waiting from last time" in pg.inner_text("#pending"), "photo not kept for resuming"
    assert pg.evaluate("photos[0].baked && !!photos[0].file && photos[0].status==='new'")
    pg.evaluate("window.mockDates=['06-11-26']")
    run(pg)
    assert "✅ Finished" in pg.inner_text("#log") and "2026-11-06" in pg.inner_text("#history"), "resume after reload broken"
    pg.reload(); pg.wait_for_function("photos.length===1")
    assert pg.evaluate("photos[0].status==='done' && !photos[0].file"), "read photo should no longer be stored"
    pg.screenshot(path=str(root / "tests/last_run.png"), full_page=True)
    b.close()
assert not errors, errors
print("PASS")
