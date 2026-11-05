# Test Plan: Manually Testing the New Session Dialog

Checks the stepped New session dialog: the shared StepDialog shell, schedule mode step by step (Who, When, Repeat, Resolve overlap) and submit, then move mode (Reschedule). Each part names the PR it covers; run a part against that layer or anything above it in the stack.

Results go in the PR for the layer under test, not in this plan.

## 1. Prerequisites

1. Backend on `:4000` from current `main`, started with email off: `RESEND_API_KEY=` and `SESSION_REMINDER_EMAIL_TEMPLATE_ID=` both blank, so no invites go out.
2. Frontend on the branch under test, `npm run dev` on `:3000`. Log in as the coach `PW_ORG_ADMIN_LOGIN_*` from `.env.local`.
3. Seed the coach's organization with five people the coach coaches:
   - **A**: a weekly series on Tuesdays at 2:30 PM, 50 min, including next Tuesday.
   - **B**: one session today, later than now.
   - **C**: two past sessions on the same weekday and time within the last 30 days, nothing upcoming.
   - **D**: last session 45 days ago, nothing upcoming (inactive).
   - **E**: no sessions (inactive).
4. Set the profile time zone to one that differs from the machine's (for example profile America/Chicago, OS Europe/London).
5. Theme switching: avatar menu › Appearance. Run every part in **both** Light and Dark unless the case says otherwise.
6. Narrow widths: DevTools device toolbar at 375×812, plus a desktop window 899px wide.
7. Forcing an error without changing data: in Chrome DevTools open **Network**, then **Block request URL**, and block the request the case names. Remove the block afterwards.

Open the dialog from the dashboard: **Add New › Coaching session**, or **Schedule a coaching session** on the empty Upcoming card.

## 2. Part A: shell and geometry (#524, checked through the dialog)

### Case A1: desktop geometry

At 1440×900, open the dialog.

**Pass:** an 860×560 dialog centered on a dim scrim. A white rail on the left titled "New session", a light grey pane on the right, and × top-right in a 36px circle.

### Case A2: fixed size

Step Who › When › Repeat and back with the arrows.

**Pass:** the dialog never changes size, and the footer (position and arrows) stays in the same place on every step. Both arrows always show: Previous is disabled on the first step and Next on the last.

### Case A3: short window

Resize the window to 1200×520.

**Pass:** the dialog height caps at the window height minus 48px. Only the step body scrolls, and the footer stays visible.

### Case A4: closing resets

Pick a person and a date, then close with Esc. Repeat with a scrim click and with ×.

**Pass:** each one closes. Reopening starts on Who with nobody selected and inactive people hidden.

### Case A5: focus

Press Tab repeatedly, then Shift+Tab.

**Pass:** focus stays inside the dialog, with a visible focus ring on every control, and Shift+Tab reverses.

### Case A6: narrow widths

Resize to 899px wide, then 375px.

**Pass:** a full-screen step view replaces the modal, never a shrunken modal. A 56px top bar reads "New session · 1 of 3" with a close button, every control is at least 44px tall, and the footer stays pinned. The round back button always shows and is disabled on the first step; a Next pill shows until the last step, where the confirm takes its place. Nothing scrolls sideways on any step. At 320px the calendar days are round, not ovals.

### Case A7: screen reader

Open the dialog with VoiceOver on.

**Pass:** it announces a dialog named "New session". Rail rows read as steps, with their values, and the current one is announced as the current step.

### Case A8: long values

Pick a person with a long name and a date like "Wednesday, September 30", at 1440px and at 375px.

**Pass:** rail values and person sub-lines wrap to at most two lines instead of being cut off with "…". The dialog keeps its size.

### Case A9: opening focus

Open the dialog with the mouse, then press Tab once.

**Pass:** no control shows a focus ring on open. The first Tab lands on the first control.

## 3. Part B: Who (PR 5)

### Case B1: active people

Look at the grid.

