# Build plan (2 weeks)

## Phase 0 - Verify (Day 1)
- [x] Inspect CoFInAl_AQA and CaFlow repos → not usable, AQA layer dropped (see CLAUDE.md Decisions)
- [x] Decide pose approach → in-browser MediaPipe Pose Landmarker
- [ ] Run a webcam pose demo to confirm FPS (done in Phase 1, step 2)
- [x] Lock element list → split leap, balances (passé, arabesque), simple pivot; ring = stretch
- [ ] Read the matching FIG Code of Points sections → `docs/rules.md` (split leap drafted; balances, pivot to do)
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

## Phase 4 - Validate + polish (Days 12-14)
- [ ] Check detectors against labeled clips; record precision/recall per element
- [ ] Fix failure cases, tune performance
- [ ] Demo script, README, pitch

## Known limits (show in UI and README)
- Single camera = 2D angles. Split angles are only reliable when the camera is side-on to the split plane.
- Frames with low landmark visibility are not scored.
- The CoP says the angles are a guideline for judges; we report the measured angle, not a final verdict.
