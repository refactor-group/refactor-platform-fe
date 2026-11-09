# Test Plan: Manually Testing the Dashboard Week Grid

This plan checks the dashboard week grid, which replaces the Coaching Sessions card. Each part names the PR it covers. Run a part against that PR, or against anything stacked above it. Part 9 is the end-to-end pass, run once everything has merged.

Results go in the PR for the layer under test, not in this plan.

## 1. Prerequisites

1. **Backend:** run it on `:4000` from the branch the part needs. That's `main`, unless the part names a backend PR.
   - Start it with email off: `RESEND_API_KEY=` and `SESSION_REMINDER_EMAIL_TEMPLATE_ID=` both blank.
   - Part 8 and step 5 of Part 9 need email on. Use only the coach's own Jim→Jim relationship there, so no real coachee receives mail.
2. **Frontend:** check out the branch under test and run `npm run dev` on `:3000`.
3. **Logins** (`PW_*_LOGIN_*` in `.env.local`). Clear cookies and localStorage between logins.
   - **Coach:** coaches four or more people.
   - **Mixed:** coaches at least one person and is coached by someone.
   - **Coachee only:** has one coach and coaches nobody.
4. **Seed the coach's current organization** relative to the current week (Monday to Sunday in the coach's profile time zone):

   | Person | Sessions | Topics |
   | --- | --- | --- |
   | **A** | A weekly series on Tuesdays at 2:30 PM, 50 min, covering last week through four weeks out | None on this week's session |
   | **B** | One session today, starting 40 minutes from when you run the part | None |
   | **C** | One session this Thursday at 10:00 AM | 3 topics |
   | **D** | One session earlier this week (a past day) | 2 topics |
   | **E** | Last session 45 days ago, nothing upcoming (inactive) | |
   | **F** | One session six weeks from now; no other sessions after this week | |

   Also make sure no session for anyone exists more than eight weeks back. That lets the left arrow reach its end.
5. **Time zone:** set the profile time zone to one that differs from the machine's, for example profile America/Chicago and OS Europe/London.
6. **Theme:** run every visual case in both Light and Dark (avatar menu › Appearance).
7. **Widths:**
   - desktop at 1440×900 and 1024×768;
   - 1023px wide;
   - a phone at 390×844 (DevTools device toolbar);
   - a real phone for Part 6.
8. **Forcing an error:** DevTools › Network › Block request URL. Remove the block afterwards.

## 2. Part 1: Static grid (PR 1)

### Case 1.1: the grid replaces the sessions card

Open the dashboard as the coach.

**Pass:**
- Below the Upcoming Session and Goals cards, a white panel titled **This week** shows the range, for example "Aug 17 – 23".
- The old Coaching Sessions card is gone: no Upcoming or Previous tabs, no buckets, no hover preview.

### Case 1.2: days and today

**Pass:**
- Seven equal columns, Monday through Sunday.
- Today's column is tinted, and its date number sits in a filled accent pill.
- Day labels before today are faded.
- An empty day shows a dashed placeholder.

### Case 1.3: every session once, on the right day and time

**Pass:**
- A's Tuesday, B today, C Thursday and D's earlier day each appear once, in the right column.
- Times match the profile time zone, not the machine's.
- Within a day, cards sort by start time.

### Case 1.4: subline

**Pass:** the subline reads "N sessions · M today", with the right counts. When no session falls today, there's no " · 0 today".

### Case 1.5: card contents

**Pass:**
- **B:** pulsing dot and "in 40 min · No topics yet" (or close to it), with "No topics yet" in amber, plus a **Prepare** pill.
- **C:** "3 topics" and a green **✓ Ready** pill, the same shape as Prepare, that opens the session.
- **A** (when more than 2 hours away): **No topics yet** in amber, plus Prepare.
- **D:** grey background with no shadow, faint time, muted name, "2 topics", and **Done**.

### Case 1.6: live note updates

Leave the dashboard open for two minutes.

**Pass:** B's "in N min" counts down without a reload.

### Case 1.7: context menu on an upcoming card

Right-click C's card.

