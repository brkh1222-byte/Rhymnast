# Build plan (2 weeks)

## Phase 0 - Verify (Day 1)
- [ ] Inspect CoFInAl_AQA and CaFlow repos: are trained weights published? Inference requirements? GPU needed?
- [ ] Decide pose approach (browser vs Python backend). Run a webcam pose demo to confirm FPS.
- [ ] Lock element list and read the matching FIG Code of Points sections (deduction values).
- [ ] Collect 30-50 public competition clips for validating rules.

## Phase 1 - Skeleton + UI shell (Days 2-5)
- [ ] Repo, README, .gitignore, lint/format
- [ ] Live webcam + pose overlay
- [ ] Keypoint smoothing (One Euro filter), confidence handling
- [ ] Feature extraction: joint angles, leg split angle, hip/foot height, trunk tilt, rotation speed

## Phase 2 - Elements + deductions (Days 6-9)
- [ ] One detector per element (state machine over short frame windows), each with unit tests on recorded keypoint files
- [ ] Execution deductions per element, with values from the Code of Points
- [ ] Difficulty values per element

## Phase 3 - Scoring + judge panel (Days 10-11)
- [ ] Scoring engine: D + (10 - E deductions) + judge artistry = final
- [ ] Judge panel UI (artistry and expression entry)
- [ ] Event log / audit trail: every flagged deduction with timestamp, angle, confidence
- [ ] Optional: AQA model estimate after the routine (only if weights are usable)

## Phase 4 - Validate + polish (Days 12-14)
- [ ] Check detectors against labeled clips; record precision/recall per element
- [ ] Fix failure cases, tune performance
- [ ] Demo script, README, pitch
