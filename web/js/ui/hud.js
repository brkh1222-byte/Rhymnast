// What people see ON the video:
//   - the live message: which balance, 4 dots that fill in 1 second, and one plain sentence
//   - a card after every judged move ("Attitude · 0.30 points lost · Lift the knee…")

import { describeMove, liveMessage } from './plain.js';
import { el } from './format.js';

/**
 * @param live { root, pose, dots, text } elements
 * @param balanceLive balance.live from BalanceDetector, or null when there is no video
 * @param message optional text that replaces everything (e.g. the teaching countdown)
 */
export function renderLive(live, balanceLive, message = null) {
  if (!balanceLive && !message) {
    live.root.hidden = true;
    return;
  }
  live.root.hidden = false;
  if (message) {
    live.root.className = 'live';
    live.pose.textContent = 'Teaching';
    setDots(live.dots, 0);
    live.text.textContent = message;
    return;
  }
  const m = liveMessage(balanceLive);
  live.root.className = `live ${m.tone}`;
  live.pose.textContent = m.pose ?? 'Watching';
  live.dots.hidden = !m.pose;
  setDots(live.dots, m.dots);
  live.text.textContent = m.text;
}

function setDots(dots, n) {
  [...dots.children].forEach((d, i) => d.classList.toggle('on', i < n));
}

/** Slides a card onto the video for a judged move; it disappears after a few seconds. */
export function showMoveCard(container, event) {
  const m = describeMove(event);
  const card = el('div', `move-card ${m.tone}`);
  card.append(el('b', null, m.name), el('span', 'result', m.result));
  const first = m.reasons[0];
  card.append(el('div', 'tip', first?.tip ?? 'Well done!'));
  container.prepend(card);
  while (container.children.length > 2) container.lastChild.remove();
  setTimeout(() => card.classList.add('leaving'), 4000);
  setTimeout(() => card.remove(), 4600);
}