**Pass:** A, B and C show, D and E don't. Each card has a 36px avatar, the full name and a sub-line: "Usually Tuesdays, 2:30 PM" for A, "Usually {weekday}s, {time}" for C. No card says "coachee".

### Case B2: show everyone

Click the link under the grid.

**Pass:** it reads "Show everyone (+2 inactive)". Clicking it adds D and E, faded, with "Last session {date}" and "No sessions yet". The link becomes "Hide inactive", which hides them again.

### Case B3: search

With inactive people hidden, type D's first name.

**Pass:** D appears, faded, and the Show everyone link hides while the search has text. Clearing the search brings the link back.

### Case B4: picking

Pick A.

**Pass:** A's card turns white with a 20px accent check. The rail's Who row shows a green check and A's name. The rail footer reads "Scheduling will create", then "1 session with {A's first name}" and "Google Meet link included".

### Case B5: nobody to schedule

Log in as a coach with no people in this organization.

**Pass:** Add New has no Coaching session item, so the dialog can't open onto an empty grid.

### Case B6: order and sub-lines

Look at the order of the grid and each card's sub-line.

**Pass:** people with an upcoming session come first, soonest first, then people seen in the last 30 days. Someone with an upcoming first session and no history reads "First session {weekday}" (or "{Mmm D}" beyond a week). Someone active with no usual time reads "Last session {Mmm D}".

### Case B7: loading and errors

Throttle the network to Slow 3G and open the dialog. Then block `**/coaching_relationships**` and open it again.

**Pass:** grey placeholder cards while people load, never an empty grid. With the block, "Couldn't load the people you coach. Close and try again."

### Case B8: picking someone inactive

Search for an inactive person and pick them, then clear the search.

**Pass:** the pick works and stays selected after clearing the search; the rail and summary show them.

### Case B9: a series session moved on its own

Reschedule A's next session alone ("This session only") from Tuesday 2:30 PM to Wednesday 9:00 AM. Open the dialog and pick A, then go to When. Afterwards, reschedule that moved session to Thursday at 2:30 PM with "This and following sessions", then open the dialog again.

**Pass:** after the single move, A's card still reads "Usually Tuesdays, 2:30 PM", and When prefills A's next free Tuesday at 2:30 PM. One moved session never changes someone's usual time. On the way, Repeat has only Thursday selected (not Tuesday or Wednesday) and the confirm is enabled. After the series moves, the card reads "Usually Thursdays, 2:30 PM".

## 4. Part C: When (PR 5)

### Case C1: prefill

Pick C, then go to When.

**Pass:** the calendar selects the next date on C's usual weekday and the time is C's usual time, with its chip selected. Pick A instead (go back to Who): the date moves to next Tuesday and no time is selected, because A's own series session is there.

### Case C2: calendar header

Look at the calendar.

**Pass:** "{Mon} {year}" on the left, no Today pill on the current month, and ‹ › as 28px circles. Past days are grey and can't be clicked, and today has an accent tint.

### Case C3: month browsing

Pick a date, go › twice, then come back.

**Pass:** a Today pill appears on other months and jumps back. The selected date is highlighted again when you return. Past months show every day as past.

### Case C4: busy dots

Compare the dots with the dashboard for this month.

**Pass:** every day with any of your sessions, with anyone and in any organization, has a 4px accent dot.

### Case C5: day tooltip

Hover a dotted day for less than a third of a second and leave. Then hover and hold.

**Pass:** no tooltip on the short hover. On the long one, a dark tooltip above the day shows "{Ddd D}" and one row per session, sorted by start, with the name and "2:30 PM–3:20 PM". It doesn't block clicking the day. No tooltip at 375px.

### Case C6: the day's sessions

Pick a day with sessions, then an empty day.

**Pass:** under the calendar, "Already on {Weekday, Month D}" and one row per session, name left and time range right. On the empty day, "Nothing else on {Weekday, Month D}."

