# Test Plan: Manually Testing Suggested Actions in the Actions Panel (Frontend)

Verify that suggested Actions extracted from a session transcript arrive in the Actions panel
without a refresh, read clearly, and can be accepted, edited, dismissed and restored by the coach
and the coachee under the permission rules; that duplicates, the dismissed list and the jump to
the transcript behave; and that it all holds up on a phone, in dark mode and from the keyboard.

Backend counterpart: `refactor-platform-rs/docs/test-plans/transcript_suggestions_manual_testing.md`.

> [!IMPORTANT]
> The Playwright specs (`__tests__/e2e/suggested-actions-*.spec.ts`) run against mocked routes
> with no SSE, and the Vitest suite renders components in jsdom. Neither covers **real
> recordings**, **real AssemblyAI extraction**, **SSE between two browsers** or **real phones**.
> Parts A, G and H are the only proof of those. The spoken scripts live in the backend plan's
> Part F; cases below name the group to record instead of repeating them.

## 1. Prerequisites

1. Backend on `432-suggested-actions` running on `:4000`, with the Recall and AssemblyAI setup
   and the session/next-session setup from the backend plan's Prerequisites, migrations applied.
2. Frontend on `477-suggested-actions`, `npm run dev` on `:3000`.
3. A coaching session with a meeting recording, opened at `/coaching-sessions/<id>`, with the
   panel switched to **Actions** and the **New** tab selected.
4. **Two browsers** (or one plus an incognito window) signed in as the coach and the coachee of
   that session's relationship. Parts C and G need both.

## 2. Part A: arrival and display

### Case A1: cards arrive without a refresh

Keep the session open in both browsers while a recording finishes and extraction runs (record
backend group F1).

**Pass:** dashed "Suggested" cards appear under "Suggested from transcript" in both browsers
without a reload, oldest first.

### Case A2: the New tab count

**Pass:** the New tab reads "New (n) · N suggested", where N matches the number of cards, and the
suffix disappears when the last card is resolved.

### Case A3: every card field

Inspect one card.

**Pass:** the header reads "Suggested" with a sparkle icon. A long body is clamped to two lines
and expands and collapses on click. The quote is italic and clamped. The `<speaker> · m:ss`
button shows the right speaker and start time. Assignees show as initials with the full name on
hover, or "Unassigned" in italics. A spoken due date is **bold**, and hovering it (or tapping it)
shows "Due <date> · from “<phrase>”". The card ends with one right-aligned row of labelled
buttons: **Accept**, **Edit**, **Dismiss**.

### Case A4: the default due date

Record backend groups F6 (session on a Wednesday) and F7 (no next session).

**Pass:** a suggestion with no spoken date shows its due date in regular weight. Its tooltip reads
"No date mentioned. Defaults to your next session" (F6) or "No date mentioned. Defaults to a week
from today" (F7).

### Case A5: a phrase that is not a date

Find the backend group F6 suggestion from "I'll reach out to the new VP soon."

**Pass:** the due date is in regular weight and the tooltip begins "“soon” isn't a date." followed
by the default it fell back to.

## 3. Part B: coach review

Sign in as the coach. Record backend group F1 unless pending suggestions remain.

### Case B1: accept

Click **Accept** on a card.

**Pass:** the card animates out, the new action appears in the New tab's list, is scrolled into
view and carries a ring for about two seconds. The remaining cards keep their oldest-first order.

### Case B2: Edit flips the card

Click **Edit**.

**Pass:** the card flips like an action card to an "Edit suggestion" form with the body, due date,
assignees and Linked goal, and no Status row. The form's buttons are **Accept** and **Cancel**;
there is no Save. Edits are never stored on the suggestion: they only travel with an accept.

### Case B3: edit then accept

Click **Edit**, change the body, due date and assignees, then click **Accept** in the form.

**Pass:** one press creates the action with the edited body, date and assignees; the card animates
out and the new action is ringed as in B1. Accept is disabled while the body is empty. If the
accept fails, the card stays and the form stays open with the edits.

### Case B4: dismiss and undo

Click **Dismiss**, then **Undo** in the toast within six seconds.

**Pass:** a "Suggestion dismissed" toast with an **Undo** button appears and the card leaves.
Undo brings the card back in place. Dismiss another and let the toast lapse: the card stays gone.

### Case B5: Cancel, Escape and outside click in the form

Open the form, change the body, click **Cancel**. Open it again, change the body, press Escape.
Open it again, change the body, click outside the card.

**Pass:** each flips the card back without a request, and the card shows the original body.
Opening the form again starts from the suggestion, not the discarded edits. Escape pressed inside
the open Assignees or due date popover closes only the popover.

### Case B6: link a goal while accepting

The session needs at least one linked goal. Click **Edit**, open the **Linked goal** picker, choose
a goal, then click **Accept** in the form. Open the goal's card in the Goals section.

**Pass:** the new action shows the goal (its pill when the body is expanded), and the goal's
progress counts the new action without a page refresh. A card left at **None** creates an action
with no goal.

## 4. Part C: coachee review

Sign in as the coachee. Record backend groups F1 and F2 so there are coach-only suggestions (F1 lines 8
and 9) and coachee ones.

### Case C1: a coach-only card is read-only

**Pass:** the card has no Accept, Edit or Dismiss buttons, and a lock line reads "Only <coach first name> can accept
or edit it."

### Case C2: the coach is disabled in the picker

On one of the coachee's own cards, click **Edit** and open **Assignees**.

**Pass:** the coach's option is greyed out and cannot be ticked or unticked, and the note "Only
your coach can assign an action to themselves." shows under the options. Accepting keeps the coach
out of the assignees.

### Case C3: own suggestion

