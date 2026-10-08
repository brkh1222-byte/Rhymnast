# Build plan (2 weeks)

## Phase 0 - Verify (Day 1)
- [x] Inspect CoFInAl_AQA and CaFlow repos → not usable, AQA layer dropped (see CLAUDE.md Decisions)
- [x] Decide pose approach → in-browser MediaPipe Pose Landmarker
- [x] Run a webcam pose demo to confirm FPS → 60 FPS in Chrome (full model, GPU)
- [x] Lock element list → split leap, passé balance, passé pivot built; arabesque next; ring = stretch
- [x] Read the matching FIG Code of Points sections → `docs/rules.md`
- [ ] Collect 30-50 public competition clips for validating rules.

## Phase 1 - Skeleton + UI shell (Days 2-5)
- [x] Repo, README, .gitignore (no lint/format tooling: no Node; add if the team installs Node)
- [x] Live webcam + pose overlay, video-file input
- [x] Keypoint smoothing (One Euro filter), confidence handling
- [x] Feature extraction: split angle, thigh elevation, relevé, leg foreshortening, rotation count

## Phase 2 - Elements + deductions (Days 6-9)
- [x] Detectors: split leap, passé balance, passé pivot, unit-tested on synthetic skeletons
- [ ] Unit tests on recorded keypoint files from real clips (JSON fixtures)
- [x] Execution deductions per element, with values from the Code of Points
- [x] Difficulty values per element
- [ ] More elements: arabesque, side split balance; landing faults

## Phase 3 - Scoring + judge panel (Days 10-11)
- [x] Scoring engine: Final = D + A + E − penalties, top 8 DB, repetitions, judge reject
- [x] Judge panel UI (artistry, extra D/E, penalties)
- [x] Event log / audit trail with JSON export

## Phase 4 - Validate + polish (Days 12-14)
- [x] Photo check: 4/6 competition photos detected; split 174.9° on a clean leap (tools/image-check.html)
- [ ] Check detectors against labeled clips; record precision/recall per element in docs/validation.md
- [ ] Fix failure cases, tune performance
- [x] README
- [ ] Demo script, pitch

## Known limits (show in UI and README)
- Single camera = 2D angles. Split angles are only reliable when the camera is side-on to the split plane.
- Frames with low landmark visibility are not scored.
- The CoP says the angles are a guideline for judges; we report the measured angle, not a final verdict.
