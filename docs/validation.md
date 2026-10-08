# Validation log

How well the detectors agree with what a person sees. Photos are from Wikimedia Commons and are
**not** committed (they live in the git-ignored `data/check/`). Checked with `web/tools/image-check.html`
and the full-size MediaPipe model.

## 2026-10-08: balances on 10 competition photos

| Photo (Commons) | What it shows | App says | Correct? |
|---|---|---|---|
| Natalia Gaudio 2016 Test Event 3 | Front split, hand holding the leg | Front split **with help**, split 185° → no deduction | ✅ |
| London 2012 group (7914939414) | Leg straight up, no hand | Front split without help, 183° | ✅ plausible |
| Universiade 2017 (36826333990) | Leg up behind, trunk horizontal (row 11) | Not scored | ✅ (out of scope) |
| Natalia Gaudio 2016 Test Event 2 | Front split, trunk bent back (row 5) | Not scored | ✅ (out of scope) |
| Fetisova 2020 Ribbon 2 | Front split, trunk bent far back, hand near leg | First run: "back split with help" ❌ → fixed: not scored | ✅ after fix |
| Malate 2023 (34) | Ring balance with help | First run: "attitude" ❌ → fixed: not scored | ✅ after fix |
| Carolina Pascual 02 | Split leap in the air | No balance | ✅ |
| Oceania 2022 (0694) | Beam (artistic) | No balance | ✅ |
| 2014 Europeans 3 | Leg up behind, trunk far forward (row 11) | Not scored | ✅ (out of scope) |
| KurylskayaBall | — | No person found by MediaPipe | — |

Not yet checked on real photos: **attitude** and **back split without help (foot above head)**: no
suitable Commons photo found. Both are covered by synthetic unit tests only. Next: record 5-10 side-on
clips of each balance and compare with a judge.

Re-run with `web/tools/validate.html` and a `labels.csv`: 10 / 10 photos match their label. Their
landmarks are now unit tests in `web/tests/fixtures/real-balances.js` (numbers only, no images).

Live check: the front-split photo fed as a camera for 1.5 s gave "Front split balance with help,
DB 0.30, counted"; a second 0.6 s hold gave "repeat, E −0.30 not held 1 second".

Observation: a 1° deviation already costs −0.10 (the Code's bands start above 0°). Pose noise is about
±2-3°, so near-perfect shapes may get an occasional −0.10. Judges can reject the call.
