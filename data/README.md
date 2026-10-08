# Data

Nothing in this folder is committed (see `.gitignore`). This file explains where to get the data.

## Pose model
The MediaPipe Pose Landmarker model (`.task`) is loaded by the web app from Google's CDN at runtime.
You do not need to download it.

## Validation clips
We validate rules on **public competition videos** (FIG / national federation broadcasts on YouTube).
- Save clips locally in `data/clips/`, named `<element>_<source>_<n>.mp4`, e.g. `splitleap_fig2025_01.mp4`.
- Prefer clips filmed side-on to the gymnast (needed for reliable split angles).
- Track the source URL and timestamp of every clip in `data/clips/SOURCES.md` (also not committed).
- Do not redistribute the videos. Only keypoint JSON extracted from them goes into the repo as test fixtures.

## RG dataset (optional, reference only)
1000 rhythmic gymnastics routines (ball, clubs, hoop, ribbon) with D/E/total scores, from the
ACTION-NET repo: https://github.com/qinghuannn/ACTION-NET
- The repo has **no license**. Use it for internal reference only; do not redistribute.
- The OneDrive download link returned HTTP 403 to scripts on 2026-10-08. Try it in a browser.

## FIG Code of Points
RG Code of Points 2025-2028 (mark-up, valid from 1 April 2025), from the FIG rules page:
https://www.gymnastics.sport/publicdir/rules/files/en_1.1%20-%20RG%20Code%20of%20Points%202025-2028%20(mark-up)%20-%20valid%20from%201st%20April%202025.pdf
Rules we implement are summarized with page numbers in `docs/rules.md`.
