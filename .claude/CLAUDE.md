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
The frontend PR preview workflow (`.github/workflows/pr-preview-frontend.yml`) calls the backend repo's reusable workflow (`refactor-platform-rs/ci-deploy-pr-preview.yml`) with `repo_type: 'frontend'`. It uses `secrets: inherit` to pass secrets to the reusable workflow.

### Key Environment Variables
- **`NEXT_PUBLIC_BASE_PATH`**: Set to `/pr-<NUM>` for sub-path routing in preview environments. Configured in `next.config.mjs` via `basePath`.
- **`NEXT_PUBLIC_BACKEND_API_VERSION`**: Must be `1.0.0-beta1` (not `v1`). The backend's `CompareApiVersion` extractor validates this header exactly.

### Docker ARG Scoping (Critical)
Docker `ARG` declarations **do not cross `FROM` boundaries**. Every `NEXT_PUBLIC_*` ARG must be redeclared in **each stage** that uses it (base, builder, runner). The builder stage needs them as `ENV` for `npm run build` to inline them into the client bundle. See `Dockerfile` stages for the pattern.

### Secrets: inherit Pitfall
`secrets: inherit` passes **all** secrets from the calling repo (frontend) to the reusable workflow (backend). If the frontend repo has a secret like `PR_PREVIEW_BACKEND_API_VERSION`, it will **override** the reusable workflow's `|| 'fallback'` defaults — even if the secret's value is stale. Always check for stale repo-level secrets when debugging environment variable issues in PR previews.
