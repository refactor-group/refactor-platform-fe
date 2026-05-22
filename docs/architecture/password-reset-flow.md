# Password Reset Flow — Architecture & Design

User-initiated password reset for users who have forgotten their password. Cross-repo coordination with backend captured in the `password_reset_design_v1` thread and `PasswordResetEndpoints` v1 contract on the coordinator board (2026-05-13).

## Goals

- Allow a logged-out user to recover account access via email-based reset.
- Reuse the existing magic-link token infrastructure on the backend (no new token primitives).
- Match the existing `/setup/[token]` UX pattern so the visual and interaction language is consistent.
- Ship with strong security defaults — no enumeration vector, no token leakage, short-lived tokens.

## Non-goals (v1)

- Multi-device session invalidation on successful reset — deferred until the persistent session store migration. The existing `SessionCleanupProvider` handles graceful logout on `401` whenever this lands, so no FE code is required in v1.
- Per-IP rate limiting — BE ships with per-email DB-based limits only.
- Strength enforcement beyond length-and-confirm-match (e.g. zxcvbn scoring, common-password rejection, HaveIBeenPwned check) — still tracked in [#395](https://github.com/refactor-group/refactor-platform-fe/issues/395). Length policy itself (`12 ≤ length ≤ 128`, no complexity rules) is now enforced per the `password_policy` decision on the coordination board.
- Auto-login after successful reset — user is redirected to the login page to sign in fresh with the new password.

## User Flow

```
[Login page]                                       [Email inbox]
  │                                                       │
  │  click "Forgot password?"                             │  click "Reset your password"
  ▼                                                       ▼
[/forgot-password]  ──submit email──▶  (BE sends email)  [/reset-password/[token]]
  │                                                       │
  │  generic success: "If an account exists,             │  validate token (GET)
  │  we sent a link…"                                    │
  │                                                       ▼
  │                                                     [ready: "Hi {first_name}, set a new password"]
  │                                                       │
  │                                                       │  submit new password (POST)
  │                                                       ▼
  │                                                     [success: "Password updated. Sign in."]
  │                                                       │
  │                                                       │  click "Go to Sign In"
  └◀──────────────────────────────────────────────────────┘
                       [Login page — sign in with new password]
```

## Endpoints (Backend Contract `PasswordResetEndpoints` v1)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/password-reset/request` | Generate token, email reset link. **Always 200**, regardless of whether the email maps to a real user (enumeration-safe). 429 on rate-limit. |
| `POST` | `/password-reset/validate` | Non-destructive token validity check. **Token in JSON body** (v1.1 — see Security Decision 2a). Returns sanitized `{ first_name, last_name }` only — no email, role, or other PII. |
| `POST` | `/password-reset/complete` | Consume token + set new password. Returns updated user. Token is deleted atomically (single-use). |

Full request/response/error schemas live in `PasswordResetEndpoints` v1.1 on the coordinator board.

### Error Discriminators (Specific-Variant Pattern)

| Status | `error` string | When |
|---|---|---|
| 400 | `invalid_or_expired_token` | Token doesn't exist OR expired OR has wrong `purpose` — collapsed deliberately so attackers can't distinguish the cases |
| 422 | `validation_error` | `password !== confirm_password` on `/complete` |
| 429 | `password_reset_rate_limited` | More than 1 request/60s or 5 requests/24h per email on `/request` |

Type guards (`isInvalidOrExpiredTokenError`, `isPasswordResetRateLimitedError`) mirror the existing pattern from `src/types/goal.ts`.

## Frontend Architecture

### Routes

- **`/forgot-password`** — request flow. Single-form state machine: `idle` / `submitting` / `sent` / `error`.
- **`/reset-password/[token]`** — complete flow. Five-state machine mirroring `/setup/[token]`: `validating` / `ready` / `submitting` / `success` / `error`.

### Module layout

```
src/
├── app/
│   ├── forgot-password/
│   │   └── page.tsx                 # request form + sent confirmation
│   └── reset-password/
│       └── [token]/
│           └── page.tsx             # validate → reset form → success
├── components/ui/login/
│   └── user-auth-form.tsx           # MODIFIED: add "Forgot password?" link
├── lib/api/
│   └── password-reset.ts            # PasswordResetApi { request, validate, complete }
└── types/
    └── password-reset.ts            # request/response types, error type guards
```

### State machines

The complete-flow state machine follows the existing setup-flow discriminated union (`SetupPageState` in `src/types/magic-link.ts`):

```typescript
type PasswordResetPageState =
  | { kind: "validating" }
  | { kind: "ready"; firstName: string; lastName: string }
  | { kind: "submitting"; firstName: string; lastName: string }
  | { kind: "success" }
  | { kind: "error"; message: string };
```

Aligns with the project's nullable-type discipline (CLAUDE.md memory: prefer discriminated unions over `T | null`).

### Component Reuse

- **Two-column auth shell** — extract from `/setup/[token]/page.tsx` if not already shared; if shared, reuse directly.
- **Form input + error rendering** — match the inline-red-text pattern from setup page and login form.
- **`useLogoutUser` hook** — invoked on the **Sign-In click** from the `success` card (not on state transition) when the user is logged in. Clears the FE auth store + SWR cache and calls `router.replace("/")`. Handles the edge case where a logged-in user completes a reset (theirs or another account's). See Security Decision 9 for why this is click-driven rather than transition-driven.

### Password Policy

Mirrors the server-side `password_policy` decision exactly:

| Rule | Value | Client-side enforcement |
|---|---|---|
| Non-empty after trim | required | "Password cannot be empty or whitespace" |
| Min length | 12 characters (Unicode scalar values, not bytes) | "Password must be at least 12 characters" |
| Max length | 128 characters | "Password must be at most 128 characters" |
| Complexity (uppercase / digit / symbol) | NOT enforced — deliberately | — |

Length is counted via `[...password].length` to match the BE's Unicode-scalar counting (so 12 emoji counts as 12 characters, not ~48 bytes). On a server-side 422 the FE surfaces the BE's `message` verbatim — that way any future policy refinement on the BE is reflected without an FE patch.

## Security Decisions

This section is the load-bearing part of the doc. Each decision is recorded with its rationale and a pointer to where it's enforced.

### 1. Enumeration safety: always 200 on `/request`

**Decision:** `POST /password-reset/request` returns 200 regardless of whether the email maps to a real user. FE shows generic "If an account exists for that email, we sent a reset link" copy on success.

**Rationale:** Returning 404 for unknown emails would create a brand-new account-discovery oracle on a publicly-callable endpoint. Attackers mapping a coaching organization (scraping a website, brute-forcing names, etc.) would be able to confirm which emails belong to actual users. The existing login form is already enumeration-safe — returning generic "Invalid email or password" on 401 — so this preserves the platform-wide posture.

**Cost:** Slight UX loss — a user who typos their email gets a "we sent it" confirmation but never receives the email. Mitigated by clear copy: *"Check your inbox (and your spam folder)"* and *"The link expires in 30 minutes"*.

**Enforced at:** BE (`/password-reset/request` returns 200 in both code paths). FE displays generic copy regardless of response detail.

### 2. Token in path segment, not query string

**Decision:** Email link uses `https://app.example.com/reset-password/<raw_token>` — token in the URL path segment, not as `?token=<raw>` in the query string.

**Rationale:**

- **Server access logs** typically log query strings, but many web servers and reverse proxies log the full URL path too. Path-segment tokens aren't immune to log capture, but query-string tokens are *more* commonly logged by analytics and middleware that strip on path but preserve query.
- **Browser history** stores query strings; some browsers treat them differently for autocomplete.
- **Matches the existing `/setup/[token]` precedent** — the welcome email already uses path-segment token substitution (verified in backend `domain/src/emails.rs:198`).

**Enforced at:** BE email template (`{token}` placeholder substituted into path segment). FE route at `app/reset-password/[token]/page.tsx`.

### 2a. Token in request body on FE→BE validate, not query string (v1.1)

**Decision:** `POST /password-reset/validate` with `{ "token": "..." }` in the JSON body, **not** `GET ?token=<raw>`. v1 of the contract specified the query-string form; v1.1 (coordinator thread `password_reset_validate_token_transport`, 2026-05-14) corrected this.

**Rationale:** The same argument that drove Decision 2 (path-segment over query-string in the email URL) applies to the FE→BE call. A `GET ?token=<raw>` lands the raw reset token in:

- BE access logs (axum tower-http `TraceLayer` logs query strings by default, as do nginx/Caddy)
- any reverse-proxy / CDN access log between the FE host and the BE
- the browser's DevTools network history and `window.history`
- any error-reporting / APM integration that captures request URLs

JSON body transport bypasses every one of these in a single change. POST-for-a-non-mutating-read is a small REST-semantics tradeoff that's worth it for defense-in-depth and uniformity with `/request` and `/complete` (all three endpoints are now POST-with-body).

**Enforced at:** FE — `axios.post(BASE + "/validate", { token })` in [src/lib/api/password-reset.ts](../../src/lib/api/password-reset.ts). BE — handler takes `Json<ValidateParams>` instead of `Query<ValidateParams>`. Regression-guarded by [__tests__/lib/api/password-reset.test.ts](../../__tests__/lib/api/password-reset.test.ts): the validate spec asserts no `params` config is passed to axios.

### 3. Strict `Referrer-Policy: no-referrer` on token-bearing pages

**Decision:** Apply `Referrer-Policy: no-referrer` to both `/setup/:path*` and `/reset-password/:path*` via `next.config.mjs` `headers()` block.

**Rationale:** When a token is in the URL path, any outbound request from that page (to third-party fonts, CDNs, analytics, or even same-origin endpoints) sends the full referring URL — including the token — in the `Referer` HTTP header. That token then lives in third-party access logs.

The Next.js default policy (`strict-origin-when-cross-origin`) already strips the path from cross-origin `Referer` headers, so the threat is partially mitigated today. But:

1. The default isn't immutable; future browser changes or middleware could weaken it.
2. Same-origin requests still get the full path with token in `Referer` — a future addition of internal analytics or a logging beacon would capture the token.
3. Explicit security headers beat implicit defaults for auditability.

**`no-referrer`** is chosen over `same-origin` because it's strictly stronger (no `Referer` sent at all) and costs nothing — these pages don't load any third-party resources that need referrer for legitimate reasons. Pinned per-route (not site-wide) so other pages (OAuth flows, settings, dashboard) keep normal referrer behavior.

**Enforced at:** `next.config.mjs` `headers()` config. Asserted by an E2E test that fetches the page and checks the response header.

### 4. Short token TTL (30 minutes)

**Decision:** Reset tokens expire 30 minutes after issuance. (Backend-side config: `PASSWORD_RESET_TOKEN_EXPIRY_SECONDS=1800`.)

**Rationale:** Reset tokens grant the ability to change a password — the highest-value action in the auth system. The TTL window must be short enough that a leaked or intercepted token has limited useful lifetime. 30 minutes is short enough to limit damage but long enough that a user who clicked the link, walked away to brew coffee, and came back can still complete the flow. Setup tokens have a 24-hour TTL because the use case (new user onboarding via email) tolerates longer delays.

**Enforced at:** BE (`password_reset_token_expiry_seconds` config + token expiry check in domain layer). FE surfaces expired tokens as a uniform 400 error.

### 5. Single-use tokens with atomic consumption

**Decision:** Reset tokens are deleted from the database in the same transaction as the password update. A token cannot be used twice.

**Rationale:** Prevents replay attacks where a leaked token could be used multiple times. Also prevents race conditions: if a user clicks the email link twice (e.g., once on phone, once on desktop), one will succeed and one will see the uniform `invalid_or_expired_token` error.

**Enforced at:** BE domain transaction (`coaching_session_goal.rs`-style pattern — atomic delete + update).

### 6. Token purpose separation (`Setup` vs `PasswordReset`)

**Decision:** The `magic_link_tokens` table gains a `purpose` column. Tokens issued for account setup cannot be redeemed on the reset endpoint, and vice versa.

**Rationale:** Defense in depth. A leaked or stale setup token shouldn't grant password-reset capability (and vice versa). Without this, the token's secret material is the only thing distinguishing the two flows — a code-path mixup or future endpoint addition could create a confusion vulnerability.

**Enforced at:** BE migration adds the column with backfill to `Setup`; validation logic checks purpose match before allowing redemption. Mismatch → uniform `400 invalid_or_expired_token` (no leak of "wrong purpose" detail to attackers).

### 7. Error discriminator collapse on `/complete` and `/validate` (400 only)

**Decision:** Both endpoints return `400 invalid_or_expired_token` for **all** of: token doesn't exist, token expired, token has wrong purpose. The three sub-cases are deliberately indistinguishable from the wire.

**Rationale:** Distinct status codes (404 vs 401 vs 422) would let an attacker enumerate token validity by timing or status — even with a random token, the response code would reveal whether they hit a non-existent token vs an expired one. Collapsing them into one shape removes that oracle. The FE renders a single message (*"This reset link is invalid or has expired. Request a new one."*) because there's no actionable difference for the user either.

**Enforced at:** BE web layer maps three EntityErrorKind variants to the same `(400, "invalid_or_expired_token")` JSON. FE renders one message regardless.

### 8. Sanitized `/validate` response (first_name + last_name only)

**Decision:** `GET /password-reset/validate` returns `{ first_name, last_name }` only — not the full user object. No email, no role, no organization memberships, no other PII.

**Rationale:** The validate endpoint is unauthenticated and callable by anyone holding the token. Returning the full user shape would mean a leaked token grants a PII read on the account — including the email address (useful for further attacks like phishing). Returning just first/last name gives enough for the UI greeting (*"Hi Jane, set a new password"*) without exposing additional account detail.

**Enforced at:** BE controller projects user model down to the two-field response.

### 9. Force-logout on successful reset (click-driven, not transition-driven)

**Decision:** When the FE transitions to the `success` state on `/reset-password/[token]`, it shows the "Your password has been updated. Please sign in." card. **If the user was logged in**, clicking the "Go to Sign In" button invokes `useLogoutUser()`, which clears the auth store, SWR cache, and BE session cookie before redirecting to `/`. **If the user was logged out**, the same button is a plain `<Link>` to `/`.

**Rationale:** If a logged-in user (User A) completes a reset for a different account (User B, perhaps because A is helping B on a shared device), simply redirecting to login without clearing A's session would leave A signed in while B is expected to sign in fresh. Force-logout makes the post-reset state unambiguous: nobody is signed in, the user signs in with the new credentials.

This also closes a subtle session-coherence gap when the reset is for the currently-signed-in account: the old session cookie is invalidated alongside the password change, so the user can't accidentally keep using a session that was created under the old password.

**Why click-driven, not transition-driven:** An earlier draft invoked `logoutUser()` inside the `complete()` success path, before setting `pageState = "success"`. That had a bug — `useLogoutUser()` calls `router.replace("/")` in its `finally`, so the redirect fired before the success card could render, and the logged-in user never saw the confirmation. Click-driven preserves the success-card UI on both code paths (logged-in and logged-out), and matches the `/setup/[token]` precedent.

**Enforced at:** `handleSignIn` in [src/app/reset-password/[token]/page.tsx](../../src/app/reset-password/[token]/page.tsx). Regression-guarded by the page-state-machine tests in [__tests__/app/reset-password-page.test.tsx](../../__tests__/app/reset-password-page.test.tsx) — one test asserts the success card renders before any logout, another asserts logout fires only after the Sign-In click.

### 10. BE-side rate limiting (1/60s, 5/24h per email)

**Decision:** Backend enforces per-email rate limits on `/password-reset/request`. Exceeding either triggers `429 password_reset_rate_limited`.

**Rationale:** Without rate limiting, an attacker can flood a user's inbox with reset emails (annoyance + cover for phishing), or generate hundreds of valid tokens to brute-force the token space. Per-email is the minimum useful unit; per-IP would also help but is deferred to a follow-up. The FE renders the 429 with copy that's truthful but doesn't reveal the exact threshold.

**Enforced at:** BE checks the most recent token's `created_at` for the user. FE detects via `isPasswordResetRateLimitedError` type guard.

## Deferred Items & Follow-ups

- **Multi-device session invalidation** — will land with persistent session store. FE's existing `SessionCleanupProvider` will handle the post-invalidation 401 gracefully on other devices.
- **Per-IP rate limiting** — separate ticket, likely `tower_governor` middleware applied globally on BE.
- **Password strength rules** — [#395](https://github.com/refactor-group/refactor-platform-fe/issues/395). Will apply uniformly across setup, reset, and change-password flows.
- **Audit `/setup/[token]` for Referrer-Policy** — bundled into the same PR as this feature, since the same threat model applies and the fix is a one-line addition to the same config block.

## Test Plan

### Unit / Integration

- Type guards: `isInvalidOrExpiredTokenError`, `isPasswordResetRateLimitedError` — happy path + negative cases (wrong status, wrong discriminator, malformed body).
- Disambiguation suite: feed each error fixture through every parser, assert exactly one matches.
- API client: mocked-axios tests for `request`, `validate`, `complete` covering 200, 400, 422, 429, 503, network error.

### E2E (Playwright)

- Happy path: request → mock email (or token-from-test-fixture) → reset → land on login → sign in with new password.
- Invalid token path: navigate to `/reset-password/expired-token-123` → see error state → click "Request a new one" → land on `/forgot-password`.
- Password mismatch: ready state → submit non-matching passwords → see inline 422 validation message.
- Rate limit: trigger 429 → see rate-limit message.
- **Referrer-Policy assertion**: fetch `/reset-password/anytoken` and `/setup/anytoken`, assert response header `referrer-policy: no-referrer`.

### Manual

- Send a real reset email via dev BE, click link from a real email client (Gmail, Outlook), confirm token survives email-renderer rewriting.
- Verify `Referrer-Policy` header in browser DevTools on both token pages.

## References

- Coordinator board: `PasswordResetEndpoints` v1 contract (2026-05-13)
- Coordinator board: `password_reset_design_v1` question thread (2026-05-12)
- Coordinator board: `referrer_policy_token_pages` question thread (2026-05-13)
- Related issue: [#395 — Strengthen password rules](https://github.com/refactor-group/refactor-platform-fe/issues/395)
- Existing pattern: [src/app/setup/[token]/page.tsx](../../src/app/setup/[token]/page.tsx) — token-flow state machine to mirror
- Existing pattern: [src/types/goal.ts](../../src/types/goal.ts) — error type-guard convention
