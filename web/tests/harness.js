// Tiny test harness with no dependencies, so tests run in any browser
// (tests/index.html) and in macOS's built-in JavaScriptCore (tests/run.sh).

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assert(condition, message = 'assertion failed') {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertClose(actual, expected, tolerance, message = '') {
  if (!(Math.abs(actual - expected) <= tolerance)) {
    throw new Error(`${message} expected ${expected} ± ${tolerance}, got ${actual}`);
  }
}

/** Runs every registered test. @param log function(line) @returns number of failures */
export function runAll(log) {
  let failed = 0;
  for (const t of tests) {
    try {
      t.fn();
      log(`ok    ${t.name}`);
    } catch (err) {
      failed += 1;
      log(`FAIL  ${t.name}\n      ${err.message}`);
    }
  }
  log(`\n${tests.length - failed}/${tests.length} tests passed`);
  return failed;
}
