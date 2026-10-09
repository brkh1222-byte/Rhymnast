// Shared by the developer tools (tools/image-check.html, tools/validate.html):
// runs the pose model on one photo and applies the same measurements as the live app.

import { createPoseTracker } from '../pose.js';
import { LEG_POINTS, legLengthRatios, minVisibility, splitAngle } from '../geometry.js';
import { judgeSplitLeap, legsFullLength } from '../elements/splitLeap.js';
import { measurePasse } from '../elements/passe.js';
import { measureBalance, photoDeduction, shapeKey } from '../elements/balances.js';
import { legsUsable } from '../elements/balanceFrame.js';

let trackerPromise = null;

/** One pose model in IMAGE mode, loaded once and reused. */
export function getImageTracker() {
  trackerPromise ??= createPoseTracker('full', 'IMAGE');
  return trackerPromise;
}

/**
 * Finds the gymnast in a decoded <img> and returns landmarks in pixels, or null if nobody is found.
 */
export async function landmarksFromImage(img) {
  const tracker = await getImageTracker();
  const raw = tracker.detectImage(img);
  if (!raw) return null;
  return raw.map((p) => ({ x: p.x * img.naturalWidth, y: p.y * img.naturalHeight, visibility: p.visibility ?? 0 }));
}

/**
 * Everything the rules measure on one set of landmarks.
 * @param library pose library for recognition; undefined = the app's active library, null = rules only
 */
export function analyzeLandmarks(lm, library) {
  const visibility = minVisibility(lm, LEG_POINTS);
  const split = splitAngle(lm);
  const legRatios = legLengthRatios(lm);
  const leap = judgeSplitLeap({
    tStart: 0, tPeak: 0, tEnd: 0, flightMs: 0, peakSplitDeg: split, visibility,
    sideOn: legsFullLength(legRatios),
  });
  // Same rule as the live detector: legs we can't measure are not judged.
  const legsVisible = legsUsable(lm).ok;
  const balance = legsVisible ? measureBalance(lm, undefined, library) : { shape: null, deviations: [] };
  return {
    visibility,
    legsVisible,
    split,
    legRatios,
    leap,
    passe: measurePasse(lm),
    balance,
    shape: shapeKey(balance.shape),
    deduction: photoDeduction(balance),
  };
}
