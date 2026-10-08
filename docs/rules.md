# Rules we automate

Source: FIG **Rhythmic Gymnastics Code of Points 2025-2028**, mark-up version valid from 1 April 2025
(link in `data/README.md`). "p. N" = page N of that PDF. The code values live in `web/js/rules.js`.

Status: ✅ = checked against the CoP text · ⚠️ = needs a human to verify.

**How D values were read:** in the difficulty tables the value columns are 0.10 … 0.70, and each
element code ends in its column number (e.g. `1.101` sits in the 0.10 column, `1.303` in 0.30).
So the value = last two digits × 0.10. Cross-checked against the worked examples in the text.

## Final score
- Final score = D score + A score + E score; penalties are deducted from the final (General #5.2, p. 12) ✅
- D: body difficulties (DB), **highest 8 counted** (Difficulty #1.5, p. 21) ✅
- A (Artistry) is judged by humans in our app.
- E max 10, built from execution faults. "Execution faults must be penalized every time and for each
  element at fault" (Execution #1.6) ✅, so repeats still get E deductions.
- Repetition of a difficulty from the same box is not valid (#8.9 jumps; #12.3 rotations: different
  rotations = different boxes regardless of number of turns) ✅

## General shape rule (jumps, balances, rotations)
Difficulty #2.5.1-2.5.4, p. 25. Deviation per incorrect body segment:

| Deviation from the required shape | DB | Execution penalty | Status |
|---|---|---|---|
| 0° (exact shape or better) | valid | none | ✅ |
| small: ≤ 10° | valid | 0.10 per segment | ✅ |
| medium: 11-20° | valid | 0.30 per segment | ✅ |
| large: > 20° | **not valid** | 0.50 per segment | ✅ |

p. 26: "The angles are just a guideline. Judges will learn to think in terms of small, medium, and
large deductions." So the app shows **measured angle + suggested band**; a judge can reject it.

## Split leap: code 1.2103, value 0.30 ✅
- "A split position of 180° is required at the highest point of the leap. The split position may be
  horizontal and will also be accepted when the 180° position is maintained with 1 of the legs above
  and the other below a horizontal position." (table #9, p. 74) ✅
- Value: table #9 item 21, code 1.2103 → 0.30 (p. 78). Matches the example "DB valid: 0.30 p." on p. 72 ✅
- Basics: defined and fixed shape during flight; height sufficient to show it (#8.1.1, p. 72) ✅

**Measured as:** angle between the legs (mid-hip → each ankle), measured through the bottom so
over-splits read above 180°. Best value among frames near the top of the flight (hips ≥ 70% of max
rise). Deviation = 180 − angle → band above. Warns when a leg is foreshortened (camera not side-on).

## Passé balance: code 2.101, value 0.10 ✅
- Passé forward or side, thigh at horizontal (table #11 item 1, p. 88) ✅
- "Stop position fixed in the shape for a minimum of 1 second" (#10.1.2) ✅
- Held less than 1 s with a well-defined shape: valid, E penalty 0.30 "shape not held for a minimum
  1 second" (#10.2.2, p. 84) ✅. No stop at all (swing/kick): not valid (#10.2.3).
- On flat foot the value is reduced by 0.10 (#10.3, p. 84) ✅, so a flat-foot passé = 0.00.

**Measured as:** free thigh elevation from the knee's vertical position (works from any camera
direction); free foot at support-knee height; support leg straight; relevé = heel clearly above toes.
Shapes held under 0.3 s are treated as passing movements, not balance attempts.

## Passé pivot: code 3.101, value 0.10 for 360° ✅
- Minimum basic rotation 360° (#12.1.2, p. 91) ✅
- +0.10 per additional rotation for pivots with base value 0.10 (#12.2.5, p. 92) ✅
- Pivot "must be executed with a high relevé position"; low relevé = E penalty (#12.1.1) ⚠️ not automated
- Heel support stops further rotations from counting (#12.2.3) ⚠️ not automated

**Measured as:** rotations counted from the body's apparent width (wide when facing toward/away
from the camera, narrow when side-on; each change ≈ 90°). Accuracy about ±45°.

## Not automated yet (judges enter by hand)
- Heavy landing; visibly arched back on landing; swing technique ("kip") (Execution table, p. 121) ⚠️
  penalty column to verify before automating
- Other balances (arabesque, side split, etc.): value columns on p. 88-89 are pictogram-dependent ⚠️
- Apparatus difficulties (DA), R elements, dance steps, apparatus faults, artistry
