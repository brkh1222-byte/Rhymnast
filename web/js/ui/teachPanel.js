// "Teach poses" panel: show the app correct examples of each pose.
//   Record 3 s: a 3-2-1 countdown, then every camera frame for 3 seconds becomes an example.
//   Add photos: each photo becomes one example.
// The examples go into the pose library (ui/libraryStore.js), which the app uses at once.

import { balanceFrame, legsUsable } from '../elements/balanceFrame.js';
import { setPoseLibrary } from '../elements/balances.js';
import { poseSignature } from '../library/signature.js';
import { POSES, POSE_NAMES } from '../library/recognizer.js';
import { currentLibrary, exportTaught, importTaught, libraryCounts, resetTaught, teach } from './libraryStore.js';
import { el } from './format.js';

const COUNTDOWN_MS = 3000;
const RECORD_MS = 3000;

export class TeachPanel {
  /**
   * @param ui { pose, record, photos, counts, exportBtn, importInput, reset, status }
   * @param options { canRecord(): boolean, landmarksFromPhoto(file): Promise<lm|null>, download(name, text) }
   */
  constructor(ui, options) {
    this.ui = ui;
    this.options = options;
    this.recording = null; // { label, startAt, signatures }
    for (const p of POSES) ui.pose.append(new Option(POSE_NAMES[p], p));
    ui.record.addEventListener('click', () => this.startRecording());
    ui.photos.addEventListener('change', () => this.addPhotos([...ui.photos.files]));
    ui.exportBtn.addEventListener('click', () => options.download('rhymnast-poses.json', exportTaught()));
    ui.importInput.addEventListener('change', () => this.importFile(ui.importInput.files?.[0]));
    ui.reset.addEventListener('click', () => this.reset());
    this.renderCounts();
  }

  startRecording() {
    if (!this.options.canRecord()) {
      this.status('Start the camera first, and stop judging while you teach.');
      return;
    }
    this.recording = { label: this.ui.pose.value, startAt: performance.now() + COUNTDOWN_MS, signatures: [] };
    this.ui.record.disabled = true;
  }

  /**
   * Called by the app for every camera frame. Returns a message for the video overlay while
   * counting down or recording, otherwise null.
   */
  capture(lm, airborne) {
    const r = this.recording;
    if (!r) return null;
    const now = performance.now();
    const name = POSE_NAMES[r.label];
    if (now < r.startAt) return `Get into ${name}… ${Math.ceil((r.startAt - now) / 1000)}`;
    if (now < r.startAt + RECORD_MS) {
      if (lm && !airborne && legsUsable(lm).ok) {
        const f = balanceFrame(lm);
        if (f) r.signatures.push(poseSignature(f));
      }
      return `Recording ${name}: hold it · ${((r.startAt + RECORD_MS - now) / 1000).toFixed(1)} s · ${r.signatures.length} examples`;
    }
    this.finishRecording();
    return null;
  }

  finishRecording() {
    const r = this.recording;
    this.recording = null;
    this.ui.record.disabled = false;
    if (r.signatures.length === 0) {
      this.status('Nothing recorded: the whole body and both feet must be in view.');
      return;
    }
    const saved = teach(r.label, r.signatures);
    this.applied(`Added ${r.signatures.length} examples of ${POSE_NAMES[r.label]}.${saved ? '' : ' (Not saved in this browser: they last until you close the page.)'}`);
  }

  async addPhotos(files) {
    const label = this.ui.pose.value;
    const signatures = [];
    for (const [i, file] of files.entries()) {
      this.status(`Reading photo ${i + 1} of ${files.length}…`);
      const lm = await this.options.landmarksFromPhoto(file);
      const f = lm && legsUsable(lm).ok ? balanceFrame(lm) : null;
      if (f) signatures.push(poseSignature(f));
    }
    this.ui.photos.value = '';
    if (signatures.length) teach(label, signatures, 'taught-photo');
    this.applied(`Added ${signatures.length} of ${files.length} photos as ${POSE_NAMES[label]}`
      + (signatures.length < files.length ? ' (the rest had no clearly visible gymnast).' : '.'));
  }

  async importFile(file) {
    if (!file) return;
    try {
      const n = importTaught(await file.text());
      this.applied(`Imported ${n} examples.`);
    } catch (err) {
      this.status(`Could not import: ${err.message}`);
    }
    this.ui.importInput.value = '';
  }

  reset() {
    resetTaught();
    this.applied('Removed all taught examples. The default library is still used.');
  }

  /** Library changed: use it right away and update the counts. */
  applied(message) {
    setPoseLibrary(currentLibrary());
    this.renderCounts();
    this.status(message);
  }

  renderCounts() {
    const { default: base, taught } = libraryCounts();
    this.ui.counts.replaceChildren(...POSES.map((p) => {
      const li = el('li');
      li.append(el('span', null, POSE_NAMES[p]), el('b', null, String(base[p] + taught[p])));
      if (taught[p]) li.append(el('small', null, `${taught[p]} taught`));
      return li;
    }));
  }

  status(text) {
    this.ui.status.textContent = text;
  }
}
