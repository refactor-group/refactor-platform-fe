# Test Plan: Manually Testing Resend Calendar Invite

Checks that a coach can resend the calendar invite for a series or a one-off session from the session row's ⋮ menu. The item has to be gated correctly, and the resent invite has to leave each calendar with exactly the sessions the app has: no duplicates, moved sessions at their new time, deleted sessions gone. The plan also covers the legacy-series, finished-series and failure paths.

Backend counterpart: `refactor-platform-rs/docs/implementation-plans/resend-calendar-invite.md`.

> [!IMPORTANT]
> This plan sends **real email**. The only recipients allowed are `jim@refactorgroup.com` (coach) and `james.hodapp@gmail.com` (coachee), in relationship `7adf81aa-23f4-4221-9f82-afb4a5f7512e`. Before any step marked ✉, confirm that the relationship's coach and coachee are still exactly those two addresses. Each ✉ shows how many emails the step sends. The whole plan sends about 16.

## 1. Prerequisites

1. Backend on `resend-calendar-invite` on `:4000`, migrations applied. `.env` must have the Resend API key and the session/recurring "scheduled", "rescheduled" and "cancelled" template ids.
2. Frontend on `resend-calendar-invite`, `npm run dev` on `:3000`.
3. Logins: the coach is `PW_ORG_ADMIN_LOGIN_*` and the coachee is `PW_USER_LOGIN_*`, both from `.env.local`.
4. Fixtures, created in the coach's browser:
   1. ✉×2 A weekly series of 6 sessions in the relationship above, starting next week. Don't accept it in either calendar.
   2. ✉×2 Reschedule occurrence 3 of that series by one day.
   3. ✉×2 Delete occurrence 4 of that series.
5. Fixtures created through SQL (no email):
   1. A **finished series**: a series whose sessions are all in the past.
   2. A **legacy series**: a series with at least one upcoming session whose members have `ical_recurrence_id` set to NULL.

## 2. Part A: who sees the item

### Case A1: coachee

Sign in as the coachee. Open ⋮ on a series row and on a one-off row.

**Pass:** neither menu has a resend item.

### Case A2: coach

Sign in as the coach. Open ⋮ on an upcoming series session, an upcoming one-off, a past one-off, and a session of the finished series.

**Pass:** "Resend series invite" is enabled on the upcoming series session and "Resend invite" is enabled on the upcoming one-off. The past one-off and the finished-series session both show the item disabled, with "No upcoming sessions" under it.

## 3. Part B: the dialog

### Case B1: cancel sends nothing

Open "Resend series invite" and press Cancel.

**Pass:** no `resend_invite` request appears in the network log and no email arrives.

### Case B2: ✉×2 series resend

Open "Resend series invite" again and double-click Resend invite.

**Pass:**
- Exactly one `POST /coaching_session_series/:id/resend_invite`, answered 204.
- While the request is in flight, the action shows "Sending…" and Cancel is disabled.
- The toast reads "Invite sent to you and James".
- Both inboxes get the "recurring sessions scheduled" email with an `invite.ics` attachment titled "James / Jim".
- After accepting in Google Calendar, there is one series. Occurrence 3 is at its moved time and occurrence 4 is gone.

### Case B3: ✉×2 resend after accepting

Once B2 has been accepted, resend the series again.

**Pass:** each calendar updates the existing series. No second copy appears in either calendar.

### Case B4: ✉×4 one-off resend

Create a one-off session for tomorrow (✉×2), then use "Resend invite" on it (✉×2).

**Pass:** one `POST /coaching_sessions/:id/resend_invite`, answered 204, and a success toast. Each calendar shows one event for it, not two.

## 4. Part C: refusals

### Case C1: ✉×2 legacy series

Use "Resend series invite" on a session of the legacy series.

**Pass:** the response is 409, and the toast reads "This series can't be resent. You can resend this session instead." with a "Resend this session" action. Pressing the action sends `POST /coaching_sessions/:id/resend_invite`, which is answered 204, and a standalone invite for that session arrives.

### Case C2: API refusals

In the coach's page, `fetch` `POST /coaching_session_series/<finished id>/resend_invite`. In the coachee's page, `fetch` `POST /coaching_session_series/<active id>/resend_invite`.

**Pass:** 409, then 403. No email.

### Case C3: provider failure

Unset the recurring "scheduled" template id in the backend `.env` and restart the backend. Then resend the active series.

**Pass:** the response is 502 and the toast reads "Couldn't resend the invite". No email arrives. Restore the template id afterwards.

## 5. Cleanup

Delete the test series, sessions and fixtures through SQL. Don't use the API delete routes, which send cancellation emails.
