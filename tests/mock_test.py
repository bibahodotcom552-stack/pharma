"""End-to-end smoke test with the built-in MOCK key (no internet, no quota).
Run:  pip install playwright && playwright install chromium
      python tests/mock_test.py [path/to/any_photo.jpg]
"""
import sys, pathlib
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parents[1]
photo = sys.argv[1] if len(sys.argv) > 1 else str(root / "icons/icon-512.png")
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 400, "height": 850})
    pg.on("dialog", lambda d: d.accept())
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto((root / "index.html").as_uri())
    pg.fill("#apikey", "MOCK"); pg.click("text=Save key")
    pg.set_input_files("#files", photo)
    pg.click(".ph button:has-text('No names')")
    pg.click("#runBtn")
    pg.wait_for_selector("#resultCard", state="visible", timeout=15000)
    stats, table = pg.inner_text("#stats"), pg.inner_text("#tbl")
    print(stats); print(table)
    assert "Paracetamol 500mg Tablet" in table, "template mapping broken"
    assert "Famotidine" in table and table.count("Famotidine") == 1, "handwritten-drug merge broken"
    assert "2 to review" in stats, "flagging broken"
    # ---- Month mode: 2 dates in one run, then the period report ----
    pg.click("text=Clear all photos")
    pg.fill("#date", "2026-11-01"); pg.set_input_files("#files", photo)
    pg.fill("#date", "2026-11-02"); pg.set_input_files("#files", [photo, photo])
    assert "2 date(s) · 3 photo(s)" in pg.inner_text("#photoSum"), "date grouping broken"
    sel = pg.locator(".ph select")
    assert [sel.nth(i).input_value() for i in range(3)] == ["1", "1", "1"], "page auto-numbering broken"
    pg.click(".grp:has-text('02-11-2026') button:has-text('Right halves')")
    assert pg.locator(".ph .badge:has-text('auto')").count() == 1, "right-half No names / auto flag broken"
    sel.nth(2).select_option("2")                                # 2nd photo of 02-11 -> page 2 (one photo per page)
    for _ in range(2): pg.locator(".ph button:has-text('No names')").first.click()
    pg.click("#runBtn")
    pg.wait_for_function("document.querySelector('#log').textContent.includes('Finished')", timeout=30000)
    pstats, ptable = pg.inner_text("#pStats"), pg.inner_text("#pTbl")
    print(pstats); print(ptable)
    assert "2 date(s) saved" in pstats, "period dates broken"
    row = [l for l in ptable.splitlines() if l.startswith("Paracetamol 500mg Tablet")][0]
    assert row.split("	")[1:4] == ["30", "10", "20"], f"period/per-date totals wrong: {row!r}"
    assert "Cells still to review" in pstats, "period flag warning missing"
    pg.screenshot(path=str(root / "tests/last_run.png"), full_page=True)
    b.close()
assert not errors, errors
print("PASS")