**Pass:**
- The menu shows Open session, Reschedule…, Share link, Resend invite, **Cancel session…**.
- On A's card, it also shows View series, Edit series… and **Cancel series…**.
- Every item opens the dialog or action it opens today.
- The word "Delete" appears nowhere.

### Case 1.8: Cancel session

Choose Cancel session… on C's card.

**Pass:**
- The dialog reads "Cancel this coaching session?", with the buttons **Cancel session** and **Keep session**.
- **Keep session** closes the dialog and changes nothing.
- **Cancel session** removes the card, and the toast reads "Cancelled …".

### Case 1.9: Remove a past session

Right-click D's card.

**Pass:**
- The menu shows Open session and **Remove session…** only.
- The dialog reads "Remove this coaching session?". It says notes and actions go too, with **Remove session** and **Keep session**.
- Confirming removes the card, and the toast reads "Removed …".

### Case 1.10: keyboard opens the menu

Tab to a card and press the Menu key, or Shift+F10.

**Pass:** the same menu opens, with focus on its first item. Esc closes it and returns focus to the card.

### Case 1.11: discoverability

Ask someone who hasn't seen this plan to cancel C's session from the dashboard.

**Pass:** note whether they find the right-click menu, and how long it takes. Record it in the PR; it decides whether a ⋮ button is added.

### Case 1.12: interim narrow layout

At 1023px and at 390px.

**Pass:** columns stack vertically, one day per row. Nothing scrolls sideways.

### Case 1.13: loading and error

Reload with the user sessions request blocked.

**Pass:** the panel shows an error state with a retry, not an empty week. Unblock it and retry: the week loads.

### Case 1.14: now line

On the current week, look at today's column, then wait a minute.

**Pass:**
- A thin brand line with the current time sits between the sessions that have started and those still to come. Before any session it sits on top, and after the last one it sits at the bottom.
- The time on it advances without a reload.
- No other day or week shows it.
- On a phone, today's agenda shows the same line.

## 3. Part 2: Navigation and scheduling (PR 2)

### Case 2.1: paging

Click next, then previous.

**Pass:**
- Titles read Next week, This week, Last week, then "Week of …".
- The range is right, including "Aug 31 – Sep 6" across months.
- The range crosses a month boundary at least once.

### Case 2.2: This week

Page away, then click **This week**.

**Pass:** it returns to the current week. Its label is faint while on the current week and dark when away.

### Case 2.3: arrow ends

As the coach, page back until the previous arrow disables, then page forward ten weeks past F's session.

**Pass:**
- Previous disables on the week holding the earliest session.
- Next never disables for the coach, so any future week can be reached.

### Case 2.4: Schedule session

Click **Schedule session**.

**Pass:** the New session dialog opens on Who, with no day preset.

### Case 2.5: empty day from today on

Hover an empty day from today on, in this week and in a week two or more weeks ahead, then click it.

**Pass:**
- On hover, the dashed border turns lavender and "+ Schedule" appears.
- The click opens the dialog on Who. After a person is picked, When shows that day.

### Case 2.6: empty days that aren't schedulable

Hover a past empty day of this week, and an empty day of last week.

**Pass:** no hover affordance, and a click does nothing.

### Case 2.7: a click opens any session

Click C's card (upcoming), then come back and click D's (past), then B's while it's under way.

**Pass:** each single click opens that session's page straight away. No dialog opens, nothing reschedules, and there's no delay.

### Case 2.8: rescheduling from a card

Right-click C's card and choose **Reschedule…**. Do the same on A's card.

**Pass:**
- The dialog opens in Reschedule mode, prefilled with C's day, time and length.
- On A, the series card, its Applies to step offers "this session" or "this and following".

### Case 2.9: keyboard

Tab to a card and press Enter.

**Pass:** the session opens, the same as a click.

### Case 2.10: after rescheduling

Reschedule C to Friday through the dialog.

**Pass:** the card moves to Friday without a reload.

### Case 2.11: a session that ended earlier today

Use a session from earlier today that has already ended.

**Pass:**
- It still looks past (grey, with Done).
- It drags on desktop or offers Move on a phone.
- Its menu has every item, including **Cancel session…**, and the dialog asks "Cancel this coaching session?".
- A session from yesterday stays locked: Open session and Remove session… only.

