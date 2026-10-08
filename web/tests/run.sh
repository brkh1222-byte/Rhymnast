#!/bin/sh
# Runs the unit tests with no installs needed.
#   macOS: uses the built-in JavaScriptCore engine.
#   Elsewhere: uses Node if available, otherwise open web/tests/index.html in a browser.
set -e
cd "$(dirname "$0")"

JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
if [ -x "$JSC" ]; then
  exec "$JSC" -m run-jsc.js
elif command -v node >/dev/null 2>&1; then
  exec node --input-type=module -e "import { runAll } from './all.js'; process.exit(runAll(console.log) ? 1 : 0);"
else
  echo "No JS engine found. Serve web/ and open http://localhost:8000/tests/ in a browser." >&2
  exit 1
fi
