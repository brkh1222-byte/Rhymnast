// What the judge sees ON the video while judging:
//   - the live panel: recognized pose, match, hold timer, live measurement and deduction, or a hint
//   - a card after every judged move: "Attitude balance · E −0.30"

import { judgedBand, round2 } from '../rules.js';
import { el, minus } from './format.js';

/**
 * @param hud { root, pose, match, bar, barLabel, measure, deduction, hint } elements
 * @param live balance.live from BalanceDetector, or null when no video
 * @param extra { message } overrides everything (e.g. teaching countdown)
 */
export function renderHud(hud, live, extra = {}) {
  if (!live && !extra.message) {
    hud.root.hidden = true;
    return;
  }
  hud.root.hidden = false;
  if (extra.message) {
    showOnly(hud, 'hint');
    hud.hint.textContent = extra.message;
    return;
  }
  if (!live.shape) {
    showOnly(hud, 'hint');
    hud.hint.textContent = live.hint ?? 'Ready: hold front split, back split or attitude';
    return;
  }

  showOnly(hud, 'pose');
  hud.pose.textContent = live.label;
  hud.match.textContent = live.recognizer === 'library' && live.confidence != null
    ? `${Math.round(live.confidence * 100)}% match`
    : 'rule match';

  const held = Math.min(1, live.holdMs / 1000);
  hud.bar.style.setProperty('--held', held);
  hud.barLabel.textContent = held >= 1 ? 'held 1 s ✓' : `hold ${(live.holdMs / 1000).toFixed(1)} / 1.0 s`;

  hud.measure.textContent = live.deviations
    .map((d) => {
      const band = judgedBand(d.deg);
      return band.penalty === 0 ? `${d.label.split(' ')[0]} ✓` : `${d.label} ${band.measuredDeg}°`;
    })
    .join(' · ');
  const now = round2(live.deviations.reduce((sum, d) => sum + judgedBand(d.deg).penalty, 0));
  hud.deduction.textContent = now === 0 ? 'E −0.00 so far' : `E ${minus(now)} so far`;
  hud.deduction.className = `hud-deduction ${now === 0 ? 'good' : now >= 0.5 ? 'bad' : 'warn'}`;
}

function showOnly(hud, which) {
  const posing = which === 'pose';
  for (const node of [hud.poseRow, hud.barRow, hud.measure, hud.deduction]) node.hidden = !posing;
  hud.hint.hidden = posing;
}

/** Slides a card onto the video for a judged move; it disappears after a few seconds. */
export function showMoveCard(container, event) {
  const total = round2(event.penalties.reduce((sum, p) => sum + p.value, 0));
  const card = el('div', `move-card ${total === 0 ? 'clean' : total >= 0.5 ? 'heavy' : ''}`);
  card.append(
    el('div', 'move-title', event.element),
    el('div', 'move-score', total === 0 ? 'E −0.00 · clean' : `E ${minus(total)}`),
    el('div', 'move-meta', `D ${event.dbValue.toFixed(2)}${event.dbValid ? '' : ' · not valid'}`),
  );
  for (const p of event.penalties.slice(0, 2)) card.append(el('div', 'move-reason', `${minus(p.value)} ${p.reason}`));
  container.prepend(card);
  while (container.children.length > 3) container.lastChild.remove();
  setTimeout(() => card.classList.add('leaving'), 4000);
  setTimeout(() => card.remove(), 4600);
}