## 4. Part 3: Prepare and readiness (PR 3)

### Case 3.1: Prepare pill

Click **Prepare** on A's card.

**Pass:** the session page opens. Neither the reschedule dialog nor a drag starts.

### Case 3.2: becoming Ready

Add a topic to A's session on that page, then go back to the dashboard.

**Pass:** A's card now reads "1 topic" and **✓ Ready**.

### Case 3.3: other weeks

Page to next week.

**Pass:** upcoming cards there show Ready or Prepare by their own topics, and Prepare works.

## 5. Part 4: Filter (PR 4)

### Case 4.1: popover

Click **All sessions**.

**Pass:**
- The popover shows a "Find a person" search, an "All sessions" row with a check, then **Coachees** (A, B, C, D, F) and **Inactive** (E, muted).
- The footer note is there.

### Case 4.2: search

Type part of C's name, then a name that matches no one.

**Pass:** the list narrows to C. With no match, it reads "No one matches."

### Case 4.3: selecting a person

Select C.

**Pass:**
- The pill reads C's name, and a removable chip appears in the subline.
- Other cards fade to about a quarter opacity and keep their places.
- The subline counts only C's sessions.

### Case 4.4: empty filtered week

With C selected, page to a week where C has nothing.

**Pass:** "No sessions match this week." shows over the grid.

### Case 4.5: clearing

Click the chip's ×.

**Pass:** all cards return to full opacity, and the pill reads All sessions.

### Case 4.6: persistence

Select C, open a session, then come back.

**Pass:** the filter is still C. After logging out and back in, it's reset.

## 6. Part 5: Drag to move (PR 5, needs both backend PRs)

Use a real mouse, then a real trackpad. Synthetic drags don't count.

### Case 5.1: click still works

Press and release C's card quickly, without moving.

**Pass:** it behaves as a click and opens the session page. No drag starts.

### Case 5.2: drag start

Press and hold C's card, then move it a little.

**Pass:**
- The card fades and gets a dashed outline.
- A tilted ghost follows the pointer.
- Future days get a faint background.

### Case 5.3: slots unfold

Drag over Friday.

**Pass:**
- Friday becomes 30-minute slots across the coach's working hours (8:00 AM to 5:30 PM by default).
- Taken slots show the holder's first name.
- The hovered slot is dark.
- Past days never unfold.

### Case 5.4: drop on a free slot

Drop C on Friday at 10:00 AM.

**Pass:**
- The card moves straight away and its note reads **Moved**.
- The toast reads "Moved C to Fri, 10:00 AM · this session only", with **Undo**.

### Case 5.5: Undo

Drop again, then click Undo.

**Pass:** the card goes back to its old day and time.

### Case 5.6: series occurrence

Drag A's Tuesday session to Wednesday.

**Pass:** only that occurrence moves. Next Tuesday's A is still there. Google Calendar shows only that one occurrence moved.

### Case 5.7: drop on a taken slot

Drop C onto a slot held by B.

**Pass:**
- The reschedule dialog opens, prefilled with the dropped day and time, on the overlap step.
- Cancelling it leaves C where it was.

### Case 5.8: drop elsewhere

Drop on the panel header, or outside the grid.

**Pass:** nothing moves.

### Case 5.9: right-click and drag

Right-click a card.

**Pass:** the context menu opens. No drag starts.

### Case 5.10: working hours

In Settings › Coaching preferences, set working hours to 7:00 AM to 3:00 PM and save. Drag a card on the dashboard.

**Pass:**
- The slots run from 7:00 AM to 3:00 PM.
- In the New session dialog, 7:30 AM no longer shows an after-hours warning.

### Case 5.11: Moved note lifetime

Move a card, then page away and back.

**Pass:** the note still reads Moved. After a reload, it shows its topics again.

### Case 5.12: move failure

Block the session update request, then drop a card on a free slot.

**Pass:** the card snaps back, and an error toast explains the move failed.

## 7. Part 6: Mobile (PR 6)

Run this part at 390×844, then on a real phone.

### Case 6.1: day strip

**Pass:**
- Seven pills sit under the title, and days with sessions have a dot.
- Today's pill is selected on the current week, and Monday is selected on other weeks.
- Below the strip, the selected day reads "Tuesday, August 18".