### Case C7: time chips

Look at the chips, then change the date, the person and the duration in turn.

**Pass:** at most five chips, in time order, none overlapping a session that day. Each change recalculates them.

### Case C8: overlap

Pick B, choose today, and type B's session time into the time field.

**Pass:** the note becomes a grey pill reading "Overlaps with {B}, {range} · Use {time} instead". The footer arrows don't move, the rail adds "Resolve overlap", and the position reads "2 of 4".

### Case C9: use the next free time

Click "Use {time} instead".

**Pass:** the time changes, the pill goes back to the list, Resolve overlap leaves the rail, and the position reads "2 of 3". Repeat with a session after 5 PM: the link offers the next free time that evening.

### Case C10: duration

Click 45, then + twice. Then type 7 and Tab, 400 and Tab, 52 and Tab.

**Pass:** 45 selects its chip, + makes 50 (chip selected), then 55 (no chip). 7 becomes 15, 400 becomes 180, and 52 becomes 50 with its chip selected.

### Case C11: default duration

Open the dialog fresh.

**Pass:** the duration starts at your profile's default session length.

### Case C12: time zone

With prerequisite 4 set, compare the chips, busy ranges and rail summary with the dashboard rows.

**Pass:** all show profile time zone times.

### Case C13: tooltip edges

Hover days with sessions in the Monday and Sunday columns, and a day with four or more sessions with long names, at 900px and 1440px.

**Pass:** the tooltip always shows in full, inside the window, never cut off by the dialog. It flips or shifts at the edges.

### Case C14: calendar keyboard

Tab into the calendar and use the arrow keys, then Enter.

**Pass:** one day is tabbable at a time; arrows move by day and week, across into the next or previous month; Enter picks the focused day. Past days are skipped.

### Case C15: which times are suggested

Have one past session at an odd time (say 12:01 AM) and two at another (say 7:30 AM).

**Pass:** the time used twice can show as a chip, even outside 9 AM to 5 PM; the one used once never does.

## 5. Part D: Repeat (PR 5)

### Case D1: repeat options

Click each of Doesn't repeat, Weekly, Every 2 weeks and Monthly.

**Pass:** one is selected at a time, and the rail's Repeats row follows.

### Case D2: weekdays

Choose Weekly.

**Pass:** the start date's weekday is selected and can't be cleared. Other days toggle.

### Case D3: ends

Choose After 8, then On a date about four months out.

**Pass:** the rail reads "Weekly, for 8 sessions" and the footer "8 sessions with {first name}". With the date, the footer's count matches the dates the series would land on.

### Case D4: invalid ends

Enter 0 sessions, then an end date before the start.

**Pass:** "Enter at least 1 session." and "End date must be on or after the first session.", one at a time, and the confirm is disabled. A count or end date far beyond a year says so without naming a limit.

### Case D5: the weekday follows the date

Choose Weekly, add Monday, then go back to When and move the date from a Thursday to a Friday.

**Pass:** Repeat now has Monday and Friday selected, not Thursday, and the confirm stays enabled.

### Case D6: every 2 weeks and monthly

Choose Every 2 weeks with an end date, then Monthly starting on the 30th.

**Pass:** Every 2 weeks: the footer's count matches every other week up to the end date. Monthly on the 29th to 31st: one inline message asking for the 28th or earlier, and the confirm is disabled.

### Case D7: several weekdays with an end date

Weekly on Tuesday and Thursday, ending on a date four weeks out.

**Pass:** the footer's count matches every Tuesday and Thursday from the start up to and including the end date.

## 6. Part E: Resolve overlap (PR 5)

### Case E1: the step

Overlap B's session (Case C8), then go to the last step.

**Pass:** "Resolve overlap", with "{B}'s session on {Ddd D} at {time} overlaps the new one. Move it to:". Day circles run Monday to Sunday of that week with past days dimmed, chips show only free 30-minute starts within 9 AM to 5 PM, and "Or keep both at {time}" sits below. The footer says "Pick a new time for {B}, or keep both." and there's no confirm yet.

