// Split leap detector (CoP #8 jumps/leaps, #9 item 21).
//
// State machine:  GROUNDED --(hips up AND feet off floor)--> AIRBORNE --(feet back down)--> GROUNDED
//
// While airborne we measure the split angle every frame. The Code of Points
// wants 180° "at the highest point of the leap", so we take the best split among
// frames near the top of the flight (hips at >= 70% of their maximum rise).

import {
  LM, LEG_POINTS, legLengthRatios, minVisibility, mid, splitAngle, torsoLength,
} from '../geometry.js';
import { ELEMENTS, judgedBand } from '../rules.js';

const RULE = ELEMENTS.SPLIT_LEAP;

// Tunable thresholds, in torso lengths (so they work at any distance from the camera).
export const SPLIT_LEAP_SETTINGS = {
  takeoffHipRise: 0.15, // hips must rise this much above standing height...
  takeoffFootLift: 0.1, // ...and the lowest toe must leave the floor by this much
  landingFootLift: 0.05, // flight ends when the lowest toe is this close to the floor
  minFlightMs: 100,
  maxFlightMs: 1500,
  peakWindow: 0.7, // frames with hip rise >= 70% of max count as "highest point"
  minSplitToCount: 130, // below this the jump is some other shape, not a split leap attempt
  minVisibility: 0.5,
  // Legs must look full length for the 2D angle to be trusted (see legLengthRatios):
  minLegToTorso: 1.5, // each leg at least 1.5 torso lengths in the image
  minLegBalance: 0.8, // shorter leg at least 80% of the longer one
  baselineAlpha: 0.05, // how fast standing hip height / floor level adapt
};

export class SplitLeapDetector {
  /** @param onEvent called with a judged element event */
  constructor(onEvent, settings = SPLIT_LEAP_SETTINGS) {
    this.onEvent = onEvent;
    this.s = settings;
    this.reset();
  }

  reset() {
    this.hipBaseY = null; // standing hip height (pixels)
    this.floorY = null; // floor level = lowest toe while standing (pixels)
    this.flight = null; // data for the current jump, null when grounded
    this.live = { airborne: false, splitDeg: null };
  }

  /** @param frame { t: ms, lm: landmarks in pixels } */
  update({ t, lm }) {
    const legsVisible = Boolean(lm) && minVisibility(lm, LEG_POINTS) >= this.s.minVisibility;
    const torso = lm ? torsoLength(lm) : 0;
    if (!legsVisible || torso < 1) {
      // Lost the gymnast mid-flight for too long: drop the jump.
      if (this.flight && t - this.flight.lastSeen > 500) this.flight = null;
      this.live = { airborne: Boolean(this.flight), splitDeg: null };
      return;
    }

    const hipY = mid(lm[LM.L_HIP], lm[LM.R_HIP]).y;
    const lowestToeY = Math.max(footY(lm, 'L'), footY(lm, 'R')); // y grows downward
    const split = splitAngle(lm);

    if (this.hipBaseY === null) {
      this.hipBaseY = hipY;
      this.floorY = lowestToeY;
    }
    const hipRise = (this.hipBaseY - hipY) / torso;
    const footLift = (this.floorY - lowestToeY) / torso;

    if (!this.flight) {
      if (hipRise > this.s.takeoffHipRise && footLift > this.s.takeoffFootLift) {
        this.flight = { tStart: t, lastSeen: t, maxRise: 0, frames: [] };
      } else {
        // Standing, walking or preparing: slowly track hip height and floor level.
        const a = this.s.baselineAlpha;
        this.hipBaseY += a * (hipY - this.hipBaseY);
        this.floorY += a * (lowestToeY - this.floorY);
      }
    }

    if (this.flight) {
      const f = this.flight;
      f.lastSeen = t;
      f.maxRise = Math.max(f.maxRise, hipRise);
      f.frames.push({
        t, hipRise, split,
        visibility: minVisibility(lm, LEG_POINTS),
        legRatios: legLengthRatios(lm),
      });
      if (footLift < this.s.landingFootLift) {
        this.finishFlight(t);
      }
    }

    this.live = { airborne: Boolean(this.flight), splitDeg: split };
  }

  finishFlight(tLand) {
    const f = this.flight;
    this.flight = null;
    const flightMs = tLand - f.tStart;
    if (flightMs < this.s.minFlightMs || flightMs > this.s.maxFlightMs) return;

    // "At the highest point of the leap": only frames near the top of the flight.
    const nearPeak = f.frames.filter((fr) => fr.hipRise >= this.s.peakWindow * f.maxRise);
    if (nearPeak.length === 0) return;
    const best = nearPeak.reduce((a, b) => (b.split > a.split ? b : a));
    if (best.split < this.s.minSplitToCount) return; // not a split leap

    this.onEvent(judgeSplitLeap({
      tStart: f.tStart,
      tPeak: best.t,
      tEnd: tLand,
      peakSplitDeg: best.split,
      flightMs,
      visibility: best.visibility,
      sideOn: legsFullLength(best.legRatios, this.s),
    }));
  }
}

/** Turns a measured leap into a judged event using the Code of Points. */
export function judgeSplitLeap(m) {
  const deviation = judgedBand(RULE.requiredSplitDeg - m.peakSplitDeg);
  const penalties = deviation.penalty > 0
    ? [{
      reason: `Split shape: ${deviation.band} deviation (${deviation.measuredDeg}° short of 180°, ${deviation.deg}° after the 3° camera margin)`,
      value: deviation.penalty,
      ref: deviation.ref,
    }]
    : [];
  const warnings = [];
  if (!m.sideOn) warnings.push('A leg is foreshortened (camera not side-on to the split): angle unreliable');
  if (m.visibility < 0.7) warnings.push('Legs partly hidden: low confidence');

  return {
    element: RULE.name,
    code: RULE.code,
    t: m.tPeak,
    tStart: m.tStart,
    tEnd: m.tEnd,
    dbValid: deviation.dbValid,
    dbValue: deviation.dbValid ? RULE.value : 0,
    penalties,
    measurements: {
      peakSplitDeg: Math.round(m.peakSplitDeg),
      deviationDeg: deviation.measuredDeg,
      band: deviation.band,
      flightMs: Math.round(m.flightMs),
    },
    confidence: round1(m.visibility),
    warnings,
    ruleRef: RULE.ref,
  };
}

/** True when both legs look full length, i.e. the split is side-on to the camera. */
export function legsFullLength([a, b], s = SPLIT_LEAP_SETTINGS) {
  const shorter = Math.min(a, b);
  const longer = Math.max(a, b);
  return shorter >= s.minLegToTorso && shorter >= s.minLegBalance * longer;
}

/** y of the toes, falling back to the ankle if the toes are not visible. */
function footY(lm, side) {
  const toe = lm[side === 'L' ? LM.L_FOOT : LM.R_FOOT];
  const ankle = lm[side === 'L' ? LM.L_ANKLE : LM.R_ANKLE];
  return toe && (toe.visibility ?? 0) >= 0.3 ? toe.y : ankle.y;
}

function round1(x) {
  return Math.round(x * 10) / 10;
}
