// App wiring: video -> pose model -> smoothing -> detectors -> scoreboard -> simple UI.
//
// One main button walks people through the app:
//   Turn on camera  ->  Start  ->  Finish  ->  Try again
// Two tabs show the same judging for two audiences:
//   Practice (gymnast / coach): moves, points lost, one tip each
//   Judge: final score, artistry entry, agree / disagree with each call, full report

import { createPoseTracker } from './pose.js';
import { LandmarkSmoother } from './oneEuro.js';
import { legLengthRatios } from './geometry.js';
import { SplitLeapDetector, legsFullLength } from './elements/splitLeap.js';
import { PasseDetector } from './elements/passe.js';
import { BalanceDetector, setPoseLibrary } from './elements/balances.js';
import { Scoreboard } from './scoring.js';
import { RULE_SOURCE } from './rules.js';
import { drawSkeleton } from './draw.js';
import { buildReport } from './report.js';
import { currentLibrary } from './ui/libraryStore.js';
import { renderLive, showMoveCard } from './ui/hud.js';
import { renderReport } from './ui/reportView.js';
import { TeachPanel } from './ui/teachPanel.js';
import { describeMove } from './ui/plain.js';
import { el } from './ui/format.js';
import { landmarksFromImage } from './tools/analyzeImage.js';

const $ = (id) => document.getElementById(id);
const ui = {
  video: $('video'), canvas: $('overlay'), stage: $('stage'), stageMsg: $('stage-msg'), badge: $('judging-badge'),
  main: $('btn-main'), reset: $('btn-reset'), fileInput: $('file-input'), steps: $('steps'),
  tabPractice: $('tab-practice'), tabJudge: $('tab-judge'), panelPractice: $('panel-practice'), panelJudge: $('panel-judge'),
  practiceTotal: $('practice-total'), practiceMoves: $('practice-moves'), judgeMoves: $('judge-moves'),
  final: $('final'), scoreD: $('score-d'), scoreE: $('score-e'), scoreA: $('score-a'), scoreEDetail: $('score-e-detail'),
  inArtistry: $('in-artistry'), inExtraD: $('in-extra-d'), inExtraE: $('in-extra-e'), inPenalties: $('in-penalties'),
  moveCards: $('move-cards'), report: $('report'), reportTitle: $('report-title'), reportBody: $('report-body'),
  btnReport: $('btn-report'), btnDetails: $('btn-details'), btnPrint: $('btn-print'), btnReportClose: $('btn-report-close'),
  settings: $('settings'), backdrop: $('settings-backdrop'), btnSettings: $('btn-settings'), btnSettingsClose: $('btn-settings-close'),
  modelSelect: $('model-select'), focus: $('focus-mode'), btnExport: $('btn-export'),
  fps: $('fps'), view: $('view'), split: $('split'), shape: $('shape'), releve: $('releve'), state: $('state'),
};
const live = { root: $('live'), pose: $('live-pose'), dots: $('live-dots'), text: $('live-text') };
const ctx = ui.canvas.getContext('2d');

const state = {
  tracker: null,
  trackerVariant: null,
  source: null, // 'camera' | 'file'
  judging: false,
  finished: false,
  tab: loadTab(),
  details: false,
  routineStartMs: 0,
  stoppedAt: null,
  lastVideoTime: -1,
  fpsFrames: 0,
  fpsSince: performance.now(),
  fileName: null,
};

// Recognize poses with the library: shipped examples + the ones your team taught.
setPoseLibrary(currentLibrary());

const smoother = new LandmarkSmoother();
const scoreboard = new Scoreboard();
const onEvent = (event) => {
  if (!state.judging) return;
  scoreboard.add({ ...event, routineMs: Math.max(0, event.t - state.routineStartMs) });
  showMoveCard(ui.moveCards, event);
  renderSide();
};
// Only the three balances count unless the setting says otherwise; leap and passé still run
// (the leap detector also tells the balance detector when she is in the air).
const onOtherEvent = (event) => {
  if (!ui.focus.checked) onEvent(event);
};
const leap = new SplitLeapDetector(onOtherEvent);
const passe = new PasseDetector(onOtherEvent);
const balance = new BalanceDetector(onEvent);

