#!/usr/bin/env bash
# Runs Playwright E2E specs in the official Playwright Linux image, against the
# local dev server (npm run dev). Same browsers and OS as CI, and the only way
# to run Firefox on macOS 27+, where its native build hangs at startup.
#
# Usage: npm run test:e2e:docker -- [playwright test args]
#   e.g. npm run test:e2e:docker -- __tests__/e2e/header.spec.ts --project=firefox
set -euo pipefail

cd "$(dirname "$0")/.."

version=$(node -p 'require("@playwright/test/package.json").version')
image="mcr.microsoft.com/playwright:v${version}-noble"

if ! docker info >/dev/null 2>&1; then
  echo "Docker isn't running. Start Docker Desktop and try again." >&2
  exit 1
fi
if ! curl -s -o /dev/null http://localhost:3000; then
  echo "Nothing on localhost:3000. Start the dev server (npm run dev) and try again." >&2
  exit 1
fi
if [[ -n "${LIVE_E2E:-}" ]] && ! curl -s -o /dev/null http://localhost:4000; then
  echo "LIVE_E2E is set but nothing is on localhost:4000. Start the backend and try again." >&2
  exit 1
fi

# The dev server compiles pages on demand; more workers than this time out page loads.
args=("$@")
[[ " ${args[*]-} " == *" --workers"* || " ${args[*]-} " == *" -j"* ]] || args+=(--workers=2)

tty=()
[[ -t 1 ]] && tty=(-t)

# The app is on localhost:3000 and calls the backend on localhost:4000 (live specs),
# so forward both to the host.
# LIVE_E2E: passed through so the opt-in for *-live specs still works.
# PLAYWRIGHT_HTML_OPEN=never: the html reporter would otherwise serve the report and wait.
exec docker run --rm ${tty[@]+"${tty[@]}"} --ipc=host \
  -v "$PWD":/work -w /work \
  -e LIVE_E2E \
  -e PLAYWRIGHT_HTML_OPEN=never \
  "$image" \
  bash -c '
    node -e "
      const net = require(\"net\");
      for (const port of [3000, 4000]) {
        net.createServer((c) => {
          const u = net.connect(port, \"host.docker.internal\");
          c.pipe(u).pipe(c);
          c.on(\"error\", () => u.destroy());
          u.on(\"error\", () => c.destroy());
        }).listen(port, \"127.0.0.1\");
      }
    " &
    sleep 1
    exec npx playwright test "$@"
  ' playwright ${args[@]+"${args[@]}"}
