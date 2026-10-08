// Balance detector for three held shapes (CoP #10 balances, table #11):
//   - front split, with or without help             (row 3: "Split is required")
//   - back split without help, trunk upright         (row 10: "whole foot above the head is required")
//   - attitude                                       (row 12: thigh horizontal, body vertical)
//
// Two separate questions per frame:
//   1. WHICH pose is this?  Answered by the pose library (library/recognizer.js): the frame's pose
//      signature is compared with many examples of the correct poses and of other poses.
//      If the library doesn't know enough examples yet, fixed rule thresholds are used instead.
//   2. HOW FAR from the rulebook shape?  Always measured with rulebook geometry (degrees per body
//      segment), so every deduction can be explained with the Code of Points.
//
// While the same shape is held we collect measurements; when she leaves it, the hold is judged
// once: shape deviations per body segment (#2.5), held < 1 s (#10.2.2), flat foot (#10.3).
//
// Out of scope and not scored (they look like our shapes in 2D): back split with help, front
// split with the trunk bent back, ring balances. Film side-on.

import { LEG_POINTS, minVisibility } from '../geometry.js';
import { BALANCES, BALANCE_RULES, deviationBand, round2 } from '../rules.js';
import { BALANCE_SETTINGS, balanceFrame } from './balanceFrame.js';
import { poseSignature } from '../library/signature.js';

export { BALANCE_SETTINGS } from './balanceFrame.js';

// How each recognized shape maps to the rulebook.
export const SHAPES = {
  frontSplitHelp: { rule: BALANCES.FRONT_SPLIT, variant: BALANCES.FRONT_SPLIT.withHelp, label: 'Front split · help' },
  frontSplit: { rule: BALANCES.FRONT_SPLIT, variant: BALANCES.FRONT_SPLIT.withoutHelp, label: 'Front split' },
  backSplitFootAboveHead: { rule: BALANCES.BACK_SPLIT, variant: BALANCES.BACK_SPLIT.footAboveHead, label: 'Back split' },
  attitude: { rule: BALANCES.ATTITUDE, variant: BALANCES.ATTITUDE.plain, label: 'Attitude' },
};
const FOCUS_POSES = Object.keys(SHAPES);

// The pose library used for recognition (set by the app; tests pass their own).
let activeLibrary = null;
export function setPoseLibrary(library) {
  activeLibrary = library;
}
export function getPoseLibrary() {
  return activeLibrary;
}

/** Does this library know every pose (and 'none') well enough to decide on its own? */
export function libraryIsReady(library) {
  return Boolean(library) && [...FOCUS_POSES, 'none'].every((p) => library.knows(p));
}

export class BalanceDetector {
  constructor(onEvent, settings = BALANCE_SETTINGS) {
    this.onEvent = onEvent;
    this.s = settings;
    this.library = undefined; // undefined = use the active library
    this.reset();
  }

  reset() {
    this.segment = null;
    this.live = { shape: null, label: null, mainDeg: null, holdMs: 0, deduction: null, hint: null };
  }

