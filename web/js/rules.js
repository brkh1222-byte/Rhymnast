// Rule values from the FIG Rhythmic Gymnastics Code of Points 2025-2028
// (mark-up version, valid from 1 April 2025). "p. N" = page N of that PDF.
// Every number here must have a reference. See docs/rules.md for the quoted text.

export const RULE_SOURCE =
  'FIG Rhythmic Gymnastics Code of Points 2025-2028 (valid from 1 April 2025)';

/**
 * Shape deviation bands, Difficulty #2.5.2-2.5.4 (p. 25).
 * The Code says (p. 26) the angles are a guideline for judges, so the app
 * shows these as SUGGESTIONS that a judge can reject.
 */
export const DEVIATION_BANDS = [
  { band: 'none', maxDeg: 0, penalty: 0, dbValid: true, ref: '#2.5.1 p.25' },
  { band: 'small', maxDeg: 10, penalty: 0.1, dbValid: true, ref: '#2.5.2 p.25' },
  { band: 'medium', maxDeg: 20, penalty: 0.3, dbValid: true, ref: '#2.5.3 p.25' },
  { band: 'large', maxDeg: Infinity, penalty: 0.5, dbValid: false, ref: '#2.5.4 p.25' },
];

/** Band for a deviation in degrees. Rounded first: CoP uses "10° or less", "11-20°". */
export function deviationBand(deviationDeg) {
  const deg = Math.max(0, Math.round(deviationDeg));
  return { deg, ...DEVIATION_BANDS.find((b) => deg <= b.maxDeg) };
}

/** Difficulty components, Difficulty #1.5 (p. 21): highest 8 DB counted. */
export const MAX_DB_COUNTED = 8;

/** Final score = D + A + E, penalties deducted from it. General #5.2 (p. 12). */
export const E_MAX = 10;
export const A_MAX = 10;

export const ELEMENTS = {
  SPLIT_LEAP: {
    code: '1.2103',
    name: 'Split leap',
    // Table of jump/leap difficulties #9, item 21 (p. 76-78); value column 0.30.
    // Matches the example "DB valid: 0.30 p." in #8.1.2 (p. 72).
    value: 0.3,
    // "A split position of 180° is required at the highest point of the leap." (p. 74)
    requiredSplitDeg: 180,
    ref: 'Jumps #8.1, #9 item 21 (p. 72-78); deviations #2.5 (p. 25)',
  },
  PASSE_BALANCE: {
    code: '2.101',
    name: 'Passé balance',
    // Table of balance difficulties #11, item 1 (p. 88): 0.10.
    value: 0.1,
    // Passé = free thigh "horizontal position" (p. 88).
    requiredThighDeg: 90,
    // "Stop position fixed in the shape for a minimum of 1 second" (#10.1.2).
    minHoldMs: 1000,
    // Held less than 1 s: valid, Execution penalty 0.30 (#10.2.2, p. 84).
    shortHoldPenalty: 0.3,
    // On flat foot the value is reduced by 0.10 (#10.3, p. 84).
    flatFootReduction: 0.1,
    ref: 'Balances #10.1-10.3 (p. 84), #11 item 1 (p. 88); deviations #2.5 (p. 25)',
  },
  PASSE_PIVOT: {
    code: '3.101',
    name: 'Passé pivot',
    // Table of rotation difficulties #13, item 1 (p. 98): 0.10 for 360°.
    value: 0.1,
    requiredThighDeg: 90,
    baseRotationDeg: 360, // #12.1.2
    // +0.10 per additional rotation for pivots with base value 0.10 (#12.2.5, p. 92).
    perExtraRotation: 0.1,
    ref: 'Rotations #12.1-12.2 (p. 91-92), #13 item 1 (p. 98); deviations #2.5 (p. 25)',
  },
};

/** Round to 2 decimals (scores are in hundredths). */
export function round2(value) {
  return Math.round(value * 100) / 100;
}
