# Rules we automate

Source: FIG **Rhythmic Gymnastics Code of Points 2025-2028**, mark-up version valid from 1 April 2025
(link in `data/README.md`). "p. N" = page N of that PDF.

Status: ✅ = checked against the CoP text · ⚠️ = needs a human to verify (value is in a pictogram table
or a column we could not read reliably from the PDF text).

## General shape rule (applies to jumps, balances and rotations)
CoP Difficulty #2.5.1-2.5.4, p. 25. A Difficulty (DB) needs a fixed and defined shape. Deviation is per
incorrect body segment:

| Deviation from the required shape | DB (difficulty) | Execution penalty | Status |
|---|---|---|---|
| 0° (exact shape or better) | valid | none | ✅ |
| small: ≤ 10° | valid | 0.10 per segment | ✅ |
| medium: 11-20° | valid | 0.30 per segment | ✅ |
| large: > 20° | **not valid** | 0.50 per segment | ✅ |

Note (p. 26): "The angles are just a guideline. Judges will learn to think in terms of small, medium, and
large deductions." So our app reports the **measured angle plus a suggested band**, not a final verdict.

## Split leap (first element)
- Requirement (table #9, p. 74 ✅): "A split position of 180° is required at the highest point of the leap.
  The split position may be horizontal and will also be accepted when the 180° position is maintained with
  1 of the legs above and the other below a horizontal position."
  → We measure the angle between the two legs, **not** whether the split is horizontal.
- Jump basics (#8.1.1, p. 72 ✅): defined and fixed shape during the flight; height sufficient to show it.
- Example on p. 72 ✅: small deviation → DB valid, E −0.10; medium → DB valid, E −0.30;
  large → DB not valid, E −0.50.
- DB value of the split leap: ⚠️ in the pictogram table near item 21 (p. 78). Read it from the PDF.

### How we compute it
```
splitAngle   = angle between (left hip → left ankle) and (right hip → right ankle), in pixels
peakAngle    = max splitAngle while airborne (the "highest point of the leap")
deviation    = max(0, 180 - peakAngle)
band         = 0 → none, ≤10 → small, 11-20 → medium, >20 → large
```

### Other jump faults (Execution table, p. 121), not automated yet
- Heavy landing ⚠️ (penalty column to verify)
- Incorrect landing: visibly arched back during the final phase of landing ⚠️
- Swing technique ("kip movement") ⚠️

## Balances (next): to do
- Same deviation bands (#2.5). Example table p. 82 ✅ (small split 0.10, medium 0.30, large trunk 0.50
  and DB not valid).
- "Shape not held for a minimum 1 second" (Execution table, p. 121) ⚠️ penalty value.

## Pivots (later): to do
- Deviation bands on the free leg, applied once per rotation DB (#12.2, p. 91) ✅.
