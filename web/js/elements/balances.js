// Balance detector for three held shapes (CoP #10 balances, table #11):
//   - front split, with or without help             (row 3: "Split is required")
//   - back split without help, trunk upright         (row 10: "whole foot above the head is required")
//   - attitude                                       (row 12: thigh horizontal, body vertical)
// Out of scope and deliberately NOT scored, because in 2D they look like the shapes above:
// back split with help, front split with the trunk bent back, ring balances (checked on
// competition photos, see docs/validation.md).
//
// Every frame we decide which shape (if any) the gymnast is in. While the same shape is held we
// collect measurements; when she leaves it, the hold is judged once:
//   shape deviations per body segment (#2.5), held < 1 s (#10.2.2), flat foot (#10.3).
//
// "Help" = a hand holding the free leg. We call it help when a wrist or index finger is close
// to the free leg's shin or foot.
//
// Single 2D camera: film side-on. Split angles are only trusted when both legs look full
// length (same check as the split leap).

import {
  LM, LEG_POINTS, clamp, dist, distToSegment, facingSign, headTopY, isOnReleve, jointAngle,
  legElevation, legLengthRatios, legPoints, mid, minVisibility, splitAngle, thighElevation,
  toDeg, torsoLength, trunkTilt,
} from '../geometry.js';
import { BALANCES, BALANCE_RULES, deviationBand, round2 } from '../rules.js';
import { legsFullLength } from './splitLeap.js';

export const BALANCE_SETTINGS = {
  minVisibility: 0.5,
  minSplitToRecognize: 135, // below this it's not a split attempt at all
  straightKneeDeg: 150, // free knee at least this straight for split shapes
  attitudeKneeMin: 60, // attitude free knee is bent between these angles
  attitudeKneeMax: 140,
  minAttitudeThighDeg: 55, // thigh raised at least this much (90 = horizontal)
  minBackLegElevation: 120, // back split: leg at least 30° above horizontal (not an arabesque)
  maxUprightTrunkTilt: 60, // more lean = "trunk forward" balance (row 11), not detected
  maxAttitudeTrunkTilt: 45, // more lean = another element (e.g. penché), not an attitude
  helpDistance: 0.3, // hand within 0.3 torso lengths of the free shin/foot = help
  releveHeelLift: 0.12,
  releveMinShare: 0.6,
  gapToleranceMs: 150, // brief tracking glitches don't end the hold
  minBalanceMs: 300, // shorter = passing movement or a swing/kick, not a balance attempt
};

// How each recognized shape maps to the rulebook.
const SHAPES = {
  frontSplitHelp: { rule: BALANCES.FRONT_SPLIT, variant: BALANCES.FRONT_SPLIT.withHelp, label: 'front split' },
  frontSplit: { rule: BALANCES.FRONT_SPLIT, variant: BALANCES.FRONT_SPLIT.withoutHelp, label: 'front split' },
  backSplitFootAboveHead: { rule: BALANCES.BACK_SPLIT, variant: BALANCES.BACK_SPLIT.footAboveHead, label: 'back split' },
  attitude: { rule: BALANCES.ATTITUDE, variant: BALANCES.ATTITUDE.plain, label: 'attitude' },
};

export class BalanceDetector {
  constructor(onEvent, settings = BALANCE_SETTINGS) {
    this.onEvent = onEvent;
    this.s = settings;
    this.reset();
  }

  reset() {
    this.segment = null;
    this.live = { shape: null, label: null, mainDeg: null };
  }

  /** @param frame { t: ms, lm: landmarks in pixels or null (nobody visible), airborne } */
  update({ t, lm, airborne = false }) {
    const m = !lm || airborne || minVisibility(lm, LEG_POINTS) < this.s.minVisibility
      ? { shape: null }
      : measureBalance(lm, this.s);

    if (this.segment && m.shape && m.shape !== this.segment.shape) {
      this.endSegment(); // switched straight into another shape
    }
    if (m.shape) {
      if (!this.segment) {
        this.segment = { shape: m.shape, tStart: t, tLast: t, deviations: {}, releve: [], fullLegs: [], visibility: 1 };
      }
      const seg = this.segment;
      seg.tLast = t;
      for (const d of m.deviations) (seg.deviations[d.segment] ??= { label: d.label, values: [] }).values.push(d.deg);
      if (m.releve !== null) seg.releve.push(m.releve);
      seg.fullLegs.push(m.fullLegs);
      seg.visibility = Math.min(seg.visibility, minVisibility(lm, LEG_POINTS));
    } else if (this.segment && t - this.segment.tLast > this.s.gapToleranceMs) {
      this.endSegment();
    }

    this.live = { shape: m.shape, label: m.shape ? SHAPES[m.shape].label : null, mainDeg: m.mainDeg ?? null };
  }

