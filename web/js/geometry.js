// Geometry helpers on MediaPipe Pose landmarks.
//
// All points are in PIXELS of the video frame: { x, y, visibility }.
// Image y grows DOWNWARD, so "higher on screen" means a smaller y.

// MediaPipe Pose landmark indices (33 points). Only the ones we use are listed.
// https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
export const LM = {
  NOSE: 0,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
  L_HEEL: 29,
  R_HEEL: 30,
  L_FOOT: 31, // "foot index" = toes
  R_FOOT: 32,
};

// Landmarks a leg-based rule needs before we trust a frame.
export const LEG_POINTS = [
  LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE,
];

export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function mid(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

export const toDeg = (rad) => (rad * 180) / Math.PI;

export function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

/** Lowest visibility among the given landmark indices (0..1). */
export function minVisibility(lm, indices) {
  return Math.min(...indices.map((i) => lm[i]?.visibility ?? 0));
}

/** Distance from mid-hip to mid-shoulder. Used as the body's size unit. */
export function torsoLength(lm) {
  const hips = mid(lm[LM.L_HIP], lm[LM.R_HIP]);
  const shoulders = mid(lm[LM.L_SHOULDER], lm[LM.R_SHOULDER]);
  return dist(hips, shoulders);
}

/**
 * Signed angle in degrees from vector `from` to vector `to`, in (-180, 180].
 */
export function signedAngle(from, to) {
  const cross = from.x * to.y - from.y * to.x;
  const dot = from.x * to.x + from.y * to.y;
  return toDeg(Math.atan2(cross, dot));
}

/** Unsigned angle at `vertex` between the rays to `a` and `b`, in [0, 180]. */
export function jointAngle(a, vertex, b) {
  return Math.abs(signedAngle(sub(a, vertex), sub(b, vertex)));
}

/**
 * Angle between the two legs, in degrees (can be MORE than 180 for an over-split).
 *
 * Each leg is the line mid-hip -> ankle. Both legs are measured as signed angles
 * from the trunk's "down" direction (mid-shoulder -> mid-hip), and the split is
 * the difference. Measuring "through the bottom" like this lets a 200° over-split
 * read as 200°, where a plain unsigned angle would wrongly read 160°.
 *
 * 2D only: this is accurate only when the camera sees the split side-on.
 */
export function splitAngle(lm) {
  const hips = mid(lm[LM.L_HIP], lm[LM.R_HIP]);
  const shoulders = mid(lm[LM.L_SHOULDER], lm[LM.R_SHOULDER]);
  const down = sub(hips, shoulders);
  const left = signedAngle(down, sub(lm[LM.L_ANKLE], hips));
  const right = signedAngle(down, sub(lm[LM.R_ANKLE], hips));
  let split = Math.abs(left - right);
  // A gap measured "through the top" (legs nearly together above the head) is
  // not a split. No human split goes past ~270°, so fold those back.
  if (split > 270) split = 360 - split;
  return split;
}

/**
 * How high a thigh is raised, in degrees: 0 = hanging straight down,
 * 90 = horizontal, 180 = straight up.
 *
 * Uses only the knee's VERTICAL position relative to the hip, divided by the
 * real thigh length. Vertical distances are not shortened when the gymnast turns,
 * so this works from any camera direction (important for pivots).
 */
export function thighElevation(hip, knee, thighLength) {
  if (!thighLength) return 0;
  const cos = clamp((knee.y - hip.y) / thighLength, -1, 1);
  return toDeg(Math.acos(cos));
}

/**
 * Are both legs seen at (nearly) full length? A leg pointing toward or away from
 * the camera looks shorter in 2D, and then any angle measured with it is wrong.
 *
 * Returns each leg's mid-hip -> ankle length divided by torso length. For a real
 * person a straight leg is about 1.8-2.1 torsos long (checked on competition photos).
 * Rhythmic gymnasts often turn the shoulders and hips to the audience during a
 * split, so this is a better "camera is side-on to the split" check than body width.
 */
export function legLengthRatios(lm) {
  const torso = torsoLength(lm);
  if (!torso) return [0, 0];
  const hips = mid(lm[LM.L_HIP], lm[LM.R_HIP]);
  return [dist(hips, lm[LM.L_ANKLE]) / torso, dist(hips, lm[LM.R_ANKLE]) / torso];
}

/**
 * How "wide" the body looks to the camera: average shoulder and hip width
 * divided by torso length. About 0.6-0.8 when facing the camera,
 * about 0.1-0.25 when side-on. Used to count pivot rotations and to warn
 * when the camera angle is wrong for measuring a split.
 */
export function bodyWidthRatio(lm) {
  const torso = torsoLength(lm);
  if (!torso) return 0;
  const shoulders = dist(lm[LM.L_SHOULDER], lm[LM.R_SHOULDER]);
  const hips = dist(lm[LM.L_HIP], lm[LM.R_HIP]);
  return (shoulders + hips) / 2 / torso;
}
