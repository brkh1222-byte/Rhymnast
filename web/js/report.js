// End-of-routine deduction report: every judged move in order, each deduction with the rulebook
// sentence behind it, and the totals. Pure data (no HTML), so it can be tested and exported.

import { RULE_SOURCE, round2, ruleTextFor } from './rules.js';

const STATUS_TEXT = {
  counted: 'Counted in D',
  repeat: 'Not counted: same difficulty already performed (#2.4.1)',
  'not valid': 'Not valid as a difficulty',
  'not in top 8': 'Not counted: only the highest 8 difficulties count (#1.5)',
  rejected: 'Rejected by the judge',
};

/**
 * @param scoreboard Scoreboard (scoring.js)
 * @param judge { artistry, extraD, extraE, penalties }
 * @param options { durationMs }
 */
export function buildReport(scoreboard, judge = {}, { durationMs = null } = {}) {
  const scores = scoreboard.compute(judge);
  const events = [...scoreboard.events].sort((a, b) => a.t - b.t);

  const moves = events.map((e, i) => {
    const status = scores.status.get(e.id);
    const deductions = e.rejected ? [] : e.penalties.map((p) => ({
      value: p.value,
      reason: p.reason,
      ref: p.ref,
      rule: ruleTextFor(p.ref),
    }));
    return {
      number: i + 1,
      timeMs: e.routineMs ?? e.t,
      element: e.element,
      code: e.code,
      requirement: e.requirement ?? null,
      dbValue: e.dbValue,
      status,
      statusText: STATUS_TEXT[status] ?? status,
      measurements: e.measurements,
      deductions,
      totalDeduction: round2(deductions.reduce((sum, d) => sum + d.value, 0)),
      clean: !e.rejected && deductions.length === 0,
      rejected: e.rejected,
      notes: e.warnings.map((w) => ({ text: w, rule: ruleTextFor(w) })),
    };
  });

  const judged = moves.filter((m) => !m.rejected);
  return {
    ruleSource: RULE_SOURCE,
    generatedAt: new Date().toISOString(),
    durationMs,
    summary: {
      moves: moves.length,
      cleanMoves: judged.filter((m) => m.clean).length,
      movesWithDeductions: judged.filter((m) => !m.clean).length,
      totalDeduction: scores.breakdown.autoE, // automated execution deductions
      judgeDeduction: scores.breakdown.extraE,
      penalties: scores.breakdown.penalties,
      D: scores.D,
      E: scores.E,
      A: scores.A,
      final: scores.final,
    },
    moves,
    notJudged: [
      'Apparatus difficulties (DA), dance steps and R elements: entered by the judges as extra D.',
      'Apparatus handling faults, artistry and expression: entered by the judges.',
      'The angles in the Code are a guideline for judges (p. 26): every call above can be rejected.',
    ],
  };
}