### Case E2: moving

Pick another day, then a chip.

**Pass:** the rail reads "Move {B} to {Ddd D}, {time}" with a check, and the confirm appears.

### Case E3: keeping both

Click "keep both".

**Pass:** the rail reads "Keep both at {time}" with a check, and the confirm appears.

### Case E4: submit with a move

Move B's session and schedule.

**Pass:** the new session is created, B's session moves, and the toast reads "Scheduled · … · {B} moves to {Ddd D}, {time}". Both show on the dashboard without a reload.

### Case E5: the move fails

Block `PUT /coaching_sessions/*` and schedule with a move.

**Pass:** the new session is still created and confirmed, and an error toast says B's session didn't move. B's session stays where it was.

### Case E6: someone else's session

Overlap a session where you're the coachee.

**Pass:** no day circles or chips, only "Keep both at {time}". The footer reads "Keep both, or go back and pick another time." and the rail "Keep both or pick another time".

### Case E7: later clashes (known limit)

Make a weekly series whose third session clashes but whose first doesn't.

**Pass (for now):** no overlap is flagged and the series is created. This records a known limit, so a later fix flips this case.

### Case E8: switching days

On Resolve overlap, pick each day circle in turn.

**Pass:** the chips change to that day's free times; a past day can't be picked; the selected day stays highlighted.

### Case E9: a different clash resets the choice

Pick a move on Resolve, then go back to When and change the time so it clashes with a different session.

**Pass:** Resolve now names the new session and starts unresolved, with no leftover choice from before.

### Case E10: a new time or length on the same clash resets the choice

Overlap B's session, move B to a free chip on Resolve, then go back to When. Change the start time by 15 or 30 minutes so it still overlaps B. Then do it again, this time changing only the duration.

**Pass:** each time, the rail goes back to "Choose a new time for {B}" without a check, and Resolve starts unresolved: no chip is highlighted, the footer says "Pick a new time for {B}, or keep both." and there's no confirm. The chips are free times around the new time, so picking one and scheduling leaves no overlap between the new session and B's. The same goes for "keep both".

## 7. Part F: submit (PR 5)

### Case F1: one session

Schedule a single session with no overlap.

**Pass:** the 44px confirm reads "Schedule session". Enter on the last step submits it, but not while typing in the time field. The toast reads "Scheduled · {name} · {Weekday, Month D} · {time} · {n} min", the dialog closes and the dashboard updates.

### Case F2: a series

Schedule Weekly, after 8.

**Pass:** the confirm reads "Schedule 8 sessions". All 8 appear, and the series shows under the session's series actions.

### Case F3: double click

Double-click the confirm.

**Pass:** exactly one session or series is created.

### Case F4: errors

Try offline (block all requests), with Google disconnected (revoke it in Settings first), and in an archived organization.

**Pass:** one-line toasts: "Couldn't create the session · Check your connection and try again", then "Google Meet is disconnected · Reconnect it in Settings" with a redirect to Settings, then the archived-organization message. On the retryable ones the dialog stays open with your choices.

### Case F5: meeting line

Look at the rail footer with Google connected, Zoom connected, and neither.

**Pass:** "Google Meet link included", "Zoom link included", and no line.

### Case F6: more create errors

Make the create fail with a 502 (Meet link), a 403 and a 422 in turn (DevTools › Network › override the response, or block and use a test backend).

**Pass:** "Couldn't create the Google Meet link · Try again", the permission message, and "Couldn't create the session · Check the details and try again". The dialog stays open with your choices each time.

## 8. Part G: move mode (PR 6)

### Case G1: opening

On the dashboard, open a session row's menu › Reschedule, then the Upcoming card's Reschedule.