### Case 6.2: agenda

Tap days.

**Pass:**
- That day's sessions show as full-width cards in time order, each with Prepare, Open session and Move.
- An empty day reads "No sessions".

### Case 6.3: Move sheet

Tap **Move** on C.

**Pass:**
- A bottom sheet titled "Move C's session" opens.
- It shows the day pills, with past days disabled, and the 30-minute slots, with C's own slot marked current and taken slots named.
- **Move session** stays disabled until the day or time differs.

### Case 6.4: confirming a move

Pick Friday at 10:00 and confirm.

**Pass:** Friday becomes selected, C is there, and the Undo toast appears.

### Case 6.5: long-press

Long-press a card.

**Pass:** the context menu opens. It has Move…, which opens the same sheet. Nothing drags.

### Case 6.6: back to this week

Page to next week.

**Pass:** a "Back to this week" link appears, and it returns to the current week.

### Case 6.7: shared state

Set a filter on desktop width, narrow the window to 390px, then widen it again.

**Pass:** the week and the filter carry over both ways.

## 8. Part 7: Roles (PR 7)

### Case 7.1: coachee only

Log in as the coachee-only user.

**Pass:**
- There's no Schedule session button and no filter.
- Empty days have no hover affordance, and cards don't drag.
- A card click opens the session.
- The context menu offers only Open session, on upcoming and past cards alike.
- Week arrows still page.

### Case 7.2: mixed

Log in as the mixed user.

**Pass:**
- Sessions they coach behave like Part 1 to Part 5.
- Sessions they're coached in behave like 7.1.
- Schedule session and the filter are shown.

## 9. Part 8: One email once changes settle (backend PR 2)

Turn email on. Use only the Jim→Jim relationship.

### Case 8.1: a burst

Move the session three times within 30 seconds, using drag or the dialog.

**Pass:** exactly one "rescheduled" email arrives, about 60 seconds after the last move. It shows the original time and the final time.

### Case 8.2: Undo sends nothing

Move the session, then Undo within 10 seconds.

**Pass:** no email arrives within 2 minutes.

### Case 8.3: cap

Move the session every 30 seconds for 6 minutes.

**Pass:** one email arrives about 5 minutes after the first move. A second arrives about a minute after the last.

### Case 8.4: cancelling sends straight away

Cancel a session.

**Pass:** the cancellation email arrives immediately, not after a delay.

### Case 8.5: calendar

Open the email's invite in Google Calendar.

**Pass:** the existing event moves; no duplicate is created.

## 10. Part 9: End-to-end pass (after PR 7 merges)

Run on `main` with every PR merged, on desktop and then on a real phone, in Light and Dark. Use the coach login unless a step says otherwise.

1. **A coach's week:**
   1. Open the dashboard. The current week shows every seeded session correctly (1.1–1.5).
   2. Page back to the first week and forward to the last (2.3).
   3. Return with This week.
2. **Plan, prepare, run:**
   1. Schedule a new session for E on an empty day (2.5). It appears on that day.
   2. Prepare it: add a topic, and it shows Ready (3.2).
   3. Filter to E, then clear the filter (4.3–4.5).
3. **Rearrange the week:**
   1. Drag C to a free slot, and Undo (5.4, 5.5).
   2. Drag A's occurrence to another day (5.6).
   3. Drop onto a taken slot, and resolve through the dialog (5.7).
   4. Reschedule a session from its menu (2.8).
4. **Clean up:**
   1. Cancel an upcoming session (1.8).
   2. Remove a past one (1.9).
   3. Resend an invite, view a series, and edit a series from the context menu (1.7).
5. **Emails** (email on, Jim→Jim only): repeat 8.1 and 8.2 through drags in the grid.
6. **Phone:** repeat steps 1, 3.1 and 4.1 with the day strip, Move sheet and long-press (6.1–6.5).
7. **Roles:** run 7.1 and 7.2.
8. **Regression:** the Upcoming Session card, the Goals card, the Join session menu, the New session dialog and Settings still behave as before. Nothing on the dashboard scrolls sideways at any width.

**Pass:** every step passes. Record any failure in the PR or issue that fixes it, with its case number.
