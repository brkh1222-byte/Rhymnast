// Renders the end-of-routine deduction report (data from report.js) into the page.

import { describeMeasurements, el, formatTime, minus } from './format.js';

export function renderReport(body, report) {
  body.replaceChildren();
  const s = report.summary;

  // ---------- Summary ----------
  const summary = el('div', 'report-summary');
  const tile = (label, value, note) => {
    const t = el('div', 'report-tile');
    t.append(el('span', 'label', label), el('b', null, value));
    if (note) t.append(el('small', null, note));
    return t;
  };
  summary.append(
    tile('Total deduction', minus(s.totalDeduction), `${s.movesWithDeductions} of ${s.moves} moves`),
    tile('Difficulty · D', s.D.toFixed(2)),
    tile('Execution · E', s.E.toFixed(2), s.judgeDeduction ? `incl. judge −${s.judgeDeduction.toFixed(2)}` : null),
    tile('Artistry · A', s.A.toFixed(2), 'judges'),
    tile('Final', s.final.toFixed(2), s.penalties ? `after penalties −${s.penalties.toFixed(2)}` : null),
  );
  body.append(summary);

  const meta = el('p', 'note', `${s.moves} move${s.moves === 1 ? '' : 's'} judged`
    + (report.durationMs ? ` in ${formatTime(report.durationMs)}` : '')
    + ` · ${s.cleanMoves} clean · Rules: ${report.ruleSource}`);
  body.append(meta);

  if (report.moves.length === 0) {
    body.append(el('p', 'report-empty', 'No balance was recognized during this routine. Check the camera is side-on with the whole body and both feet in view, and hold each pose for at least 1 second.'));
  }

  // ---------- One block per move ----------
  const list = el('ol', 'report-moves');
  for (const m of report.moves) {
    const li = el('li', `report-move${m.rejected ? ' rejected' : ''}`);
    const head = el('div', 'report-move-head');
    head.append(
      el('span', 'report-move-n', String(m.number).padStart(2, '0')),
      el('span', 'report-move-title', m.element),
      el('span', `report-move-total ${m.clean ? 'good' : 'bad'}`, m.rejected ? 'rejected' : minus(m.totalDeduction)),
    );
    li.append(head);
    li.append(el('div', 'report-move-meta', `${formatTime(m.timeMs)} · code ${m.code} · DB ${m.dbValue.toFixed(2)} · ${m.statusText}`));
    if (m.requirement) li.append(el('div', 'report-requirement', `Rulebook requirement: ${m.requirement}`));
    li.append(el('div', 'report-measured', `Measured: ${describeMeasurements(m.measurements)}`));

    if (m.clean) li.append(el('div', 'report-clean', 'No deduction: the shape met the requirement and was held for 1 second.'));
    for (const d of m.deductions) {
      const row = el('div', 'report-deduction');
      row.append(el('span', 'report-deduction-value', minus(d.value)), el('span', 'report-deduction-reason', d.reason));
      if (d.rule) {
        row.append(el('blockquote', 'report-rule', `“${d.rule.text}” Code of Points ${d.ref.split(' ')[0]}, p. ${d.rule.page}.`));
      }
      li.append(row);
    }
    for (const n of m.notes) {
      li.append(el('div', 'report-note', `Note: ${n.text}${n.rule ? ` · “${n.rule.text}” (p. ${n.rule.page})` : ''}`));
    }
    list.append(li);
  }
  body.append(list);

  const foot = el('ul', 'report-foot');
  for (const line of report.notJudged) foot.append(el('li', null, line));
  body.append(foot);
}
