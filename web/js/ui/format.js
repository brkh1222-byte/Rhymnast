// Small text helpers shared by the element list, move cards and the report.

/** Human-readable measurements of an element event. */
export function describeMeasurements(m) {
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

/** 0:04.3 */
export function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
}

/** −0.30, or −0.00 */
export function minus(value) {
  return `−${value.toFixed(2)}`;
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
