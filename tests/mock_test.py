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
    pg.screenshot(path=str(root / "tests/last_run.png"), full_page=True)
    b.close()
assert not errors, errors
print("PASS")
