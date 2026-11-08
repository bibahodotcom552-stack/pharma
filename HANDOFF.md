# HANDOFF — current state (newest on top, keep under ~60 lines)

## Now
- Status: Month mode built (many dates in one run, each date saved when finished, period report = period total + each date's total, CSV/Copy). Privacy filter + safe display done. Live: https://bibahodotcom552-stack.github.io/pharma/ (sw v5 after push). Mock tests PASS.
- Next step: user runs ONE real date with a free Gemini key and compares with a hand count → fill Accuracy log.
- Open questions: user to tick the 87 drug names against the printed register (list given 2026-11-08; the 87 are FIXED). Free limit ≈ 20 reads/day per Flash model (unofficial) → a month may take 1–3 days; photos are lost if the page is closed (IndexedDB resume = roadmap).

## Log
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
