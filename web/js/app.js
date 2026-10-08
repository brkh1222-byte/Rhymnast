// App wiring: video source -> pose model -> smoothing -> rule detectors -> scoreboard -> UI.

import { createPoseTracker } from './pose.js';
import { LandmarkSmoother } from './oneEuro.js';
import { legLengthRatios } from './geometry.js';
import { SplitLeapDetector, legsFullLength } from './elements/splitLeap.js';
import { PasseDetector } from './elements/passe.js';
import { BalanceDetector } from './elements/balances.js';
import { Scoreboard } from './scoring.js';
import { RULE_SOURCE } from './rules.js';
import { drawSkeleton } from './draw.js';

const $ = (id) => document.getElementById(id);
const ui = {
  video: $('video'), canvas: $('overlay'), stage: $('stage'), stageMsg: $('stage-msg'),
  badge: $('judging-badge'), btnCamera: $('btn-camera'), fileInput: $('file-input'),
  btnJudge: $('btn-judge'), btnReset: $('btn-reset'), btnExport: $('btn-export'),
  modelSelect: $('model-select'), events: $('events'), eventCount: $('event-count'),
  fps: $('fps'), view: $('view'), split: $('split'), shape: $('shape'), releve: $('releve'), state: $('state'),
  final: $('final'), scoreD: $('score-d'), scoreE: $('score-e'), scoreA: $('score-a'),
  scoreDDetail: $('score-d-detail'), scoreEDetail: $('score-e-detail'),
  inArtistry: $('in-artistry'), inExtraD: $('in-extra-d'), inExtraE: $('in-extra-e'), inPenalties: $('in-penalties'),
};
const ctx = ui.canvas.getContext('2d');

const state = {
  tracker: null,
  trackerVariant: null,
  source: null, // 'camera' | 'file'
  judging: false,
  routineStartMs: 0, // event times are shown relative to this
  lastVideoTime: -1,
  fpsFrames: 0,
  fpsSince: performance.now(),
  fileName: null,
};

const smoother = new LandmarkSmoother();
const scoreboard = new Scoreboard();
const onEvent = (event) => {
  if (!state.judging) return;
  scoreboard.add({ ...event, routineMs: Math.max(0, event.t - state.routineStartMs) });
  renderEvents();
  renderScores();
};
const leap = new SplitLeapDetector(onEvent);
const passe = new PasseDetector(onEvent);
const balance = new BalanceDetector(onEvent);

// ---------- Model ----------

async function ensureTracker() {
  const variant = ui.modelSelect.value;
  if (state.tracker && state.trackerVariant === variant) return;
  setMessage('Loading pose model…');
  state.tracker?.close();
  state.tracker = await createPoseTracker(variant);
  state.trackerVariant = variant;
  setMessage(null);
}

// ---------- Sources ----------

async function startCamera() {
  try {
    stopSource();
    await ensureTracker();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    });
    ui.video.srcObject = stream;
    ui.video.controls = false;
    await ui.video.play();
    state.source = 'camera';
    onSourceReady();
  } catch (err) {
    console.error(err);
    setMessage(err.name === 'NotAllowedError'
      ? 'Camera permission was denied. Allow camera access and try again.'
      : `Could not start the camera: ${err.message}`);
  }
}

async function loadFile(file) {
  try {
    stopSource();
    await ensureTracker();
    ui.video.srcObject = null;
    ui.video.src = URL.createObjectURL(file);
    ui.video.controls = true;
    state.source = 'file';
    state.fileName = file.name;
    await new Promise((resolve) => { ui.video.onloadeddata = resolve; });
    onSourceReady();
    newRoutine();
    setJudging(true); // judge the clip from the start
    await ui.video.play();
  } catch (err) {
    console.error(err);
    setMessage(`Could not load the video: ${err.message}`);
  }
}

function stopSource() {
  const stream = ui.video.srcObject;
  if (stream) stream.getTracks().forEach((track) => track.stop());
  if (ui.video.src) URL.revokeObjectURL(ui.video.src);
  ui.video.removeAttribute('src');
  ui.video.srcObject = null;
  state.source = null;
  setJudging(false);
}

function onSourceReady() {
  fitOverlayToVideo();
  ui.btnJudge.disabled = false;
  resetTracking();
  setMessage(null);
}

/** Keeps the overlay canvas the same size as the video (cameras can change resolution). */
function fitOverlayToVideo() {
  const { videoWidth: w, videoHeight: h } = ui.video;
  if (!w || (ui.canvas.width === w && ui.canvas.height === h)) return;
  ui.canvas.width = w;
  ui.canvas.height = h;
  ui.stage.style.aspectRatio = `${w} / ${h}`;
}

// ---------- Main loop ----------

function currentTimeMs() {
  // Files: use the video clock, so event times match the clip. Camera: wall clock.
  return state.source === 'file' ? ui.video.currentTime * 1000 : performance.now();
}

