#!/bin/sh
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null 2>&1 || { echo "setup: Node.js was not found. Install Node.js 24 from nodejs.org, then run this again."; exit 1; }
node scripts/setup.mjs
exit $?
