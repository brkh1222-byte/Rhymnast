# Rhymnast: AI judging assistant for rhythmic gymnastics

A gymnast performs in front of a camera. A **pretrained pose model** (Google MediaPipe Pose, in the
browser) finds her joints in every frame. **Rules from the FIG Code of Points** measure the shapes
(e.g. "split leap needs 180° at the highest point") and suggest **Difficulty (D)** values and
**Execution (E)** deductions in real time. Human judges enter **Artistry (A)** and can reject any AI call.

> Decision support, not a replacement for judges. Every call shows the measured angle, the rule and
> page it comes from, and a confidence, and can be rejected. Export the audit log as JSON.

## Live demo

**Live URL: added after the first Vercel deploy.** Vercel deploys `web/` from `main` on every push
(settings in `vercel.json`, no build step); GitHub Actions runs the tests. The first load downloads
the pose model (about 10 MB). Video stays on your device.

## Run it locally (no install needed)

Requires Python 3 (preinstalled on macOS) and Chrome, Edge or Safari. Internet is needed on first
load: the pose model is downloaded from Google's CDN (the default "Heavy" model is 30 MB, about 30 s
the first time; the browser keeps it afterwards). If FPS stays under 15, switch the Model menu to Full.

```sh
cd web
python3 -m http.server 8000
```

Open <http://localhost:8000>, then:

1. **Start camera** (allow access) or **Load video…** to judge a recorded routine.
2. Place the camera **side-on** to the gymnast, with her whole body in view. The "Legs" chip should say
   *full length* during splits.
3. Press **Start judging** and perform. The panel on the video shows the pose being recognized,
   a 1-second hold timer and the deduction so far; after each move a card shows its deduction
   (e.g. "Attitude balance · E −0.30"). Elements also appear in the list on the right.
4. Judges enter Artistry, extra D (apparatus, R, dance steps), extra E and penalties.
   Untick any AI call they disagree with.
5. **Stop judging** opens the **deduction report**: every move with each deduction, the rulebook
   sentence and page behind it, and the totals. Print or save it as PDF; export the audit log (JSON).
6. **Teach poses** (right column): pick a pose, press **Record 3 s** and hold the correct pose
   side-on, or add photos. The app recognizes poses by comparing with these examples (see below).

