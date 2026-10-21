# Test Plan: Manually Testing Resend Calendar Invite

Checks that a coach can resend the calendar invite for a series or a one-off session from the session row's ⋮ menu. The item has to be gated correctly, and the resent invite has to leave each calendar with exactly the sessions the app has: no duplicates, moved sessions at their new time, deleted sessions gone. The plan also covers the legacy-series, finished-series and failure paths. Part D checks that series keep the coach's local time across a daylight saving change, in the app and in Google Calendar.

Backend counterpart: `refactor-platform-rs/docs/test-plans/ics-calendar-invites-manual-test-plan.md` (section H covers the same daylight saving cases from the backend side).

> [!IMPORTANT]
> Start the backend with `SESSION_REMINDER_EMAIL_TEMPLATE_ID=` (blank). Otherwise the reminder job mails every participant with a session in the next day, including real coachees in other relationships.
>
> This plan sends **real email**. The only recipients allowed are `jim@refactorgroup.com` (coach) and `james.hodapp@gmail.com` (coachee), in relationship `7adf81aa-23f4-4221-9f82-afb4a5f7512e`. Before any step marked ✉, confirm that the relationship's coach and coachee are still exactly those two addresses. Each ✉ shows how many emails the step sends. Parts B and C send about 8, Part D about 10, and the cleanup about 6.

## 1. Prerequisites

1. Backend on the branch under test on `:4000`, migrations applied, with the session/recurring "scheduled", "rescheduled" and "cancelled" template ids set. Keep `RESEND_API_KEY` **unset** while building the fixtures in step 4, so they send no email. Set it and restart the backend before Part B.
2. Frontend on the branch under test, `npm run dev` on `:3000`.
3. Logins: the coach is `PW_ORG_ADMIN_LOGIN_*` and the coachee is `PW_USER_LOGIN_*`, both from `.env.local`.
4. Fixtures, created in the coach's browser with email off:
   1. A weekly series of 6 sessions in the relationship above, starting next week. Neither calendar has it, which is the "lost invite" case.
   2. Reschedule occurrence 3 of that series by one day.
   3. Delete occurrence 4 of that series.
   4. A one-off session for tomorrow.
5. If creating a one-off session through the app fails locally (it needs the collab document server), insert the one-off fixtures through SQL as well.
6. Fixtures created through SQL (no email):
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
- The toast reads "Invite sent to you and <coachee's name>".
- Both inboxes get the "recurring sessions scheduled" email with an `invite.ics` attachment titled "James / Jim".
- After accepting in Google Calendar, there is one series. Occurrence 3 is at its moved time and occurrence 4 is gone.

### Case B3: ✉×2 resend after accepting

Once B2 has been accepted, resend the series again.

**Pass:** each calendar updates the existing series. No second copy appears in either calendar.

### Case B4: ✉×2 one-off resend

Use "Resend invite" on the one-off fixture.

**Pass:** one `POST /coaching_sessions/:id/resend_invite`, answered 204, and a success toast. Each calendar shows one event for it, not two.

## 4. Part C: refusals

### Case C1: ✉×2 legacy series

Use "Resend series invite" on a session of the legacy series.

**Pass:** the response is 409, and the toast reads "This series can't be resent. You can resend this session instead." with a "Resend this session" action. Pressing the action sends `POST /coaching_sessions/:id/resend_invite`, which is answered 204, and a standalone invite for that session arrives.

### Case C2: API refusals

In the coach's page, `fetch` `POST /coaching_session_series/<finished id>/resend_invite`. In the coachee's page, `fetch` `POST /coaching_session_series/<active id>/resend_invite`.

**Pass:** 409, then 403. No email.

### Case C3: email unavailable

Run this before Part B, while `RESEND_API_KEY` is still unset. Resend the active series.

**Pass:** the response is a 5xx (500 for missing config; a provider refusal would be 502). The toast reads "Couldn't resend the invite". No email arrives, and the coach can try again.

## 5. Part D: daylight saving

Series must repeat at the coach's local clock time on both sides of a daylight saving change, in the app and in every calendar, and single-session changes after the change must land on the right calendar occurrence.

**Setup:** set the coach's profile timezone to `America/Chicago` (it is `UTC` in local dev), and note the original value so you can restore it. Use the next US daylight saving change after today as "the change". For example, Nov 1, 2026 is a fall-back change and Mar 14, 2027 is a spring-forward change. Pick series dates so that occurrences fall on both sides of it. Calendar checks happen in the coachee's Google Calendar, viewed in Central time.

### Case D1: ✉×2 weekly series across the change

As the coach, create a weekly series on Thursdays at 11:00 AM, with occurrences on both sides of the change. Accept the invite in the coachee's Google Calendar ("All events").

**Pass:**
- In the app, every occurrence shows 11:00 AM, both before and after the change. None shows 10:00 AM or 12:00 PM.
- In Google, every occurrence is at 11:00 AM and the dates match the app one for one.

### Case D2: ✉×2 move an occurrence after the change

Reschedule one occurrence that falls after the change to 1:00 PM the same day.

**Pass:** in Google, that occurrence moves to 1:00 PM, the original 11:00 AM slot is empty, and the rest of the series is unchanged.

### Case D3: ✉×2 delete an occurrence after the change

Delete a different occurrence that falls after the change.

**Pass:** in Google, that occurrence is gone and the rest of the series is unchanged.

### Case D4: ✉×2 snapshot resend

Resend the series from the ⋮ menu. Accept it again if asked.

**Pass:** Google still shows one series. The D2 move and the D3 deletion are both in place, and every other occurrence is at 11:00 AM on both sides of the change.

### Case D5: ✉×2 evening series

Create a weekly series on Thursdays at 7:00 PM. In UTC that is early Friday morning.

**Pass:** the series is created without an error. In the app and in Google, every occurrence is on a Thursday at 7:00 PM, on both sides of the change.

### Case D6: monthly series after the 28th is blocked

Start creating a monthly series whose first session is on the 30th of a month.

**Pass:** the form shows "Monthly sessions can't start on the 29th, 30th or 31st. Pick the 28th or earlier." and the submit button stays disabled. Changing the date to the 28th clears the message. No request is sent.

**Afterwards:** restore the coach's original profile timezone.

## 6. Cleanup

✉ Delete the remaining test series and sessions from the dashboard: "Delete series" on each series and "Delete session" on each one-off. This also checks that cancellations reach the calendar.

**Pass:** each upcoming series and one-off sends one cancellation to each participant, and Google removes those events. Past sessions send nothing. Remove any fixture the dashboard can't reach with SQL.
