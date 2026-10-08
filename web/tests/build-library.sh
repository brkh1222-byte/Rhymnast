#!/bin/sh
# Regenerates web/js/library/defaultLibrary.js from tests/buildDefaultLibrary.js (macOS).
set -e
cd "$(dirname "$0")"
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m build-library-jsc.js > ../js/library/defaultLibrary.js
echo "Wrote web/js/library/defaultLibrary.js ($(wc -c < ../js/library/defaultLibrary.js) bytes)"
