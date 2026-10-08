// Synthetic skeletons with exactly known angles, for testing the rules without video.
// Pixel coordinates, y grows downward. Torso = 100 px, thigh = shin = 90 px
// (real proportions: a leg is about 1.8-2 torso lengths).

import { LM } from '../js/geometry.js';

const CX = 300;
const HIP_Y = 300;
const TORSO = 100;
const THIGH = 90;
const SHIN = 90;
const FLOOR_Y = HIP_Y + THIGH + SHIN + 8; // toes touch the floor here when standing

const p = (x, y, visibility = 1) => ({ x, y, visibility });
const rad = (deg) => (deg * Math.PI) / 180;

/** Empty 33-landmark skeleton with the upper body placed. */
function body({ width, rise }) {
  const lm = Array.from({ length: 33 }, () => p(CX, HIP_Y - rise - TORSO * 1.3));
  const half = (width * TORSO) / 2;
  const hipY = HIP_Y - rise;
  lm[LM.L_SHOULDER] = p(CX - half, hipY - TORSO);
  lm[LM.R_SHOULDER] = p(CX + half, hipY - TORSO);
  lm[LM.L_HIP] = p(CX - half, hipY);
  lm[LM.R_HIP] = p(CX + half, hipY);
  return lm;
}

/** Straight leg from `from` at `deg` from straight down (positive = forward, +x). */
function straightLeg(lm, sideKey, from, deg) {
  const dx = Math.sin(rad(deg));
  const dy = Math.cos(rad(deg));
  lm[LM[`${sideKey}_KNEE`]] = p(from.x + THIGH * dx, from.y + THIGH * dy);
  const ankle = p(from.x + (THIGH + SHIN) * dx, from.y + (THIGH + SHIN) * dy);
  lm[LM[`${sideKey}_ANKLE`]] = ankle;
  lm[LM[`${sideKey}_FOOT`]] = p(ankle.x + 10 * dx, ankle.y + 10 * dy);
  lm[LM[`${sideKey}_HEEL`]] = p(ankle.x - 3 * dx, ankle.y - 3 * dy);
}

/** Standing on flat feet. width = body width ratio (0.15 side-on, 0.7 facing camera). */
export function standing({ width = 0.15 } = {}) {
  const lm = body({ width, rise: 0 });
  for (const s of ['L', 'R']) {
    const hip = lm[LM[`${s}_HIP`]];
    lm[LM[`${s}_KNEE`]] = p(hip.x, HIP_Y + THIGH);
    lm[LM[`${s}_ANKLE`]] = p(hip.x, HIP_Y + THIGH + SHIN);
    lm[LM[`${s}_FOOT`]] = p(hip.x + 10, FLOOR_Y);
    lm[LM[`${s}_HEEL`]] = p(hip.x - 4, FLOOR_Y);
  }
  return lm;
}

/** In the air, legs straight and `splitDeg` apart, symmetric around the trunk. */
export function splitPose(splitDeg, { rise = 40, width = 0.15 } = {}) {
  const lm = body({ width: 0, rise }); // legs from one hip point -> exact split angle
  straightLeg(lm, 'L', lm[LM.L_HIP], splitDeg / 2);
  straightLeg(lm, 'R', lm[LM.R_HIP], -splitDeg / 2);
  // Now set the real body width (shoulders/hips), keeping the hip midpoint.
  const half = (width * TORSO) / 2;
  for (const [key, dx] of [['L_SHOULDER', -half], ['R_SHOULDER', half], ['L_HIP', -half], ['R_HIP', half]]) {
    lm[LM[key]] = p(lm[LM[key]].x + dx, lm[LM[key]].y);
  }
  return lm;
}

/**
 * Passé on the right (support) leg; the left thigh raised `thighDeg` from straight down.
 * releve: heel lifted. width: body width ratio (changes as the gymnast turns).
 */
export function passePose({ thighDeg = 90, releve = true, width = 0.15 } = {}) {
  const lm = standing({ width });
  // Support leg (right): straight, on relevé the heel lifts above the toes.
  const rHip = lm[LM.R_HIP];
  if (releve) {
    lm[LM.R_ANKLE] = p(rHip.x, HIP_Y + THIGH + SHIN - 6);
    lm[LM.R_HEEL] = p(rHip.x - 4, FLOOR_Y - 20);
  }
  // Free leg (left): thigh at thighDeg, foot at the support knee.
  const lHip = lm[LM.L_HIP];
  const knee = p(lHip.x + THIGH * Math.sin(rad(thighDeg)), HIP_Y + THIGH * Math.cos(rad(thighDeg)));
  lm[LM.L_KNEE] = knee;
  const supportKnee = lm[LM.R_KNEE];
  lm[LM.L_ANKLE] = p(supportKnee.x + 5, supportKnee.y + 5);
  lm[LM.L_FOOT] = p(supportKnee.x + 2, supportKnee.y + 12);
  lm[LM.L_HEEL] = p(supportKnee.x + 8, supportKnee.y + 2);
  return lm;
}

/** Moves one ankle (and its foot) toward the hip: a leg pointing at the camera. */
export function foreshortenLeg(lm, sideKey, factor) {
  const hips = { x: (lm[LM.L_HIP].x + lm[LM.R_HIP].x) / 2, y: (lm[LM.L_HIP].y + lm[LM.R_HIP].y) / 2 };
  const out = lm.map((pt) => ({ ...pt }));
  for (const part of ['KNEE', 'ANKLE', 'FOOT', 'HEEL']) {
    const pt = out[LM[`${sideKey}_${part}`]];
    pt.x = hips.x + (pt.x - hips.x) * factor;
    pt.y = hips.y + (pt.y - hips.y) * factor;
  }
  return out;
}

/** Turns a list of skeletons into timed frames at ~30 FPS. */
export function frames(skeletons, { startMs = 0, stepMs = 33 } = {}) {
  return skeletons.map((lm, i) => ({ t: startMs + i * stepMs, lm }));
}

export const repeat = (n, make) => Array.from({ length: n }, (_, i) => make(i));
