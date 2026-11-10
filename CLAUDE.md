# Daily Consumption Auditor — project brief for Claude

Current state and last session's work: @HANDOFF.md
Shared rules for all AI tools: @AGENTS.md
Task queue shared with VS Code Copilot: @TASKS.md
At the end of every session (or when I type /handoff) update HANDOFF.md.

## What it is
Mobile web app (PWA) for a pharmacist in Bangladesh. Reads photos of the handwritten IRC
"Daily Consumption" register and returns ONE total per register item (generic + strength) for the whole date, across all uploaded photos.
Output (screen, CSV, Copy) = Drug + Total only; never patient details.
Each sheet is 38 patient rows x 87 printed drug columns, photographed as two halves:
- Half A = Acetylsalicylic acid ... Furosemide (40 columns, includes names/P-No column)
- Half B = Glibenclamide ... Zinc Oxide (47 columns) + blank columns for up to ~5 handwritten extra drugs
**Auto mode (2026-11-10):** the user ONLY picks photos (a week/month at once). On the phone (`js/grid.js`, no AI) each photo is
turned upright, classed left half A / right half B, and the names zone of A is blacked out; unclear photos get ❗ for manual Mask.
The AI reads the date written on the sheet; undated photos get the date of the photo before (upload order). **Month mode:** many dates in one run (user audits every 7–15 days or a month);
each photo carries its `date`; every date is saved as soon as it is finished; section 4 "Period report" sums saved
dates From..To = period total + each date's total per register item.

## Hard rules (never break)
1. **Zero cost.** Only the Google Gemini API free tier (Flash models). No paid APIs, no server, no database.
2. **No patient data leaves the phone.** Names/P-No are blacked out on-device in `prepImage()` before upload
   (automatic polygon from `grid.js`, or the user's boxes). The user still glances at the masked previews before Start.
   Never output, log, store or export names/P-No. AI text passes `cleanRes()`/`scrub()` before it is kept. Row numbers only in review flags.
3. **No build step.** Plain HTML/CSS/classic `<script>` files (no modules, no npm, no framework) so it
   also works opened from a file. Inline `onclick` handlers rely on global functions.
4. Runs on Android Chrome; touch-first UI; dark theme.
5. Results are saved in localStorage under the key `ledgerAudit`. Photos: only the MASKED upright copy, in IndexedDB
   (`js/keep.js`), from Start until that photo is read — so a quota stop can resume after a reload.
6. **The 87 printed drug columns are FIXED** (user-confirmed 2026-11-08). Never add, remove, reorder or rename
   `HALF_A` / `HALF_B` unless the user says the printed register changed. Totals stay per register item (no merging by generic).

## File map (read only what the task needs)
| File | Purpose |
|---|---|
| `js/template.js` | Drug column lists `HALF_A`, `HALF_B`, `ROWS`. Edit ONLY here if the register changes. |
| `js/prompt.js` | AI reading rules (`BASE`), pass methods (`PASS_TXT`), JSON `SCHEMA`. Accuracy tuning goes here. |
| `js/gemini.js` | REST call, 429 back-off, `mockReply()` for key `MOCK`. |
| `js/grid.js` | On-phone grid finder: `gridScan()` thin-line detector + tilt search, `gridAnalyze()` (rotation, half A/B by 3 votes, names polygon), `autoPrep(p)`. Thresholds were tuned on 8 real photos (numbers only). |
| `js/keep.js` | IndexedDB store of masked copies + cleaned results; `keepLoad()` on start shows "waiting from last time". |
| `js/photos.js` | Photo grid (auto group / hand-picked dates), badges, mask editor (boxes + polygons, copy to ❗ photos), masked thumbnails, `prepImage()`, `bake()`. |
| `js/audit.js` | `runAudit()` reads photos in order, `cleanRes()`, sheet date, 3rd tie-break reading (`disputes`/`tbMap`), `assignDates()`, `saveReadyDates()`, `reconcile()` (reading 1 wins unless the 3rd reading agrees with reading 2). |
| `js/results.js` | One-date totals, review flags, manual add, CSV/copy/print, history; period report (`periodData`, `renderPeriod`, CSV, copy). |
| `js/settings.js` | API key, auto-lists free Gemini models, number of passes. |
| `js/state.js`, `js/app.js` | Globals/storage; init + service-worker registration. |
| `sw.js` | Offline cache. **Bump `VERSION` whenever any file changes.** |
| `css/style.css`, `index.html` | UI. |
Skip reading: `icons/`, `tests/last_run.png`, `manifest.webmanifest` (unless the task is about them).

## Data model
`day = {date, pages, photos, ids:[photo ids], cells:{ "photoNo|half|row|drugKey": {page(=photo no),half,row,dk,label,extra,v1,v2,v3,final,conf,flag,settled,ok,raw} }, notes:[], extras:{drugKey:label}}`
Drug keys: `A1..A40`, `B1..B47`, handwritten extras `X:<normalised name>`, manual entries use half `M`.

## How to test
- Quick: open `index.html`, put `MOCK` as the API key, add any image, mark "No names", Start audit.
- Automated: `python tests/mock_test.py` (Playwright; synthetic register sheets, no real photos). Must print PASS.
  Mock hooks: `window.mockDates=['03-11-26','',…]` (one sheet date per photo), `window.mockQuota=true` (simulate daily limit).
- Never commit real register photos. Grid tuning on real photos: run offline, print numbers only.
- Real accuracy: only with a real free key and real register photos; compare against a hand count.

## Deploy (free)
GitHub repo → Settings → Pages → deploy from `main` / root → open the https URL on the phone →
Chrome menu → Install app.

## Roadmap (next steps, in priority order)
1. Accuracy (after the user's first real test): column-number labels drawn on the image from the detected grid, or strips; (done: 3rd tie-break reading, auto upright turn).
2. Show a zoomed crop of the photo for each review flag (needs bounding boxes in the schema).
3. (done: period report; IndexedDB resume; auto mask.) Next: Excel (.xlsx via SheetJS CDN, cached by sw.js).
4. Opening stock / new stock / balance calculation per drug.

## Working style
- Make small, focused changes; keep functions in the file that owns them (see map).
- After a change: run the mock test, bump `sw.js` VERSION, update this file if structure or rules change.