const teachPanel = new TeachPanel({
  pose: $('teach-pose'), record: $('btn-record'), photos: $('teach-photos'), counts: $('teach-counts'),
  exportBtn: $('btn-teach-export'), importInput: $('teach-import'), reset: $('btn-teach-reset'), status: $('teach-status'),
}, {
  canRecord: () => state.source !== null && !state.judging,
  landmarksFromPhoto: async (file) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    const lm = await landmarksFromImage(img);
    URL.revokeObjectURL(img.src);
    return lm;
  },
  download: (name, text) => download(name, text, 'application/json'),
});

// ---------- Model ----------

async function ensureTracker() {
  const variant = ui.modelSelect.value;
  if (state.tracker && state.trackerVariant === variant) return;
  setMessage('Getting the camera ready…', variant === 'heavy' ? 'The first time this takes about half a minute.' : '');
  state.tracker?.close();
  state.tracker = await createPoseTracker(variant);
  state.trackerVariant = variant;
  setMessage(null);
}

// ---------- Sources ----------

async function startCamera() {
  ui.main.disabled = true; // the model can take a while to load the first time
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
    setMessage(err.name === 'NotAllowedError' ? 'The camera is blocked' : 'The camera could not start',
      err.name === 'NotAllowedError' ? 'Allow camera access in your browser, then press the button again.' : err.message);
  }
  ui.main.disabled = false;
  renderControls();
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
    setMessage('The video could not be opened', err.message);
  }
  renderControls();
}

function stopSource() {
  const stream = ui.video.srcObject;
  if (stream) stream.getTracks().forEach((track) => track.stop());
  if (ui.video.src) URL.revokeObjectURL(ui.video.src);
  ui.video.removeAttribute('src');
  ui.video.srcObject = null;
  state.source = null;
  setJudging(false, { quiet: true });
}

function onSourceReady() {
  fitOverlayToVideo();
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
    lm = smoother.smooth(raw.map((p) => ({ x: p.x * w, y: p.y * h, visibility: p.visibility ?? 0 })), t / 1000);
  } else {
    smoother.reset(); // don't drag old positions into the next person seen
  }
  // Detectors also get frames with nobody visible (lm = null), so a shape that ends by
  // leaving the frame is still closed and judged.
  leap.update({ t, lm });
  passe.update({ t, lm, airborne: leap.live.airborne });
  balance.update({ t, lm, airborne: leap.live.airborne });

  drawSkeleton(ctx, lm, legColor());
  renderTechnical(lm);
  const teachMessage = teachPanel.capture(lm, leap.live.airborne);
  renderLive(live, balance.live, teachMessage);
  countFps();
}