**Pass:** each opens "Reschedule session" for that session. The rail shows the person's avatar and name and "Currently {Ddd, Mmm D, h:mm A}". There's no Who step, the position reads "1 of 1", and the calendar, time and duration hold the session's current values.

### Case G2: no change yet

Look at the footer before changing anything.

**Pass:** "Pick a new date or time." and no confirm. The session's own day doesn't count it as busy, and its own time doesn't overlap.

### Case G3: moving

Pick another free day, keep the time, and confirm.

**Pass:** the confirm reads "Reschedule session". The toast reads "Rescheduled · {first name} to {Weekday, Month D}, {time}". The row moves without a reload. Open the session: it's the same session, with its notes and topics.

### Case G4: duration only

Change only the duration and confirm.

**Pass:** the session keeps its time and takes the new length. The toast reads "Updated · {first name} · {Weekday, Month D}, {time} · {n} min".

### Case G5: overlap

Move onto another session you coach, then resolve by moving that one.

**Pass:** "1 of 2", then Resolve overlap as in Part E. The toast ends "· {name} moves to {Ddd D}, {time}", and both sessions show in their new places.

### Case G6: a series session, this one only

Reschedule one session of a weekly series and go to Applies to.

**Pass:** "Applies to" with "{name}'s series repeats weekly on {weekday}s." and two 56px cards, "This session only" selected. Confirming moves only that session; the series' other sessions stay put.

### Case G6a: this and following

Reschedule the same series session to another weekday and pick "This and following sessions".

**Pass:** the title changes to "Reschedule series", and a Repeat step appears ("2 of 3"), prefilled with the series' rule: no "Doesn't repeat", the new weekday selected in place of the old one, and Ends counting this session and the ones after it. The confirm reads "Reschedule this and following" and the toast ends "· and following". That session and the later ones move to the new weekday and time, earlier ones don't, and the moved sessions keep their notes and topics.

### Case G6b: Edit series

Open a series session row's menu › Edit series, on an upcoming session and then on a past one.

**Pass:** each opens "Reschedule series" with "This and following sessions" already selected: on that session for the upcoming row, on the series' next upcoming session for the past one. Changing only Ends and confirming updates the rule without moving the dates, and the toast reads "Updated · {first name}'s series · {rule}".

### Case G6c: this and following, no change hint

Open Edit series and look at the last step before changing anything.

**Pass:** no "Pick a new date or time." hint; the confirm "Reschedule this and following" is available, because changing only the rule is allowed. The rail shows Applies to and Repeats rows.

### Case G6d: the series splits

Use this and following on the third session of a four-session series.

**Pass:** the first two sessions stay where they were and keep their series; the third and fourth move and now belong to a new series (View series on each shows the right rule). The dashboard updates without a reload.

### Case G6e: later sessions with content

Add a topic to the last session of a series. Then Edit series on an earlier one and lower Ends so that session would be dropped.

**Pass:** "Some later sessions have notes or actions · Keep enough sessions to cover them", the dialog stays open, and nothing in the series changes.

### Case G6f: Edit series with nothing upcoming

Open Edit series on a past session of a series that has ended. Then block `GET /coaching_session_series/*` and open Edit series on a past session again.

**Pass:** "This series has no upcoming sessions", and no dialog. With the block, "Couldn't load the series · Try again".

### Case G6g: other this and following errors

Block `POST /coaching_session_series/*/reschedule`, then make it return a 422.

**Pass:** "Couldn't update the session · Check your connection and try again", then "Couldn't update the session · Check the details and try again". The dialog stays open each time.

### Case G6h: a series that repeats every few weeks or months

The dialog can't create these, so make them through the API: a weekly series every 3 weeks and a monthly series every 2 months. Open Edit series on each, change only Ends and confirm. Then open Edit series on the every-3-weeks series again, pick Weekly and confirm.

