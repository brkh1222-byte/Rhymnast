// Entry point for macOS JavaScriptCore (see run.sh). `print` is jsc's console.log.
import { runAll } from './all.js';

const failed = runAll(print);
if (failed > 0) throw new Error(`${failed} test(s) failed`); // non-zero exit code