Accept one, dismiss one, edit and accept one.

**Pass:** each behaves as in Part B.

### Case C4: no after-session lock

Open a session from a previous day that still has pending suggestions.

**Pass:** the cards are still actionable; nothing locks them after the session ends.

## 5. Part D: duplicates

Record backend group F8, with its two existing actions created first.

### Case D1: the marker

**Pass:** the Q4 hiring plan and onboarding doc cards show "· Possible duplicate"; hovering it
shows the existing action's body. The interns checklist card has no marker.

### Case D2: the marker rings the existing action

Click "Possible duplicate". Repeat with the existing action on the other tab (Due vs New).

**Pass:** the panel switches to the tab holding the existing action if needed, scrolls to it and
rings it. Clicking again rings it again.

### Case D3: the confirm row

Click **Accept** on a duplicate card, then on another duplicate click **Edit**, change the body
and click **Accept** in the form.

**Pass:** no request is sent; the button row is replaced by a row that reads "This looks like an action you already have:" followed
by the existing body, with **Add anyway**, **Keep existing** and **Cancel**. Add anyway creates
the action. On another duplicate, Keep existing dismisses the suggestion (with the Undo toast).
Cancel and Escape each close the row and leave the card as it was. From the form, the form stays
open above the row, and Add anyway creates the action with the edited body.

## 6. Part E: dismissed section

### Case E1: hidden at zero, collapsed by default

**Pass:** with no dismissed suggestions there is no "Dismissed" heading. After one dismissal,
"Dismissed (1)" appears at the bottom of the New tab, below the session's actions, collapsed.

### Case E2: the row

Expand it.

**Pass:** each row shows the struck-through body, its quote, and "Dismissed by you · <date>" for
your own dismissal or "Dismissed by <first name> · <date>" for the other person's.

### Case E3: Restore

Click **Restore**.

**Pass:** the row leaves, the card returns to the pending group in oldest-first order, and the
count drops. As the coachee, a coach-only row has no Restore and reads "Only <coach first name>
can restore it".

## 7. Part F: transcript jump

### Case F1: from a card, transcript closed

With the transcript closed, click a card's `<speaker> · m:ss` button.

**Pass:** the transcript opens beside the Actions panel, which stays expanded. The quoted segment
is scrolled to the center and marked.

### Case F2: transcript already open

Repeat with the transcript open and scrolled elsewhere.

**Pass:** it scrolls to the segment and marks it.

### Case F3: from a dismissed row

**Pass:** the same as F1, from a dismissed row's source button.

### Case F4: a speaker filter hides the segment

Filter the transcript to the other speaker, then jump.

**Pass:** the filter is reset so the segment is visible and marked.

## 8. Part G: live sync

Both browsers on the same session, Actions panel open.

### Case G1: changes appear in the other browser

As the coach, accept one card, dismiss one, restore one and accept one with edits.

**Pass:** each change shows in the coachee's browser within a few seconds without a refresh:
accepted cards leave and the action appears, dismissed cards move to the Dismissed section,
restored ones return, and the edited accept adds the action with the edits. Repeat from the coachee side for their own cards.

### Case G2: racing accepts

Click **Accept** on the same card in both browsers at nearly the same moment.

**Pass:** one wins; the other shows "Someone already handled this suggestion." and the card
disappears from its list.

## 9. Part H: mobile

On a real phone, or Chrome DevTools at 390px wide.

### Case H1: no horizontal scroll

Open the Actions sheet with long bodies and quotes, the edit form, the duplicate confirm row and
the expanded Dismissed section.

**Pass:** the page never scrolls sideways.

### Case H2: touch targets

**Pass:** Accept/Edit/Dismiss, the source button, the due date, the duplicate marker, the form's
Accept/Cancel, Add anyway/Keep existing/Cancel and Restore are each at least 40px tall, and
the labelled buttons at least 40px wide.

### Case H3: tooltips on tap

**Pass:** tapping the due date opens its tooltip and tapping again closes it.

### Case H4: the quote link

**Pass:** tapping a card's source button closes the sheet and shows the marked segment in the
transcript.

### Case H5: popovers stay on screen

**Pass:** the Assignees and due date popovers open fully within the screen.

## 10. Part I: dark mode and keyboard

### Case I1: dark mode

Switch the OS (or the app) to dark mode.

**Pass:** the dashed border, body, quote, due date, lock line, confirm row and dismissed rows are
all legible; the lock line's meaning carries in its icon and text, not colour alone.

### Case I2: keyboard and screen reader

Tab through a card, the edit form, the confirm row and the Dismissed section, with VoiceOver on.

**Pass:** every control is reachable by Tab with a visible focus ring, and each is announced with
a sensible name (for example "Accept", "Show in transcript: Jane Smith · 12:34").
Escape closes the edit form and the confirm row.

## Results

| Case | Result | Notes |
|---|---|---|
| A1 |  |  |
| A2 |  |  |
| A3 |  |  |
| A4 |  |  |
| A5 |  |  |
| B1 |  |  |
| B2 |  |  |
| B3 |  |  |
| B4 |  |  |
| B5 |  |  |
| B6 |  |  |
| C1 |  |  |
| C2 |  |  |
| C3 |  |  |
| C4 |  |  |
| D1 |  |  |
| D2 |  |  |
| D3 |  |  |
| E1 |  |  |
| E2 |  |  |
| E3 |  |  |
| F1 |  |  |
| F2 |  |  |
| F3 |  |  |
| F4 |  |  |
| G1 |  |  |
| G2 |  |  |
| H1 |  |  |
| H2 |  |  |
| H3 |  |  |
| H4 |  |  |
| H5 |  |  |
| I1 |  |  |
| I2 |  |  |