**Pass:** the Repeat step offers the series' own rhythm as an extra choice ("Every 3 weeks", "Every 2 months"), selected, and the rail reads "{rhythm}, for {n} sessions". After the first confirm each series keeps its rhythm (View series shows the same rule, and the dates keep their spacing). Picking Weekly drops the extra choice's selection and turns the series weekly. A weekly series every 2 weeks shows the usual "Every 2 weeks" choice, not an extra one.

### Case G6i: the series hasn't loaded

In DevTools, throttle `GET /coaching_session_series/*` to Slow 3G and open Edit series, then block it and reschedule a series session.

**Pass:** while it loads, the last step says "Loading the series…" and there's no confirm. With the block, Applies to reads "Couldn't load the series, so only this session can change.", "This and following sessions" is disabled, "This session only" is selected, and confirming moves only that session. Edit series opened under the block also falls back to this session only.

### Case G6j: sessions changed on their own keep their changes

Create a weekly series of 5 (say Thursdays 6:00 PM, 60 min). Reschedule three of them with "This session only":
- the 3rd to the next day, same time;
- the 4th to 90 min, same date and time;
- the 5th to the next day at another time, and 30 min.

Then open Edit series on the 1st and change only Ends from 5 to 6.

**Pass:** no "Rescheduling will" summary in the rail, since nothing moves. After confirming, the toast reads "Updated · {first name}'s series · Weekly, for 6 sessions". No session moves or changes length: the 3rd and 5th stay on their own days, and the 4th and 5th keep 90 and 30 min. A 6th session appears a week after the last Thursday.

### Case G6k: the summary of the move

On the same series, open Edit series on the 2nd session and set 4:00 PM and 45 min.

**Pass:** the rail footer reads "Rescheduling will" / "Move this and following sessions to Thursdays, 4:00 PM". After confirming:

| Session | After |
|---|---|
| 1st | unchanged |
| 2nd | Thursday 4:00 PM, 45 min |
| 3rd | its own day at 6:00 PM, 45 min |
| 4th | Thursday 4:00 PM, 90 min |
| 5th | its own day and time, 30 min |
| 6th | Thursday 4:00 PM, 45 min |

### Case G6l: when the summary shows

Open Edit series and change nothing. Change the time. Pick "This session only" on Applies to, then "This and following sessions" again. Pick another weekday on Repeat.

**Pass:**
- No summary until something would move. It appears once the time changes.
- With "This session only" there's no summary and the title reads "Reschedule session".
- Back on "This and following sessions", the title reads "Reschedule series" and the summary returns.
- The summary's weekdays follow the Repeat step.

### Case G7: errors

Block `PUT /coaching_sessions/*` and confirm.

**Pass:** "Couldn't update the session · Check your connection and try again", and the dialog stays open with your choices.

### Case G8: who can reschedule

Look at past sessions, and log in as the coachee.

**Pass:** neither shows Reschedule.

### Case G9: move mode on a phone

At 375px, reschedule a series session through each step: When, Applies to, Repeat, Resolve overlap.

**Pass:** the person and "Currently …" show at the top of the body; the Applies to cards fill the width with readable text; nothing scrolls sideways; the footer stays pinned.

## 9. Part H: copy and theme sweep (PR 5, PR 6, PR 7)

### Case H1: copy

Read every string in the dialog, in both modes.

**Pass:** "session", never "call"; "series", never "term"; "person" or "people", never "coachee". No em dashes, and no limits or ids.

### Case H2: dark mode

Go through every step in Dark.

**Pass:** the rail's current row, rail border, scrim, tooltip, Applies to cards and toast use the dark tokens, with no white flashes. The tooltip is inverted like the toast.

### Case H3: reduced motion

Turn on reduced motion in the OS.

**Pass:** no open or close animation.

### Case H4: screen reader on the step controls

With VoiceOver, go through Applies to, Repeat and Resolve overlap.

**Pass:** the Applies to cards read as a radio group with their title and description; frequency chips and weekday circles announce pressed or not pressed; the sessions count and end date fields have names; the Resolve day circles read the full date.