function tick() {
  requestAnimationFrame(tick);
  if (!state.tracker || !state.source || ui.video.readyState < 2) return;
  if (ui.video.currentTime === state.lastVideoTime) return; // no new frame yet
  state.lastVideoTime = ui.video.currentTime;
  fitOverlayToVideo();

  const raw = state.tracker.detect(ui.video);
  const t = currentTimeMs();
  let lm = null;
  if (raw) {
    const w = ui.video.videoWidth;
    const h = ui.video.videoHeight;
    const pixels = raw.map((p) => ({ x: p.x * w, y: p.y * h, visibility: p.visibility ?? 0 }));
    lm = smoother.smooth(pixels, t / 1000);
  } else {
    smoother.reset(); // don't drag old positions into the next person seen
  }
  // Detectors also get frames with nobody visible (lm = null), so a shape that ends by
  // leaving the frame is still closed and judged.
  leap.update({ t, lm });
  passe.update({ t, lm, airborne: leap.live.airborne });
  balance.update({ t, lm, airborne: leap.live.airborne });

  drawSkeleton(ctx, lm, legColor());
  renderLive(lm);
  countFps();
}

function legColor() {
  if (leap.live.airborne) return '#e8a3b0'; // blush: in flight
  if (passe.live.inShape || balance.live.shape) return '#9fc4aa'; // sage: holding a balance shape
  return '#d9bd84'; // champagne gold: standing
}

function countFps() {
  state.fpsFrames += 1;
  const now = performance.now();
  if (now - state.fpsSince >= 1000) {
    const fps = Math.round((state.fpsFrames * 1000) / (now - state.fpsSince));
    ui.fps.textContent = fps;
    ui.fps.className = fps >= 15 ? 'good' : 'bad';
    state.fpsFrames = 0;
    state.fpsSince = now;
  }
}

// ---------- Judging controls ----------

function setJudging(on) {
  if (!on && state.judging) {
    passe.flush(); // judge a balance still being held
    balance.flush();
  }
  state.judging = on;
  if (on && state.source === 'camera' && scoreboard.events.length === 0) {
    state.routineStartMs = performance.now();
  }
  ui.btnJudge.textContent = on ? 'Stop judging' : 'Start judging';
  ui.btnJudge.classList.toggle('active', on);
  ui.badge.hidden = !on;
}

function newRoutine() {
  scoreboard.reset();
  state.routineStartMs = state.source === 'camera' ? performance.now() : 0;
  resetTracking();
  renderEvents();
  renderScores();
}

function resetTracking() {
  smoother.reset();
  leap.reset();
  passe.reset();
  balance.reset();
  state.lastVideoTime = -1;
}

// ---------- Rendering ----------

function setMessage(text) {
  if (text) ui.stageMsg.textContent = text;
  ui.stageMsg.hidden = !text;
}

function renderLive(lm) {
  if (!lm) {
    for (const el of [ui.view, ui.split, ui.shape, ui.releve]) el.textContent = '–';
    ui.state.textContent = 'no gymnast';
    return;
  }
  const fullLegs = legsFullLength(legLengthRatios(lm));
  ui.view.textContent = fullLegs ? 'full length' : 'foreshortened';
  ui.view.className = fullLegs ? 'good' : 'warn';
  const split = leap.live.splitDeg;
  ui.split.textContent = split == null ? '–' : `${Math.round(split)}°`;
  ui.shape.textContent = shapeLabel();
  ui.releve.textContent = passe.live.releve == null ? '?' : passe.live.releve ? 'yes' : 'no';
  ui.state.textContent = leap.live.airborne
    ? 'in flight'
    : passe.live.inShape
      ? `passé${passe.live.rotationDeg ? ` · turning ${passe.live.rotationDeg}°` : ''}`
      : balance.live.shape ? 'balance' : 'ground';
}

/** The shape being held right now, with its main angle, for the live strip. */
function shapeLabel() {
  const b = balance.live;
  if (b.shape) return b.mainDeg == null ? b.label : `${b.label} ${Math.round(b.mainDeg)}°`;
  if (passe.live.inShape && passe.live.thighDeg != null) return `passé ${Math.round(passe.live.thighDeg)}°`;
  return '–';
}

function judgeInputs() {
  return {
    artistry: ui.inArtistry.value,
    extraD: ui.inExtraD.value,
    extraE: ui.inExtraE.value,
    penalties: ui.inPenalties.value,
  };
}

function renderScores() {
  const r = scoreboard.compute(judgeInputs());
  ui.final.textContent = r.final.toFixed(2);
  ui.scoreD.textContent = r.D.toFixed(2);
  ui.scoreE.textContent = r.E.toFixed(2);
  ui.scoreA.textContent = r.A.toFixed(2);
  const b = r.breakdown;
  ui.scoreDDetail.textContent = `AI ${b.autoD.toFixed(2)}${b.extraD ? ` + ${b.extraD.toFixed(2)}` : ''}`;
  ui.scoreEDetail.textContent = `AI −${b.autoE.toFixed(2)}${b.extraE ? ` − ${b.extraE.toFixed(2)}` : ''}`;
  return r;
}

