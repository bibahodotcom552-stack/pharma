# HANDOFF — current state (newest on top, keep under ~60 lines)

## Now
- Status: **Auto mode** built (sw v7): user only picks photos → phone turns upright, finds half A/B, blacks out names (js/grid.js, 8/8 real photos right, offline check), AI reads sheet date (undated → date of photo before), 3rd tie-break reading, IndexedDB resume after a quota stop. Mock tests PASS.
- Next step: user's first REAL test with a free Gemini key (e.g. the 29-06-26 photos) → compare 3 busy columns with a hand count → Accuracy log. Watch: is the date read? are ❗ photos rare?
- Known (from real photos): date is handwritten ONLY on half A, in the "SL NO / Date" box top-left inside the header → mask starts below the header so the date stays visible; right halves get a date by gallery order (each date needs as many B as A).

## Log
### 2026-11-10
- Auto mode: grid.js (thin-line detector + tilt search; header = 2 wide bands at one end of the row direction; half A if names zone ≥14% AND colW/rowH ≥1.61 AND ≤50 columns, B if none, else ❗). Mask re-check on real photos: names zone 0% left, 40–43 drug columns kept.
- keep.js (IndexedDB, masked copies only until read), cleanRes() before storing, assignDates/saveReadyDates, tie-break (gemini pass 'tb', TB_SCHEMA), photo numbers instead of page numbers.
### 2026-11-08 (later)
- Global Claude setup done (~/.claude CLAUDE.md, agents, commands, settings.json; no backups needed — none existed). Repo: github.com/bibahodotcom552-stack/pharma (public), Pages from main/root.
- Fixes: scrub()/rawNum() before storing AI text, esc() on screen; output = Drug + Total only (no page columns).
- Month mode: photos tagged by date, "Right halves → No names", mask copy to left halves (both marked "auto · check" and must be confirmed before sending), page auto-numbering fills next free page, model auto-switch on daily quota, keepEdits() keeps ✔/manual/renamed on re-run, period report (js/results.js).
- Research: Gemini free limits per project+model, reset midnight Pacific (~2 PM BD), free-tier data may be read by Google reviewers → masking mandatory.
### 2026-11-08
- Built MVP: 9 JS files, PWA (manifest + sw.js v1), MOCK key, tests/mock_test.py.
- Template: 40 Half-A + 47 Half-B columns copied from sample photos dated 29-06-26.
- Decisions: 2 passes (row-wise + column-wise); pass 1 value wins, disagreement → review flag.
  Names masked on-device before upload (free tier data may be reviewed by Google).

## Accuracy log (fill after real tests)
| Date tested | Pages | Entries by hand | Correct by app | Flags | Notes |
|---|---|---|---|---|---|