  endSegment() {
    const seg = this.segment;
    this.segment = null;
    const event = judgeBalance({
      shape: seg.shape,
      tStart: seg.tStart,
      tEnd: seg.tLast,
      // Median over the hold: robust to a few noisy frames.
      deviations: Object.entries(seg.deviations).map(([segment, d]) => ({ segment, label: d.label, deg: median(d.values) })),
      releveShare: seg.releve.length ? seg.releve.filter(Boolean).length / seg.releve.length : null,
      fullLegsShare: seg.fullLegs.filter(Boolean).length / seg.fullLegs.length,
      visibility: seg.visibility,
    }, this.s);
    if (event) this.onEvent(event);
  }

  /** Call at the end of a routine so a shape still being held is judged. */
  flush() {
    if (this.segment) this.endSegment();
  }
}

/**
 * Which of the shapes is shown in this frame, and how far each body segment is from the
 * rulebook shape (degrees). Exported for tests, the live readout and tools/image-check.html.
 */
export function measureBalance(lm, s = BALANCE_SETTINGS) {
  const torso = torsoLength(lm);
  if (!torso) return { shape: null };

  // Free leg = the one with the higher ankle; it must be lifted above the support knee.
  const leftIsFree = lm[LM.L_ANKLE].y < lm[LM.R_ANKLE].y;
  const free = legPoints(lm, leftIsFree ? 'L' : 'R');
  const support = legPoints(lm, leftIsFree ? 'R' : 'L');
  const hips = mid(lm[LM.L_HIP], lm[LM.R_HIP]);
  const thighLen = Math.max(dist(free.hip, free.knee), dist(support.hip, support.knee));
  const shinLen = Math.max(dist(free.knee, free.ankle), dist(support.knee, support.ankle));

  const base = {
    shape: null,
    help: hasHelp(lm, free, torso, s),
    releve: isOnReleve(support.heel, support.toe, shinLen, s.releveHeelLift),
    fullLegs: legsFullLength(legLengthRatios(lm)),
    facing: facingSign(lm, support.side),
    split: splitAngle(lm),
    trunk: trunkTilt(lm),
    freeKnee: jointAngle(free.hip, free.knee, free.ankle),
    deviations: [],
  };
  if (free.ankle.y >= support.knee.y || base.facing === 0) return base;

  // Forward or backward? Compare the free foot with the head, not the hips: at a 180° split the
  // foot is straight above the hips, but in a front split the leg passes in front of the face
  // and in a back split the foot is behind the head.
  const ears = mid(lm[LM.L_EAR], lm[LM.R_EAR]);
  const refX = (ears.visibility ?? 0) >= 0.3 ? ears.x : hips.x;
  const forward = (free.ankle.x - refX) * base.facing > 0;
  const straight = base.freeKnee >= s.straightKneeDeg;
  const splitDev = { segment: 'split', label: 'Split', deg: 180 - base.split };

  // Front split: free leg forward and straight, legs far apart.
  if (forward) {
    if (straight && base.split >= s.minSplitToRecognize && free.ankle.y < hips.y) {
      return { ...base, shape: base.help ? 'frontSplitHelp' : 'frontSplit', deviations: [splitDev], mainDeg: base.split };
    }
    return base;
  }

  // A hand on a backward leg = back split with help or a ring balance: out of scope.
  if (base.help) return base;

  // Attitude: free leg backward with the knee bent, thigh raised, trunk roughly upright,
  // and the foot not up at the head (that would be a ring).
  const thighDeg = thighElevation(free.hip, free.knee, thighLen);
  const headTop = headTopY(lm);
  const footAtHead = headTop !== null && free.ankle.y < headTop + 0.25 * torso;
  if (base.freeKnee >= s.attitudeKneeMin && base.freeKnee <= s.attitudeKneeMax
      && thighDeg >= s.minAttitudeThighDeg && base.trunk < s.maxAttitudeTrunkTilt && !footAtHead) {
    return {
      ...base,
      shape: 'attitude',
      deviations: [
        { segment: 'thigh', label: 'Thigh below horizontal', deg: BALANCES.ATTITUDE.requiredThighDeg - thighDeg },
        { segment: 'trunk', label: 'Trunk not vertical', deg: base.trunk },
      ],
      mainDeg: thighDeg,
    };
  }

  // Back split without help: free leg backward, straight-ish, high up.
  const legUp = legElevation(hips, free.ankle);
  if (base.freeKnee >= s.attitudeKneeMax && legUp >= s.minBackLegElevation
      && base.trunk < s.maxUprightTrunkTilt) {
    const footDeg = footBelowHeadDeg(lm, hips, free);
    if (footDeg === null) return base;
    return {
      ...base,
      shape: 'backSplitFootAboveHead',
      deviations: [{ segment: 'foot', label: 'Foot not fully above head', deg: footDeg }],
      mainDeg: legUp,
    };
  }
  return base;
}