const STATUS_LABEL = {
  counted: ['counted', 'good'],
  repeat: ['repeat: not counted', 'muted'],
  'not valid': ['DB not valid', 'bad'],
  'not in top 8': ['not in top 8', 'muted'],
  rejected: ['rejected by judge', 'muted'],
};

function renderEvents() {
  const { status } = scoreboard.compute(judgeInputs());
  ui.events.replaceChildren();
  ui.eventCount.textContent = scoreboard.events.length;
  if (scoreboard.events.length === 0) {
    const li = el('li', 'empty');
    li.innerHTML = 'No elements yet. Press <b>Start judging</b>, then perform.';
    ui.events.append(li);
    return;
  }
  for (const e of [...scoreboard.events].reverse()) {
    const li = el('li', `event${e.rejected ? ' rejected' : ''}`);

    const head = el('div', 'event-head');
    head.append(el('span', 'event-title', e.element), el('span', 'event-time', formatTime(e.routineMs)));
    li.append(head);

    const [label, tone] = STATUS_LABEL[status.get(e.id)] ?? ['', 'muted'];
    const dbLine = el('div');
    dbLine.append(
      el('span', `tag ${tone}`, `DB ${e.dbValue.toFixed(2)} · ${label}`),
      el('span', 'event-meta', `  ${e.code} · ${describe(e.measurements)} · confidence ${e.confidence}`),
    );
    li.append(dbLine);

    for (const p of e.penalties) li.append(el('div', 'penalty', `E −${p.value.toFixed(2)}  ${p.reason} (${p.ref})`));
    for (const w of e.warnings) li.append(el('div', 'warning', `⚠ ${w}`));

    const accept = el('label', 'accept');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !e.rejected;
    box.addEventListener('change', () => {
      scoreboard.setRejected(e.id, !box.checked);
      renderEvents();
      renderScores();
    });
    accept.append(box, document.createTextNode('Judge accepts this call'));
    li.append(accept);

    ui.events.append(li);
  }
}

function describe(m) {
  const parts = [];
  if (m.peakSplitDeg != null) parts.push(`split ${m.peakSplitDeg}°`);
  if (m.thighDeg != null) parts.push(`thigh ${m.thighDeg}°`);
  if (m.splitDevDeg != null) parts.push(m.splitDevDeg ? `split ${m.splitDevDeg}° short of 180°` : 'split 180°');
  if (m.footDevDeg != null) parts.push(m.footDevDeg ? `foot ${m.footDevDeg}° below head height` : 'whole foot above head');
  if (m.thighDevDeg != null) parts.push(m.thighDevDeg ? `thigh ${m.thighDevDeg}° below horizontal` : 'thigh horizontal');
  if (m.trunkDevDeg != null) parts.push(`trunk ${m.trunkDevDeg}° from vertical`);
  if (m.rotations != null) parts.push(`${m.rotations} turn${m.rotations > 1 ? 's' : ''}`);
  if (m.holdMs != null && m.rotations == null) parts.push(`held ${(m.holdMs / 1000).toFixed(1)} s`);
  if (m.relevePct != null) parts.push(`relevé ${m.relevePct}%`);
  if (m.flightMs != null) parts.push(`flight ${m.flightMs} ms`);
  return parts.join(', ');
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function exportAudit() {
  const audit = scoreboard.toAudit(judgeInputs(), {
    app: 'Rhymnast judging assistant',
    ruleSource: RULE_SOURCE,
    source: state.source === 'file' ? `file: ${state.fileName}` : state.source,
    poseModel: `MediaPipe Pose Landmarker (${state.trackerVariant}, ${state.tracker?.delegate})`,
  });
  const blob = new Blob([JSON.stringify(audit, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rhymnast-audit-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- Events ----------

ui.btnCamera.addEventListener('click', startCamera);
ui.fileInput.addEventListener('change', () => {
  const file = ui.fileInput.files?.[0];
  if (file) loadFile(file);
  ui.fileInput.value = '';
});
ui.btnJudge.addEventListener('click', () => setJudging(!state.judging));
ui.btnReset.addEventListener('click', newRoutine);
ui.btnExport.addEventListener('click', exportAudit);
ui.modelSelect.addEventListener('change', async () => {
  if (state.source) await ensureTracker();
});
for (const input of [ui.inArtistry, ui.inExtraD, ui.inExtraE, ui.inPenalties]) {
  input.addEventListener('input', renderScores);
}
ui.video.addEventListener('seeked', resetTracking); // jumping in a clip breaks motion tracking
ui.video.addEventListener('ended', () => setJudging(false));

renderScores();
requestAnimationFrame(tick);
