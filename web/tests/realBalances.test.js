// Real photos as regression tests: each fixture is the body landmarks of one labeled photo
// (exported by web/tools/validate.html; no images). The app must recognize the labeled shape and,
// when a judge's deduction is given, deduct the same for the shape.
import { test, assertEqual } from './harness.js';
import fixtures from './fixtures/real-balances.js';
import { analyzeLandmarks } from '../js/tools/analyzeImage.js';

if (fixtures.length === 0) {
  test('real photo fixtures: none yet (export them with tools/validate.html)', () => {});
}

for (const f of fixtures) {
  test(`real photo ${f.id}: recognized as ${f.expected}`, () => {
    const lm = f.lm.map(([x, y, visibility]) => ({ x, y, visibility }));
    const a = analyzeLandmarks(lm);
    assertEqual(a.shape, f.expected, 'shape:');
    if (f.judgeDeduction != null && f.expected !== 'none') {
      assertEqual(a.deduction, f.judgeDeduction, 'shape deduction:');
    }
  });
}