/**
 * Degrees the free leg still has to rise (rotating at the hip) until the WHOLE foot is above
 * the top of the head. 0 when it already is. null when the head can't be seen.
 */
export function footBelowHeadDeg(lm, hips, free) {
  const headTop = headTopY(lm);
  if (headTop === null) return null;
  // Lowest visible point of the foot: "whole foot above the head" means heel AND toes.
  const footPoints = [free.heel, free.toe].filter((p) => (p?.visibility ?? 0) >= 0.3);
  const low = footPoints.length
    ? footPoints.reduce((a, b) => (b.y > a.y ? b : a))
    : free.ankle;
  if (low.y <= headTop) return 0;

  const radius = dist(hips, low); // the foot moves on this circle when the leg rises
  const rise = hips.y - headTop; // how high above the hips the head top is
  const neededDeg = toDeg(Math.acos(clamp(-rise / radius, -1, 1))); // elevation that reaches head height
  return Math.max(0, neededDeg - legElevation(hips, low));
}

/** Is a hand holding the free leg (shin or foot)? */
function hasHelp(lm, free, torso, s) {
  const hands = [LM.L_WRIST, LM.R_WRIST, LM.L_INDEX, LM.R_INDEX]
    .map((i) => lm[i])
    .filter((p) => p && (p.visibility ?? 0) >= 0.3);
  const limit = s.helpDistance * torso;
  return hands.some((h) => distToSegment(h, free.knee, free.ankle) < limit
    || distToSegment(h, free.ankle, free.toe ?? free.ankle) < limit);
}

/** Turns one held balance into a judged event using the Code of Points. */
export function judgeBalance(m, s = BALANCE_SETTINGS) {
  const durationMs = m.tEnd - m.tStart;
  if (durationMs < s.minBalanceMs) return null; // no stop position: not a balance attempt

  const { rule, variant } = SHAPES[m.shape];
  const penalties = [];
  const measurements = { holdMs: Math.round(durationMs) };
  let shapeValid = true;

  // Shape deviations: one penalty per incorrect body segment (#2.5, p. 25; examples p. 83).
  for (const d of m.deviations) {
    const band = deviationBand(d.deg);
    measurements[`${d.segment}DevDeg`] = band.deg;
    if (band.penalty > 0) {
      penalties.push({ reason: `${d.label}: ${band.band} deviation (${band.deg}°)`, value: band.penalty, ref: band.ref });
    }
    if (!band.dbValid) shapeValid = false;
  }

  if (durationMs < BALANCE_RULES.minHoldMs) {
    penalties.push({
      reason: `Shape not held for a minimum 1 second (${(durationMs / 1000).toFixed(1)} s)`,
      value: BALANCE_RULES.shortHoldPenalty,
      ref: '#10.2.2 p.84',
    });
  }

  const warnings = [];
  let value = variant.value;
  if (m.releveShare === null) {
    warnings.push('Feet not visible: relevé not verified');
  } else if (m.releveShare < s.releveMinShare) {
    value = round2(value - BALANCE_RULES.flatFootReduction);
    warnings.push('On flat foot: value reduced by 0.10 (#10.3)');
  }
  if (m.releveShare !== null) measurements.relevePct = Math.round(m.releveShare * 100);

  const usesSplit = m.deviations.some((d) => d.segment === 'split');
  if (usesSplit && m.fullLegsShare < 0.5) {
    warnings.push('A leg is foreshortened (camera not side-on): split angle unreliable');
  }
  if (!rule.verified) warnings.push('DB value awaiting a check against the CoP pictograms (p. 88-89)');

  return {
    element: variant.name,
    code: variant.code,
    box: rule.box,
    t: m.tStart,
    tStart: m.tStart,
    tEnd: m.tEnd,
    dbValid: shapeValid && value > 0,
    dbValue: shapeValid ? value : 0,
    penalties,
    measurements,
    confidence: Math.round(m.visibility * 10) / 10,
    warnings,
    ruleRef: rule.ref,
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const k = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[k] : (sorted[k - 1] + sorted[k]) / 2;
}
