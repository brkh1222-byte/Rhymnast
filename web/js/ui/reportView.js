// Results after "Finish", built from report.js data.
//   Practice: "You did 3 balances. Points lost: 0.40" + each move with reason and tip.
//   Judge:    the score (difficulty, execution, artistry, final) + each move.
//   "Show rulebook details" adds codes, measurements, the rule text and pages.

import { describeMove } from './plain.js';
import { describeMeasurements, el, formatTime } from './format.js';

/**
 * @param body container element
 * @param report data from buildReport()
 * @param options { mode: 'practice' | 'judge', details: boolean }
 */
export function renderReport(body, report, { mode = 'practice', details = false } = {}) {
  body.replaceChildren();
  const s = report.summary;
  const judged = report.moves.filter((m) => !m.rejected);

  if (report.moves.length === 0) {
    body.append(el('p', 'headline', 'No balance was recognized.'));
    body.lastChild.append(el('small', null, 'Stand sideways to the camera with your whole body and both feet in the picture, and hold each balance for at least 1 second.'));
    return;
  }

  // ---------- Headline ----------
  const headline = el('p', 'headline',
    `You did ${judged.length} balance${judged.length === 1 ? '' : 's'}. `
    + (s.totalDeduction === 0 ? 'No points lost. Well done!' : `Points lost: ${s.totalDeduction.toFixed(2)}.`));
  headline.append(el('small', null, `${s.cleanMoves} without mistakes`
    + (report.durationMs ? ` · ${formatTime(report.durationMs)} long` : '')));
  body.append(headline);

  if (mode === 'judge') {
    const row = el('div', 'score-row');
    const tile = (label, value) => {
      const t = el('div');
      t.append(el('span', null, label), el('b', null, value));
      return t;
    };
    row.append(
      tile('Difficulty', s.D.toFixed(2)),
      tile('Execution', s.E.toFixed(2)),
      tile('Artistry', s.A.toFixed(2)),
      tile('Final score', s.final.toFixed(2)),
    );
    body.append(row);
    if (s.penalties || s.judgeDeduction) {
      body.append(el('p', 'small', `Includes judge entries: penalties −${s.penalties.toFixed(2)}, extra execution −${s.judgeDeduction.toFixed(2)}.`));
    }
  }

  // ---------- Moves ----------
  const list = el('ol', 'moves');
  for (const m of report.moves) {
    const d = describeMove(m, m.status);
    const li = el('li', `move ${m.rejected ? 'rejected' : d.tone}`);
    const head = el('div', 'move-head');
    head.append(el('b', null, `${m.number}. ${d.name}`), el('span', `chip ${m.rejected ? 'muted' : d.tone}`, m.rejected ? 'Judge disagreed' : d.result));
    li.append(head);
    for (const r of d.reasons) {
      const p = el('p', 'reason', `${r.text} (−${r.value.toFixed(2)})`);
      if (r.tip) p.append(el('span', 'tip', r.tip));
      li.append(p);
    }
    if (d.reasons.length === 0 && !m.rejected) li.append(el('p', 'reason', 'Correct shape, held for 1 second.'));
    for (const n of d.notes) li.append(el('p', 'note-line', n));

    if (details) {
      li.append(el('p', 'details-line', `${formatTime(m.timeMs)} · code ${m.code} · difficulty value ${m.dbValue.toFixed(2)} · ${m.statusText}`));
      li.append(el('p', 'details-line', `Measured: ${describeMeasurements(m.measurements)}`));
      if (m.requirement) li.append(el('p', 'details-line', `Rulebook requirement: ${m.requirement}`));
      for (const ded of m.deductions) {
        if (ded.rule) li.append(el('blockquote', 'rule', `“${ded.rule.text}” Code of Points ${ded.ref.split(' ')[0]}, p. ${ded.rule.page}.`));
      }
    }
    list.append(li);
  }
  body.append(list);

  if (details) {
    const foot = el('ul', 'results-foot');
    for (const line of report.notJudged) foot.append(el('li', null, line));
    foot.append(el('li', null, 'The first 3° of every measured angle are not deducted: one camera can\'t measure more precisely.'));
    foot.append(el('li', null, `Rules: ${report.ruleSource}.`));
    body.append(foot);
  }
}
