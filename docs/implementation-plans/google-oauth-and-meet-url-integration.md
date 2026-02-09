# Google OAuth Account Linking & Google Meet URL Management

## Context

The Refactor Coaching Platform needs Google integration to support AI-powered session transcription via recall.ai. A recall.ai bot must join each coaching session's Google Meet to record and transcribe. This requires:

1. **Google OAuth account linking** (NOT login SSO) — coaches connect their Google account to grant the platform Calendar/Meet API access. The backend stores OAuth refresh tokens and uses them for recall.ai bot orchestration.
2. **Google Meet URL per coaching relationship** — each coach-coachee pair gets a stable Meet link that the recall.ai bot joins for every session.

This is a **frontend-only plan**. The backend (`refactor-platform-rs`) is being built in parallel with two new crates:
- **`meeting-auth`** — centralized OAuth + API key authentication (Google, future Zoom), token storage with AES-256-GCM encryption, PKCE, per-user refresh locking
- **`meeting-manager`** — meeting CRUD operations receiving pre-authenticated tokens via `MeetingClient` trait

Backend plan reference: `docs/implementation-plans/meeting-and-auth-abstraction-layers.md` in `refactor-platform-rs`.

---

## Files Created

| File | Purpose |
|------|---------|
| `src/types/oauth-connection.ts` | `GoogleOAuthConnectionState`, `GoogleOAuthConnectionStatus` enum, type guard |
| `src/types/meeting-space.ts` | `MeetingSpace` interface mirroring backend `meeting-manager` `Space` struct |
| `src/lib/api/oauth-connection.ts` | `GoogleOAuthApi` object + `useGoogleOAuthConnectionStatus()` SWR hook |
| `src/lib/api/meetings.ts` | `MeetingApi` object with `createGoogleMeet()` |
| `src/app/settings/layout.tsx` | Settings layout (AppSidebar + in-page settings nav + content) |
| `src/app/settings/page.tsx` | Redirect to `/settings/integrations` |
| `src/app/settings/integrations/page.tsx` | Integrations page with OAuth callback result handling |
| `src/components/ui/settings/settings-nav.tsx` | In-page settings nav (sidebar on desktop, horizontal tabs on mobile) |
| `src/components/ui/settings/google-integration-section.tsx` | Main integration UI: connect/disconnect + Meet URL management |
| `src/components/ui/settings/google-disconnect-dialog.tsx` | AlertDialog for disconnect confirmation |
| `src/components/ui/settings/meet-url-field.tsx` | Per-relationship Meet URL field (paste or create) |
| `src/components/ui/coaching-sessions/join-meet-link.tsx` | Ghost icon button (Video icon + tooltip) on coaching session page |

## Files Modified

| File | Change |
|------|--------|
| `src/types/coaching-relationship.ts` | Add optional `meet_url?: string` to `CoachingRelationship` interface |
| `src/lib/api/coaching-relationships.ts` | Implement the `update` method (currently throws) |
| `src/components/ui/user-nav.tsx` | Wire existing "Settings" dropdown item to link to `/settings` |
| `src/app/coaching-sessions/[id]/page.tsx` | Add `JoinMeetLink` next to `ShareSessionLink` |

---

## OAuth Flow

The OAuth flow is entirely handled by the backend via browser redirects:

```
[Frontend]                    [Backend]                     [Google]
    |                            |                             |
    |-- navigate to ------------>|                             |
    |   /api/oauth/google/       |                             |
    |   authorize                |                             |
    |                            |-- generate PKCE + state --> |
    |                            |   store in session          |
    |                            |                             |
    |<-- 302 redirect -----------|                             |
    |   to Google consent URL    |                             |
    |                            |                             |
    |-- follow redirect ---------|-------------------------->  |
    |                            |                    consent  |
    |                            |<-- 302 callback ----------- |
    |                            |   ?code=xxx&state=yyy       |
    |                            |                             |
    |                            |-- validate state            |
    |                            |-- exchange code (PKCE)      |
    |                            |-- encrypt & store tokens    |
    |                            |   in oauth_connections      |
    |                            |                             |
    |<-- 302 redirect -----------|                             |
    |   /settings/integrations   |                             |
    |   ?google_connected=true   |                             |
```

The frontend "Connect" button simply does: `window.location.href = backendUrl + "/oauth/google/authorize"`

---

## Implementation Order

1. Types (`oauth-connection.ts`, `meeting-space.ts`, modify `coaching-relationship.ts`)
2. API layer (`oauth-connection.ts`, `meetings.ts`, modify `coaching-relationships.ts` update method)
3. Settings page structure (layout, nav, redirect page)
4. Google integration UI (section, meet-url-field, disconnect dialog, integrations page)
5. Coaching session "Join Meeting" link
6. Navigation wiring (user-nav Settings link)
7. MSW handlers + test data factories
8. Unit tests
9. Integration tests
