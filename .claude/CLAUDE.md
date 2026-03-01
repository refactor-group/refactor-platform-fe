# refactor-platform-fe Project Instructions

## Mandatory File Consultations

**Code Implementation/Editing** → Read `.claude/coding-standards.md` FIRST
**Pull Request Operations** → Read `.claude/pr-instructions.md` FIRST

## Rules
- Project standards override global defaults on conflict
- Validate all code against standards before task completion
- PR reviews require both files if coding standards referenced

## PR Preview Environments

### Architecture
The frontend PR preview workflow (`.github/workflows/pr-preview-frontend.yml`) calls the backend repo's reusable workflow (`refactor-platform-rs/.github/workflows/ci-deploy-pr-preview.yml@main`) with `repo_type: 'frontend'`. It uses `secrets: inherit` to pass secrets to the reusable workflow.

The reusable workflow runs these jobs for frontend PRs:
1. **lint-frontend** — ESLint
2. **test-frontend** — Build, unit tests (Vitest), E2E tests (Playwright)
3. **build-arm64-image** — Docker image build on ARM64 self-hosted runner (`neo`)
4. **deploy** — SSH deploy to Raspberry Pi 5 via Tailscale

### Test Job Configuration
The `test-frontend` job runs inside the official Playwright container (`mcr.microsoft.com/playwright:v1.58.2-noble`) with pre-installed browsers. Keep the image tag in sync with the `@playwright/test` version in `package.json`.

The job provides `NEXT_PUBLIC_*` env vars at build time (using `secrets.PR_PREVIEW_*` with localhost fallbacks) and prepares the Next.js standalone server for E2E by copying static assets into `.next/standalone/`. The `HOSTNAME: 0.0.0.0` env var ensures the standalone server binds to all interfaces inside the container.

### Key Environment Variables
- **`NEXT_PUBLIC_BASE_PATH`**: Set to `/pr-<NUM>` for sub-path routing in preview environments. Configured in `next.config.mjs` via `basePath`.
- **`NEXT_PUBLIC_BACKEND_API_VERSION`**: Must be `1.0.0-beta1` (not `v1`). The backend's `CompareApiVersion` extractor validates this header exactly.
- **`NEXT_PUBLIC_BACKEND_SERVICE_*`**: Protocol, host, port, and API path for backend URL construction. Baked at build time. The test job uses `PR_PREVIEW_*` secrets with fallback defaults; the Docker image build has its own build args.

### Docker ARG Scoping (Critical)
Docker `ARG` declarations **do not cross `FROM` boundaries**. Every `NEXT_PUBLIC_*` ARG must be redeclared in **each stage** that uses it (base, builder, runner). The builder stage needs them as `ENV` for `npm run build` to inline them into the client bundle. See `Dockerfile` stages for the pattern.

### Checkout Token Resilience
The `lint-frontend` and `test-frontend` jobs use a `continue-on-error` + fallback checkout pattern: the primary checkout uses `GHCR_PAT`, and if it fails (e.g., stale/expired token on re-run), a fallback checkout uses the default `GITHUB_TOKEN`. This prevents "re-run failed jobs" from failing on cross-repo `workflow_call` token regeneration issues.

### Secrets: inherit Pitfall
`secrets: inherit` passes **all** secrets from the calling repo (frontend) to the reusable workflow (backend). If the frontend repo has a secret like `PR_PREVIEW_BACKEND_API_VERSION`, it will **override** the reusable workflow's `|| 'fallback'` defaults — even if the secret's value is stale. Always check for stale repo-level secrets when debugging environment variable issues in PR previews.
