# Resend calendar invite (frontend)

Lets a coach resend the calendar invite for a series or a one-off session from the session row's ⋮ menu. The backend contract and its decisions live in `refactor-platform-rs/docs/implementation-plans/resend-calendar-invite.md`. The manual test plan is `docs/test-plans/resend_calendar_invite_manual_testing.md`.

Branch: `resend-calendar-invite`. Built with the overseer/handoff workflow, one phase per commit.

## UI

- `coaching-sessions-row.tsx`: the item sits in the Share link group.
  - It's only for the coach; a coachee doesn't see it.
  - On a series session it reads "Resend series invite", otherwise "Resend invite". Icon: `MailPlus`.
  - It is enabled when the session's series still has a session ahead (`series.last_session_date` in the future). A one-off is enabled when the session itself is upcoming.
  - Otherwise it's disabled and shows the muted hint "No upcoming sessions". The hint is inline because Radix tooltips don't fire on disabled items.
- `coaching-sessions-card.tsx` keeps the resend state as a `closed | pending | sending` union, the same as the delete flow, and renders `ResendInviteDialog`.
- `resend-invite-dialog.tsx` is an AlertDialog. The title is "Resend series invite?" or "Resend invite?". The body says both people get a new invite. While sending, the action shows "Sending…" and Cancel is disabled.
- Toasts (sonner):
  - Success: "Invite sent to you and {coachee}".
  - 502: "Couldn't resend the invite".
  - 409 `legacy_series`: "This series can't be resent. You can resend this session instead.", with a "Resend this session" action.
  - 409 `no_upcoming_sessions`: "This series has no upcoming sessions."

## Data

- `EnrichedCoachingSession.series?: Option<CoachingSessionSeriesSummary>`, where the summary is `{ id, last_session_date: DateTime }`. The dashboard adds `series` to its `include`.
- `CoachingSessionSeriesApi.resendInvite(id)` and `CoachingSessionApi.resendInvite(id)` return `Result<void, ResendInviteError>`. The error is a `ResendInviteFailure` enum: `LegacySeries`, `NoUpcomingSessions`, `SeriesMember`, `Failed`.

## Phases

- [ ] F1: types, transform, the two API calls, dashboard include (Vitest + MSW)
- [ ] F2: row gating, dialog, card state, toasts, and an isolated Playwright spec using `page.route`
- [ ] V: live run of the manual test plan through Playwright MCP against the backend branch
