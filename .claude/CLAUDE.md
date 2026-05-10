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
PR preview environments are deployed **manually via workflow dispatch only** — there are no automatic triggers on PR events. The manual dispatch workflow (`.github/workflows/dispatch-pr-preview-frontend.yml`) validates the PR, resolves commit SHAs, and calls the backend repo's reusable workflow (`refactor-platform-rs/.github/workflows/ci-deploy-pr-preview.yml@main`) with `repo_type: 'frontend'`. It uses `secrets: inherit` to pass secrets to the reusable workflow. Cleanup runs automatically when the PR is closed or merged via `cleanup-pr-preview-frontend.yml`.

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

### Manual Dispatch (string inputs + runtime resolver)
`dispatch-pr-preview-frontend.yml` is the primary (and only) way to deploy frontend PR previews. It takes three text inputs:
- `frontend_pr_number` — required (e.g. `373` or `PR#373`).
- `frontend_sha_override` — optional, override the PR branch HEAD with a specific SHA.
- `backend_ref` — optional, default `main`; accepts `main`, a branch name, a 7+ char SHA, or `PR#<num>`.

At dispatch time, the `validate` job resolves each input to a full SHA via the GitHub API (`gh pr view`, `gh api repos/.../commits/<ref>`), validates that the frontend PR is OPEN, and calls the backend repo's reusable workflow (`refactor-platform-rs/.github/workflows/ci-deploy-pr-preview.yml@main`) with `repo_type: 'frontend'` and the resolved `backend_sha` / `frontend_sha` / `pr_number` / `branch_name`. Nothing is written to `main` — the workflow is stateless with respect to the default branch.

### List Preview Refs (helper, lives in backend repo)
Run `list-preview-refs.yml` from the backend repo's Actions tab to render a Markdown summary of current `main` commits + open PR heads from both repos. Use it when you don't remember a PR number or a branch SHA. It's read-only (`permissions: contents: read`), never commits anything. This replaces the old `refresh-preview-commits.yml` workflow, which was deleted because the `type: choice` dropdown it maintained required committing to `main` on every PR event.

### Secrets: inherit Pitfall
`secrets: inherit` passes **all** secrets from the calling repo (frontend) to the reusable workflow (backend). If the frontend repo has a secret like `PR_PREVIEW_BACKEND_API_VERSION`, it will **override** the reusable workflow's `|| 'fallback'` defaults — even if the secret's value is stale. Always check for stale repo-level secrets when debugging environment variable issues in PR previews.
