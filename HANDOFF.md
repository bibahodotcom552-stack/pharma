# HANDOFF — current state (newest on top, keep under ~60 lines)

## Now
- Status: MVP done. Mock test passes. NOT yet tested with a real Gemini key on real register photos.
- Next step: run one real date (both halves of every page), compare totals with a hand count, log accuracy below.
- Open questions: none.

## Log
### 2026-11-08
- Built MVP: 9 JS files, PWA (manifest + sw.js v1), MOCK key, tests/mock_test.py.
- Template: 40 Half-A + 47 Half-B columns copied from sample photos dated 29-06-26.
- Decisions: 2 passes (row-wise + column-wise); pass 1 value wins, disagreement → review flag.
  Names masked on-device before upload (free tier data may be reviewed by Google).

## Accuracy log (fill after real tests)
| Date tested | Pages | Entries by hand | Correct by app | Flags | Notes |
|---|---|---|---|---|---|
