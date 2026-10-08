# Project: Rhythmic Gymnastics AI Judging Assistant (PineQuest entry)

## What we're building
A real-time computer-vision web app for **rhythmic gymnastics**. A gymnast performs in front of a camera.
The system scores **Technical Difficulty (D)** and **Execution (E)**. Human judges score **Artistry and
facial expression** in a separate judge panel. The app combines them into a final score.
Positioning: *decision support that flags measurable deductions judges can miss, with an audit trail*, not a judge replacement.

## Constraints
- 2-week build, team of 5 junior engineers. Keep scope small and demo-able.
- **Use pretrained models only. Do not train from scratch.** Integrate, don't research.
- No judge-scored video of our own. Public data only (RG dataset, public competition videos).
- Real time = roughly 15-30 FPS on a laptop webcam.
- Possibly open-sourced later and pitched to Y Combinator: keep the code clean and documented.

## Architecture (hybrid)
| Layer | Tool | When |
|---|---|---|
| Skeleton tracking | Pretrained pose model (MediaPipe Pose in browser, or RTMPose/YOLO-pose on a Python backend) | Live, per frame |
| Element + deduction flags | Small rule set on keypoints (split angle, balance height, supporting-leg bend, landing) | Live |
| Overall execution estimate | Pretrained/RG-trained AQA model (CoFInAl or CaFlow), if usable weights exist | After the routine |
| Artistry / expression | Human judge panel UI | Manual |

Known limits (be honest in the UI and README):
- AQA research models score a whole routine after it ends (~1.5 min videos), usually one model per apparatus, and output a number with no per-deduction explanation. They are NOT live.
- Whether CoFInAl / CaFlow publish downloadable trained weights is UNVERIFIED. Check first.
- Start body-only (jumps, balances, pivots). Apparatus tracking (ribbon, ball) is a stretch goal.
- Automate only deductions that are measurable. Do not claim to match human scores.

## Reference repos / data
- CoFInAl: github.com/ZhouKanglei/CoFInAl_AQA
- CaFlow: github.com/Harrison21/CaFlow
- RG dataset: 1000 videos, 4 apparatus (ball, clubs, hoop, ribbon), with difficulty / execution / total scores. Check licensing before redistributing.
- Fujitsu + FIG Judging Support System covers artistic gymnastics and is proprietary. It is useful for pitch context only.

## Working rules for Claude Code
- Build in small steps. Do not generate the whole app at once. Finish and test one step, then commit.
- Before writing code, state the plan for the step in a few lines and wait for approval on anything ambiguous.
- Keep this file and PLAN.md up to date as decisions change.
- Prefer simple, readable code over clever code. The team is junior.
- Never commit videos, model weights or datasets. Use .gitignore and a `data/README.md` explaining how to download them.

## Open decisions (ask the user before assuming)
1. Pose inference location: in-browser (MediaPipe JS) vs Python backend (FastAPI + WebSocket).
2. Final element list (suggested 6-8: split leap, ring jump, 3 balances, simple pivot).
3. Whether usable AQA weights exist; if not, drop the AQA layer for the 2-week build.

See PLAN.md for the phased build order.