The camera only works on `localhost` or HTTPS (browser rule). To use it from another device, serve
`web/` over HTTPS (any static host works: it's plain HTML/JS/CSS).

## What it judges

| Element | Code | D value | Automated E deductions |
|---|---|---|---|
| Split leap | 1.2103 | 0.30 | Shape deviation from 180°: ≤10° −0.10, 11–20° −0.30, >20° −0.50 and DB not valid |
| Passé balance | 2.101 | 0.10 (−0.10 on flat foot) | Thigh below horizontal (same bands); held < 1 s −0.30 |
| Passé pivot | 3.101 | 0.10 + 0.10 per extra 360° | Thigh below horizontal (same bands); < 360° not valid |
| **Front split balance with help** | 2.303 | 0.30 ⚠️ (without help: 2.305, 0.50 ⚠️) | Split short of 180° (bands); held < 1 s −0.30; flat foot −0.10 |
| **Back split balance without help** | 2.1005 | 0.50 ⚠️ | Whole foot not above the head (bands, in degrees); held < 1 s −0.30; flat foot −0.10 |
| **Back split balance, trunk forward** | 2.1104 | 0.40 ⚠️ | Split short of 180° and trunk above horizontal, each its own band; held < 1 s −0.30; flat foot −0.10 |
| **Attitude balance** | 2.1202 | 0.20 ⚠️ | Thigh below horizontal and trunk not vertical, each its own band; held < 1 s −0.30; flat foot −0.10 |

⚠️ = balance value read from the table by row order; a teammate must confirm it against the
pictograms on CoP p. 88-89 (see `docs/rules.md`).

Scoring follows the Code: **Final = D + A + E − penalties**, highest 8 body difficulties count, a
repeated difficulty counts once but its execution faults are still deducted.
Rule text, page numbers and how each value was checked: [`docs/rules.md`](docs/rules.md).

**Not automated** (judges add these by hand): apparatus difficulties (DA), R elements, dance steps,
apparatus handling faults, artistry, other body difficulties.

## How it recognizes the poses (no model training)
The pose model (MediaPipe, pretrained by Google) finds the body joints. Our code turns each frame into a
**pose signature** (body angles that don't depend on size, distance or facing direction) and compares it
with a **pose library** of labeled examples: ~1,000 shipped with the app plus the ones your team teaches.
The nearest examples decide which pose it is. The **deduction** is then measured with the rulebook
geometry, so it can always be explained with the Code of Points. Details: `docs/rules.md`.

## Known limits

- **One camera = 2D angles.** Splits are measured correctly only when the camera is side-on to the
  split. If a leg points toward the camera it looks shorter; the app detects this and warns
  ("leg foreshortened, angle unreliable").
- MediaPipe sometimes **misses unusual poses** (deep back bends, inverted shapes). Those frames are not
  scored. In our photo checks it found 4 of 6 competition gymnasts.
- Pivot rotations are counted from how wide the body looks (±45°). Relevé is not checked during pivots.
- Deductions start after a **3° camera margin** (the camera can't measure more precisely); see
  `docs/rules.md` → "Fair judging".
- Dark clothes in front of a dark background make the pose model unsure about the raised leg. The app
  still uses the leg when its shape is plausible and marks the call "low confidence". Best results:
  plain, light background and clothes that contrast with it.
- The Code says angle limits are "a guideline" for judges. The app shows the measurement and a
  suggested band; judges decide.
- Validated so far on synthetic skeletons (unit tests) and competition photos, **not yet on judged
  video**. See PLAN.md Phase 4.

## Project layout

```
web/
  index.html, styles.css     the judging page
  js/app.js                  wiring: video -> pose -> smoothing -> detectors -> scoreboard -> UI
  js/pose.js                 MediaPipe Pose Landmarker (pretrained, pinned CDN version)
  js/geometry.js             angles on landmarks (split, thigh elevation, leg foreshortening)
  js/oneEuro.js              jitter filter for landmarks
  js/rules.js                Code of Points values, each with a page reference
  js/elements/splitLeap.js   leap state machine + 180° rule
  js/elements/passe.js       passé balance (1 s hold, relevé) and pivot (rotation count)
  js/scoring.js              D / E / A / final, top-8, repetitions, judge overrides, audit export
  js/report.js               end-of-routine deduction report (data)
  js/elements/balances.js    the 3 focus balances: recognition + rulebook deductions
  js/library/                pose signature, nearest-neighbour library, default examples
  js/ui/                     video overlay, move cards, report view, Teach poses, library storage
  tests/                     unit tests (no dependencies)
  tools/image-check.html     measure angles on a single photo (for validating rules)
  tools/validate.html        check labeled photo folders against the app; export them as tests
  tools/video-analyze.html   step through a recorded video: what is recognized when, and why not
docs/rules.md                rules we automate, quoted from the Code with page numbers
data/README.md               where to get clips and datasets (nothing in data/ is committed)
```

No build step and no npm packages: plain ES modules, so juniors can read and change everything.

## Tests

```sh
./web/tests/run.sh          # macOS: uses the built-in JavaScriptCore, nothing to install
```

Or open <http://localhost:8000/tests/> in a browser while the server runs.

To check a rule on a real photo, open <http://localhost:8000/tools/image-check.html> and pick an
image (e.g. the peak frame of a leap).

To check many labeled photos at once (e.g. a teammate's attitudes), follow "Validation photos" in
`data/README.md` and open <http://localhost:8000/tools/validate.html>. Nothing is trained: the photos
show whether the rules agree with a judge, and their landmarks (no images) become unit tests.

## Adding an element

1. Quote the rule and value from the Code of Points in `docs/rules.md` with the page number.
2. Add its values to `ELEMENTS` in `web/js/rules.js`.
3. Write a detector in `web/js/elements/` with an `update({ t, lm })` method that calls
   `onEvent(event)`. Copy the event shape from `judgeSplitLeap` in `splitLeap.js`.
4. Add synthetic-pose tests in `web/tests/` and register the file in `tests/all.js`.
5. Wire it in `web/js/app.js` next to the other detectors.
