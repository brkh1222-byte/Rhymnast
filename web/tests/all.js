// Imports every test file (each one registers its tests) and re-exports the runner.
import './geometry.test.js';
import './splitLeap.test.js';
import './passe.test.js';
import './scoring.test.js';
import './balances.test.js';
import './realBalances.test.js';
import './library.test.js';
import './report.test.js';

export { runAll } from './harness.js';