  /** @param frame { t: ms, lm: landmarks in pixels or null (nobody visible), airborne } */
  update({ t, lm, airborne = false }) {
    let m;
    if (!lm) m = { shape: null, deviations: [], hint: 'Step into the camera view' };
    else if (airborne) m = { shape: null, deviations: [], hint: null };
    else if (minVisibility(lm, LEG_POINTS) < this.s.minVisibility) {
      m = { shape: null, deviations: [], hint: 'Whole body and both feet must be in view' };
    } else {
      m = measureBalance(lm, this.s, this.library === undefined ? activeLibrary : this.library);
    }

    if (this.segment && m.shape && m.shape !== this.segment.shape) {
      this.endSegment(); // switched straight into another shape
    }
    if (m.shape) {
      if (!this.segment) {
        this.segment = { shape: m.shape, tStart: t, tLast: t, deviations: {}, releve: [], fullLegs: [], visibility: 1, recognizer: m.recognizer };
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

    this.live = {
      shape: m.shape,
      label: m.shape ? SHAPES[m.shape].label : null,
      mainDeg: m.mainDeg ?? null,
      deviations: m.deviations,
      holdMs: this.segment ? this.segment.tLast - this.segment.tStart : 0,
      deduction: m.shape ? photoDeduction(m) : null,
      confidence: m.confidence ?? null,
      recognizer: m.recognizer ?? null,
      hint: m.shape ? null : m.hint ?? null,
    };
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
      recognizer: seg.recognizer,
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
 * rulebook shape (degrees). Exported for tests, the live readout and the tools.
 * @param library a PoseLibrary, or null to use only the fixed rules
 */
export function measureBalance(lm, s = BALANCE_SETTINGS, library = activeLibrary) {
  const f = balanceFrame(lm, s);
  if (!f) return { shape: null, deviations: [], hint: 'Step into the camera view' };

  const base = {
    shape: null,
    deviations: [],
    help: f.help,
    releve: f.releve,
    fullLegs: f.fullLegs,
    facing: f.facing,
    split: f.split,
    trunk: f.trunk,
    freeKnee: f.freeKnee,
    signature: poseSignature(f),
  };

  // 1. Which pose? The library decides when it is ready, otherwise the fixed rules.
  let shape;
  let recognizer;
  let confidence = null;
  if (libraryIsReady(library) && f.forward !== null) {
    const r = library.recognize(base.signature);
    shape = r.pose;
    recognizer = 'library';
    confidence = r.confidence;
  } else {
    // Rules also cover "can't tell which way she faces": they return nothing then.
    shape = ruleShape(f, s);
    recognizer = libraryIsReady(library) ? 'library' : 'rules';
  }
  // Help is a measured fact (hand on the leg), so it picks the front split variant.
  if (shape === 'frontSplit' || shape === 'frontSplitHelp') shape = f.help ? 'frontSplitHelp' : 'frontSplit';

  if (!shape) return { ...base, recognizer, confidence, hint: hintFor(f) };

  // 2. How far from the rulebook shape?
  const measured = deviationsFor(shape, f);
  if (!measured) return { ...base, recognizer, confidence, hint: 'Head not visible: move back from the camera' };
  return { ...base, shape, recognizer, confidence, ...measured };
}

/** Rulebook deviations for a recognized shape, in degrees per body segment. */
function deviationsFor(shape, f) {
  if (shape === 'frontSplitHelp' || shape === 'frontSplit') {
    return { deviations: [{ segment: 'split', label: 'Split short of 180°', deg: 180 - f.split }], mainDeg: f.split };
  }
  if (shape === 'attitude') {
    return {
      deviations: [
        { segment: 'thigh', label: 'Thigh below horizontal', deg: BALANCES.ATTITUDE.requiredThighDeg - f.thighDeg },
        { segment: 'trunk', label: 'Trunk not vertical', deg: f.trunk },
      ],
      mainDeg: f.thighDeg,
    };
  }
  if (shape === 'backSplitFootAboveHead') {
    if (f.footBelowHeadDeg === null) return null;
    return { deviations: [{ segment: 'foot', label: 'Foot not fully above head', deg: f.footBelowHeadDeg }], mainDeg: f.legUp };
  }
  return null;
}

/** Fixed thresholds, used until the pose library has enough examples. */
export function ruleShape(f, s = BALANCE_SETTINGS) {
  if (!f.raised || f.forward === null) return null;
  const straight = f.freeKnee >= s.straightKneeDeg;
  if (f.forward) {
    return straight && f.split >= s.minSplitToRecognize && f.footOverHip > 0 ? 'frontSplit' : null;
  }
  if (f.help) return null; // back split with help / ring: out of scope
  if (f.freeKnee >= s.attitudeKneeMin && f.freeKnee <= s.attitudeKneeMax
      && f.thighDeg >= s.minAttitudeThighDeg && f.trunk < s.maxAttitudeTrunkTilt && !f.footAtHead) {
    return 'attitude';
  }
  if (f.freeKnee >= s.attitudeKneeMax && f.legUp >= s.minBackLegElevation && f.trunk < s.maxUprightTrunkTilt) {
    return 'backSplitFootAboveHead';
  }
  return null;
}

/** Plain-language reason why no pose is recognized, for the live hint. */
function hintFor(f) {
  if (!f.raised) return null; // standing or preparing: nothing to say
  if (f.forward === null) return 'Turn side-on to the camera';
  if (!f.fullLegs) return 'Turn side-on: a leg points at the camera';
  return 'Pose not recognized';
}

// Names used in labels.csv and the validation tool for each recognized shape.
const SHAPE_KEYS = {
  frontSplitHelp: 'front_split_help',
  frontSplit: 'front_split',
  backSplitFootAboveHead: 'back_split',
  attitude: 'attitude',
};
const SHAPE_FROM_KEY = Object.fromEntries(Object.entries(SHAPE_KEYS).map(([k, v]) => [v, k]));

/** Label name for a measured shape ('none' when no balance is recognized). */
export function shapeKey(shape) {
  return shape ? SHAPE_KEYS[shape] : 'none';
}

/** Library pose label for a labels.csv name ('none' for anything else). */
export function shapeFromKey(key) {
  return SHAPE_FROM_KEY[key] ?? 'none';
}

/**
 * Shape deduction for one frame or photo: the sum of the deviation-band penalties of all body
 * segments (#2.5). Hold time and relevé can't be seen in one frame, so they are left out.
 * null when no balance is recognized.
 */
export function photoDeduction(m) {
  if (!m.shape) return null;
  return round2(m.deviations.reduce((total, d) => total + deviationBand(d.deg).penalty, 0));
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
    requirement: rule.requirement,
    recognizedBy: m.recognizer ?? 'rules',
    ruleRef: rule.ref,
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const k = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[k] : (sorted[k - 1] + sorted[k]) / 2;
}
