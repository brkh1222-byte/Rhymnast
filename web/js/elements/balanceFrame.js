// Body measurements of one frame, shared by the balance rules (balances.js) and the
// learned pose library (library/signature.js), so both always see the same numbers.

import {
  LM, clamp, dist, distToSegment, facingSign, headTopY, isOnReleve, jointAngle, legElevation,
  legLengthRatios, legPoints, mid, signedAngle, splitAngle, sub, thighElevation, toDeg, torsoLength, trunkLeanX, trunkTilt,
} from '../geometry.js';
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

/**
 * Everything the balance rules need from one frame. null if the body can't be measured.
 * Free leg = the leg with the higher ankle; support leg = the other one.
 */
export function balanceFrame(lm, s = BALANCE_SETTINGS) {
  const torso = torsoLength(lm);
  if (!torso) return null;

  const leftIsFree = lm[LM.L_ANKLE].y < lm[LM.R_ANKLE].y;
  const free = legPoints(lm, leftIsFree ? 'L' : 'R');
  const support = legPoints(lm, leftIsFree ? 'R' : 'L');
  const hips = mid(lm[LM.L_HIP], lm[LM.R_HIP]);
  const thighLen = Math.max(dist(free.hip, free.knee), dist(support.hip, support.knee));
  const shinLen = Math.max(dist(free.knee, free.ankle), dist(support.knee, support.ankle));
  const facing = facingSign(lm, support.side);

  // Signed trunk lean: + = trunk leans the way she faces, - = leans back.
  const lean = facing === 0 ? trunkTilt(lm) : trunkLeanX(lm) * facing;

  // Forward or backward leg? Angle of the free leg around the hips, + on the side she faces.
  // Near vertical (within 20°) the leg line is the same for a front and a back split, so the trunk
  // decides: real front splits keep the trunk upright or leaning back, back splits lean it forward
  // (checked on competition photos: front splits -24° and -35°).
  // (signedAngle from 'down' is positive toward -x in image coordinates, hence the minus.)
  const legSide = facing === 0 ? null : -signedAngle({ x: 0, y: 1 }, sub(free.ankle, hips)) * facing;
  const forward = legSide === null ? null : Math.abs(legSide) > 160 ? lean <= 10 : legSide > 0;

  const headTop = headTopY(lm);
  const footLow = lowestFootPoint(free);

  return {
    torso,
    free,
    support,
    hips,
    facing,
    forward,
    raised: free.ankle.y < support.knee.y, // free leg lifted at all
    help: hasHelp(lm, free, torso, s),
    releve: isOnReleve(support.heel, support.toe, shinLen, s.releveHeelLift),
    fullLegs: legsFullLength(legLengthRatios(lm)),
    split: splitAngle(lm),
    trunk: trunkTilt(lm),
    lean,
    freeKnee: jointAngle(free.hip, free.knee, free.ankle),
    thighDeg: thighElevation(free.hip, free.knee, thighLen),
    legUp: legElevation(hips, free.ankle),
    headTop,
    footAtHead: headTop !== null && free.ankle.y < headTop + 0.25 * torso,
    // How far the lowest point of the free foot is above the head top, in torso lengths.
    footOverHead: headTop === null ? null : (headTop - footLow.y) / torso,
    // How far the free ankle is above the hips, in torso lengths.
    footOverHip: (hips.y - free.ankle.y) / torso,
    footBelowHeadDeg: footBelowHeadDeg(hips, footLow, headTop),
  };
}

/** Lowest visible point of the foot: "whole foot above the head" means heel AND toes. */
function lowestFootPoint(free) {
  const points = [free.heel, free.toe].filter((p) => (p?.visibility ?? 0) >= 0.3);
  return points.length ? points.reduce((a, b) => (b.y > a.y ? b : a)) : free.ankle;
}

/**
 * Degrees the free leg still has to rise (rotating at the hip) until the WHOLE foot is above
 * the top of the head. 0 when it already is. null when the head can't be seen.
 */
function footBelowHeadDeg(hips, low, headTop) {
  if (headTop === null) return null;
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