function legColor() {
  if (leap.live.airborne) return '#f08c9c';
  if (passe.live.inShape || balance.live.shape) return '#4cc38a'; // green: holding a balance
  return '#7aa7ff';
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

// ---------- The main button ----------

function onMainButton() {
  if (!state.source) startCamera();
  else if (!state.judging && state.finished) { newRoutine(); setJudging(true); }
  else setJudging(!state.judging);
}

function setJudging(on, { quiet = false } = {}) {
  const stopping = !on && state.judging;
  if (stopping) {
    passe.flush(); // judge a balance still being held
    balance.flush();
    state.stoppedAt = currentTimeMs();
  }
  state.judging = on;
  if (on) {
    state.finished = false;
    ui.report.hidden = true;
    if (state.source === 'camera' && scoreboard.events.length === 0) state.routineStartMs = performance.now();
  }
  ui.badge.hidden = !on;
  if (stopping && !quiet) {
    state.finished = true;
    openResults();
  }
  renderControls();
}

function newRoutine() {
  scoreboard.reset();
  state.finished = false;
  state.routineStartMs = state.source === 'camera' ? performance.now() : 0;
  ui.report.hidden = true;
  ui.moveCards.replaceChildren();
  resetTracking();
  renderSide();
  renderControls();
}

function resetTracking() {
  smoother.reset();
  leap.reset();
  passe.reset();
  balance.reset();
  state.lastVideoTime = -1;
}

/** Main button label, "Start over", and which step of the guide is current. */
function renderControls() {
  const label = !state.source ? 'Turn on camera' : state.judging ? 'Finish' : state.finished ? 'Try again' : 'Start';
  ui.main.textContent = label;
  ui.reset.hidden = !(state.source && scoreboard.events.length && !state.judging);
  const step = !state.source ? 1 : !state.judging && !state.finished ? 2 : 3;
  [...ui.steps.children].forEach((li, i) => {
    li.classList.toggle('current', i + 1 === step);
    li.classList.toggle('done', i + 1 < step);
  });
}

// ---------- Tabs, side panels, results ----------

function setTab(tab) {
  state.tab = tab;
  try { localStorage.setItem('rhymnast.tab', tab); } catch { /* storage blocked: fine */ }
  ui.tabPractice.setAttribute('aria-selected', String(tab === 'practice'));
  ui.tabJudge.setAttribute('aria-selected', String(tab === 'judge'));
  ui.panelPractice.hidden = tab !== 'practice';
  ui.panelJudge.hidden = tab !== 'judge';
  if (!ui.report.hidden) openResults({ scroll: false });
}

function loadTab() {
  try { return localStorage.getItem('rhymnast.tab') === 'judge' ? 'judge' : 'practice'; } catch { return 'practice'; }
}

function judgeInputs() {
  return {
    artistry: ui.inArtistry.value,
    extraD: ui.inExtraD.value,
    extraE: ui.inExtraE.value,
    penalties: ui.inPenalties.value,
  };
}

function renderSide() {
  const r = scoreboard.compute(judgeInputs());
  const events = [...scoreboard.events].reverse();
  const counted = scoreboard.events.filter((e) => !e.rejected);

  // Practice
  ui.practiceTotal.textContent = counted.length === 0
    ? 'No moves yet.'
    : r.breakdown.autoE === 0 ? `No points lost so far · ${counted.length} move${counted.length === 1 ? '' : 's'}`
      : `Points lost so far: ${r.breakdown.autoE.toFixed(2)}`;
  ui.practiceMoves.replaceChildren(...(events.length
    ? events.map((e) => moveRow(e, r.status.get(e.id), false))
    : [el('li', 'empty', 'Press Start, then hold a balance for 1 second.')]));

  // Judge
  ui.final.textContent = r.final.toFixed(2);
  ui.scoreD.textContent = r.D.toFixed(2);
  ui.scoreE.textContent = r.E.toFixed(2);
  ui.scoreA.textContent = r.A.toFixed(2);
  ui.scoreEDetail.textContent = r.breakdown.autoE ? `from the app (−${r.breakdown.autoE.toFixed(2)})` : 'from the app';
  ui.judgeMoves.replaceChildren(...(events.length
    ? events.map((e) => moveRow(e, r.status.get(e.id), true))
    : [el('li', 'empty', 'Moves appear here as the gymnast performs.')]));
  return r;
}

/** One move in a side list. Judges also get Agree / Disagree. */
function moveRow(e, status, forJudge) {
  const d = describeMove(e, status);
  const li = el('li', `move ${e.rejected ? 'rejected' : d.tone}`);
  const head = el('div', 'move-head');
  head.append(el('b', null, d.name), el('span', `chip ${e.rejected ? 'muted' : d.tone}`, e.rejected ? 'Not counted' : d.result));
  li.append(head);
  const first = d.reasons[0];
  if (first) {
    const p = el('p', 'reason', first.text);
    if (first.tip) p.append(el('span', 'tip', first.tip));
    li.append(p);
    if (d.reasons.length > 1) li.append(el('p', 'small', `+ ${d.reasons.length - 1} more in the results`));
  }
  for (const n of d.notes.slice(0, 1)) li.append(el('p', 'note-line', n));
  if (forJudge) {
    const agree = el('div', 'agree');
    const yes = el('button', 'ghost', 'Agree');
    const no = el('button', 'ghost', 'Disagree');
    yes.setAttribute('aria-pressed', String(!e.rejected));
    no.setAttribute('aria-pressed', String(e.rejected));
    yes.addEventListener('click', () => { scoreboard.setRejected(e.id, false); renderSide(); refreshResults(); });
    no.addEventListener('click', () => { scoreboard.setRejected(e.id, true); renderSide(); refreshResults(); });
    agree.append(yes, no);
    li.append(agree);
  }
  return li;
}

function openResults({ scroll = true } = {}) {
  const end = state.stoppedAt ?? currentTimeMs();
  const report = buildReport(scoreboard, judgeInputs(), { durationMs: Math.max(0, end - state.routineStartMs) });
  ui.reportTitle.textContent = state.tab === 'judge' ? 'Score report' : 'Your results';
  renderReport(ui.reportBody, report, { mode: state.tab, details: state.details });
  ui.report.hidden = false;
  if (scroll) ui.report.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function refreshResults() {
  if (!ui.report.hidden) openResults({ scroll: false });
}

// ---------- Settings drawer and technical details ----------

function openSettings(open) {
  ui.settings.hidden = !open;
  ui.backdrop.hidden = !open;
  if (open) ui.btnSettingsClose.focus();
}

function setMessage(title, detail = '') {
  ui.stageMsg.hidden = !title;
  if (!title) return;
  ui.stageMsg.replaceChildren(el('b', null, title), el('span', null, detail));
}

function renderTechnical(lm) {
  if (ui.settings.hidden) return; // only shown in Settings
  if (!lm) {
    for (const node of [ui.view, ui.split, ui.shape, ui.releve]) node.textContent = '–';
    ui.state.textContent = 'nobody in view';
    return;
  }
  const fullLegs = legsFullLength(legLengthRatios(lm));
  ui.view.textContent = fullLegs ? 'yes' : 'no';
  ui.view.className = fullLegs ? 'good' : 'warn';
  ui.split.textContent = leap.live.splitDeg == null ? '–' : `${Math.round(leap.live.splitDeg)}°`;
  ui.shape.textContent = balance.live.label ?? (passe.live.inShape ? 'passé' : '–');
  ui.releve.textContent = passe.live.releve == null ? '?' : passe.live.releve ? 'yes' : 'no';
  ui.state.textContent = leap.live.airborne ? 'in the air' : balance.live.shape || passe.live.inShape ? 'balance' : 'on the floor';
}

function exportAudit() {
  const audit = scoreboard.toAudit(judgeInputs(), {
    app: 'Rhymnast',
    ruleSource: RULE_SOURCE,
    source: state.source === 'file' ? `file: ${state.fileName}` : state.source,
    poseModel: `MediaPipe Pose Landmarker (${state.trackerVariant}, ${state.tracker?.delegate})`,
  });
  download(`rhymnast-record-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, JSON.stringify(audit, null, 2), 'application/json');
}

function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- Events ----------

ui.main.addEventListener('click', onMainButton);
ui.reset.addEventListener('click', newRoutine);
ui.fileInput.addEventListener('change', () => {
  const file = ui.fileInput.files?.[0];
  if (file) loadFile(file);
  ui.fileInput.value = '';
});
ui.tabPractice.addEventListener('click', () => setTab('practice'));
ui.tabJudge.addEventListener('click', () => setTab('judge'));
ui.btnReport.addEventListener('click', () => openResults());
ui.btnDetails.addEventListener('click', () => {
  state.details = !state.details;
  ui.btnDetails.setAttribute('aria-pressed', String(state.details));
  ui.btnDetails.textContent = state.details ? 'Hide rulebook details' : 'Show rulebook details';
  refreshResults();
});
ui.btnPrint.addEventListener('click', () => window.print());
ui.btnReportClose.addEventListener('click', () => { ui.report.hidden = true; });
ui.btnSettings.addEventListener('click', () => openSettings(true));
ui.btnSettingsClose.addEventListener('click', () => openSettings(false));
ui.backdrop.addEventListener('click', () => openSettings(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !ui.settings.hidden) openSettings(false); });
ui.btnExport.addEventListener('click', exportAudit);
ui.modelSelect.addEventListener('change', async () => {
  if (state.source) await ensureTracker();
});
for (const input of [ui.inArtistry, ui.inExtraD, ui.inExtraE, ui.inPenalties]) {
  input.addEventListener('input', () => { renderSide(); refreshResults(); });
}
ui.video.addEventListener('seeked', resetTracking); // jumping in a clip breaks motion tracking
ui.video.addEventListener('ended', () => setJudging(false));

setTab(state.tab);
renderSide();
renderControls();
requestAnimationFrame(tick);
