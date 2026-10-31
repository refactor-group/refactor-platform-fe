# Test Plan: Manually Testing the Design System Redesign

Checks the Phase 1 design-system redesign layer by layer, matching the stacked PRs: tokens and themes, restyled primitives, status components, the toast pill, single-line toast copy, and the header, and (in a later part) the Join session menu. Each part names the PR it covers; run a part against that layer or anything above it in the stack.

Results go in the PR for the layer under test, not in this plan.

## 1. Prerequisites

1. Backend on `:4000` from current `main`, started with email off: `RESEND_API_KEY=` and `SESSION_REMINDER_EMAIL_TEMPLATE_ID=` both blank. Global search needs a backend build that includes the search endpoint.
2. Frontend on the branch under test, `npm run dev` on `:3000`.
3. Logins from `.env.local`: coach `PW_ORG_ADMIN_LOGIN_*`, coachee `PW_USER_LOGIN_*`.
4. Theme switching: avatar menu › Appearance (Light, Dark, Auto). Run every part in **both** Light and Dark unless the case says otherwise.
5. Forcing an error without changing data: in Chrome DevTools open **Network**, then **Block request URL**, and block the request the case names. Remove the block afterwards.
6. Narrow-width checks: DevTools device toolbar at 375px wide.

## 2. Part A: tokens and themes (#494)

### Case A1: light palette

Open the dashboard in Light.

**Pass:** primary buttons ("Add New", "Schedule a coaching session") are indigo with white text. The page and cards are white, body text is near-black, borders are light grey, and secondary text is mid grey.

### Case A2: dark palette

Switch to Dark.

**Pass:** the page is near-black with a cool (zinc) tint, never pure black. Cards are a slightly lighter grey than the page. Primary buttons stay the same indigo with white text, and text is off-white.

### Case A3: accent text in dark

In Dark, on a coaching session page, open an action's due-date editor in the side panel and find the "Done" text button.

**Pass:** "Done" is a lighter indigo than the primary buttons and is easy to read on the dark card.

### Case A4: Auto follows the OS

In the avatar menu, set Appearance to Auto, then switch the OS between light and dark appearance.

**Pass:** the app follows the OS each time without a reload.

## 3. Part B: primitives (#495)

### Case B1: buttons are pills

On the dashboard and a coaching session page, look at the primary, secondary and ghost buttons.

**Pass:** every button has fully rounded ends. Primary is indigo, secondary is a light grey fill with no border, and ghost buttons have no fill until hovered.

### Case B2: button text size

In DevTools, inspect "Add New" on the dashboard and check its computed `font-size`.

**Pass:** 13.5px, not 16px.

### Case B3: disabled primary

On a coaching session page, clear the "Add a topic…" input.

**Pass:** the round "+" button next to it is pale indigo, not a faded dark button.

### Case B4: icon buttons

Look at the icon-only buttons (the header's theme toggle, the clear "×" in search).

**Pass:** they're circular.

### Case B5: cards

Open a coaching session page.

**Pass:** the Topics and Notes panels have 16px rounded corners and a soft shadow in Light. In Dark their borders match the rest of the dark UI.

### Case B6: menus and inputs

Open the "Switch Session" popover and its "Select a coachee…" dropdown. Look at any text input.

**Pass:** the popover and dropdown have 14px rounded corners and a soft shadow. Inputs and select triggers have 10px corners.

### Case B7: organization avatar

Look at the organization tile at the left of the header and the organization list in the avatar menu, in both themes.

**Pass:** the header tile is a 28px square with rounded corners, not a circle, and the menu tiles are the same shape at 22px. In Dark they're neutral grey tiles with light initials.

### Case B8: global search

Look at the search box in the header, then click into it and type a query.

**Pass:** at rest it's a light grey pill with no border. While focused it turns the card colour with a focus ring. The results panel has 14px rounded corners and a soft shadow.

## 4. Part C: status components (#500)

The status glyph, pill and menu aren't used on any screen yet. Unit tests cover them, and the dashboard redesign (Phase 2) adds their manual cases.

## 5. Part D: toast pill (#501)

Ways to trigger a toast in these cases:
- **Error:** on a coaching session page, block `*/topics` in DevTools, type a topic and click "+".
- **Success:** open `/settings/integrations?google_connected=true`. In development this page shows the toast twice; that's existing behaviour, not a failure.
- **Two actions:** on the Actions page (Kanban), move one of your actions to Completed.

### Case D1: look

Trigger an error toast in Light, then in Dark.

**Pass:** in Light it's a dark pill with light text; in Dark it's a light pill with dark text. It sits at the bottom centre of the window on one line. An error leads with a red alert icon, a success with a green check. A countdown ring sits at the right end.

### Case D2: auto-dismiss

Trigger a toast and don't touch it.

**Pass:** the ring empties clockwise from 12 o'clock, and the toast disappears after about 6 seconds.

### Case D3: hover pauses

Trigger a toast and hover over it for about 10 seconds, then move away.

**Pass:** the ring stops while you hover and the toast stays. After you leave, the ring resumes and the toast disappears when it empties.

### Case D4: click dismisses

Trigger a toast and click its text.

**Pass:** it disappears straight away.

### Case D5: Esc

1. Trigger a toast and press Esc.
2. Trigger another toast, open the "Switch Session" popover, then press Esc twice.

**Pass:** in step 1 the toast disappears. In step 2 the first Esc closes only the popover and the toast stays; the second Esc dismisses the toast.

### Case D6: swipe

1. Drag a toast sideways about 150px and release.
2. Drag another sideways about 40px and release slowly.
3. Drag another straight up or down about 100px and release.

**Pass:** in step 1 the toast follows the pointer, fades, and flings off screen. In step 2 it springs back and stays. In step 3 it doesn't move sideways and stays.

### Case D7: stacking

Trigger 4 error toasts quickly.

**Pass:** at most 3 are visible at once, with the newest in front.

### Case D8: narrow width

At 375px wide, open `/settings/integrations?google_connected=true` and wait a moment.

**Pass:** the toast spans the width with an even 16px gap on both sides. Vertical scrolling over the toast with touch emulation scrolls the page and doesn't dismiss it.

### Case D9: Show and Undo

On the Actions page, move an action to Completed.

**Pass:** the toast reads "Moved to Completed" with underlined **Show** and **Undo**. Undo moves the action back and closes the toast. On a second try, Show reveals the card and closes the toast.

### Case D10: screen reader

With VoiceOver on, trigger an error toast, then a success toast.

**Pass:** the error is announced straight away, interrupting other speech. The success is announced when VoiceOver is idle.

### Case D11: one toast per event

On `/settings/preferences` and, as a super admin, an `/admin` page, trigger any save that shows a toast.

**Pass:** exactly one toast appears for each event.

## 6. Part E: single-line toast copy (#502)

### Case E1: one line, no technical detail

Load the page first, then block the named request in DevTools and trigger the action:

| Action | Block | Expected toast |
|---|---|---|
| Add a topic on a session page | `*/topics` | Couldn't add the topic |
| Delete an agreement | `*/agreements/*` | Couldn't delete the agreement |
| Change an action's status in the session panel | `*/actions/*` | Couldn't update the status |
| Resend a session invite from the dashboard ⋮ menu (coach) | `*/resend_invite` | Couldn't resend the invite · Try again in a moment |
| Delete a session from the dashboard ⋮ menu (coach) | `*/coaching_sessions/*` | Couldn't delete the session · Try again |

**Pass:** each toast shows exactly the expected text on one line, with no trailing period, no HTTP status, no server message and no second line.

### Case E2: network loss wording

With DevTools network throttling set to **Offline**, change an action's status on the Actions page.

**Pass:** "Couldn't update the status · Check your connection and try again".

### Case E3: Undo confirmations

Delete a topic on a session page.

**Pass:** the toast names the deleted topic in quotes and offers Undo. Undo restores the topic.

## 7. Part F: global header (#504)

### Case F1: desktop layout

At 1280px wide, log in as the coach and open the dashboard.

**Pass:** a 56px header with no sidebar anywhere. Left to right: the organization tile and name, a short divider, Dashboard and Actions pills, search, Join session (when you have more than one coaching relationship), and your avatar. Dashboard has a grey fill. Open Actions and the fill moves to Actions.

### Case F2: no sidebar on any page

Visit the dashboard, Actions, Settings, `/admin/organizations` (super admin), a coaching session page, an organization's members page and your profile.

**Pass:** each page shows the same header and no sidebar. The session page fills the space to the left edge.

### Case F3: organization tile

Click the organization name in the header from the Actions page.

**Pass:** it goes to the dashboard. The tile shows the organization logo, or its initials on a square grey tile.

### Case F4: mobile layout

At 375px wide, open the dashboard.

**Pass:** the header shows the organization tile without the name, an Actions pill, search, the Join session icon (when shown) and your avatar. There is no Dashboard pill, no menu button, and the page doesn't scroll sideways.

### Case F5: avatar menu as a coachee

Log in with `PW_USER_LOGIN_*` and click your avatar.

**Pass:** the menu shows your name and email, the Organization list with the current one checked, Profile, Appearance and Log out. There is no Members or Organizations entry, and Settings appears only if this user also coaches someone.

### Case F6: avatar menu as an org admin

Log in with `PW_ORG_ADMIN_LOGIN_*` and click your avatar.

**Pass:** Members appears under the organization list and opens that organization's members page. Settings appears and opens Settings. There is no Organizations entry.

### Case F7: avatar menu as a super admin

Log in with `PW_SUPER_ADMIN_LOGIN_*` and click your avatar.

**Pass:** both Members and Organizations appear. Organizations opens the platform organizations page.

### Case F8: switch organization from the dashboard

As a user in two or more organizations, open the avatar menu on the dashboard and pick another organization.

**Pass:** the menu closes, the header tile shows the new organization, and the dashboard reloads for it.

### Case F9: switch organization from a members page

As an org admin of two organizations, open the first one's members page, then pick the second organization in the avatar menu.

**Pass:** you stay on the members page, now for the second organization.

### Case F10: remembers the last organization

Switch to another organization, log out, then log back in as the same user.

**Pass:** the header shows the organization you switched to.

### Case F11: Appearance

Open the avatar menu and pick Dark, then Light, then Auto. With Auto selected, switch the OS between light and dark appearance.

**Pass:** each pick applies at once and the menu stays open. The picked option is highlighted. With Auto, the app follows the OS without a reload.

### Case F12: keyboard

Tab to your avatar and press Enter. Use the arrow keys to reach Dark in Appearance and press Enter, then press Esc.

**Pass:** the menu opens on Enter, arrow keys reach every row including the three Appearance options, Enter switches to Dark, and Esc closes the menu with focus back on the avatar.

### Case F13: search starts as a magnifier

At 1280px, open the dashboard and hover the magnifier in the header.

**Pass:** search is a round magnifier button, not a text field. The tooltip reads "Search" with a small ⌘K hint.

### Case F14: opening search

Click the magnifier. Press Esc twice, click on the page, then press ⌘K (Ctrl+K on Windows or Linux). Repeat with "/". Then click into a text field on the page and press ⌘K.

**Pass:** the click, ⌘K and "/" each widen the magnifier into a search field with the cursor in it, with a smooth widening. ⌘K inside the other text field does nothing to search.

### Case F15: grouped results

Search for a word that appears in a session title, a goal, an action, an agreement and a topic.

**Pass:** the results panel opens under the right edge of the field, wider than the field. Results are grouped under Sessions, Goals, Actions, Agreements and Topics in that order, Sessions first. Groups with no matches are left out. Each row shows its kind on the right.

### Case F16: keyboard in results

With grouped results showing, press the down arrow until the highlight passes the last session, keep going to the end, then pick a row and press Enter.

**Pass:** the highlight moves from the last session straight into the first goal and on through every group, wrapping from the last row back to the first. Enter opens the highlighted result and search returns to the magnifier.

### Case F17: Esc clears, then closes

Type a query, press Esc, then press Esc again.

**Pass:** the first Esc clears the text and keeps the field open with the cursor in it. The second Esc returns search to the magnifier, with focus on the magnifier.

### Case F18: clicking away

Open search and click elsewhere on the page without typing. Then open search, type a query, and click elsewhere. Click back into the field.

**Pass:** with nothing typed, search returns to the magnifier. With a query, the field stays open showing the query and the results hide. Clicking back into the field shows the results again.

### Case F19: search at 375px

At 375px, open search and type a query.

**Pass:** the field opens over the header row instead of pushing the other header items aside. The results panel spans the width of the field and stays on screen, and the page doesn't scroll sideways. Esc twice brings back the normal header.

### Case F20: Reduce Motion

Turn on Reduce Motion (macOS System Settings › Accessibility › Display), then open and close search at 1280px.

**Pass:** the field appears and disappears at full width at once, with no widening animation.

## 8. Part G: Join session menu (#PR-TBD)

Requires a backend build that includes rs#459 (`/coaching_sessions/nearest`). This part also covers the menu's building blocks from #503 (dots, strip, carousel, rows, Today block), which had no part of its own.

Set up as the coach with six or more coachees, at least one session today with one of them, a few past and upcoming sessions with another, and one coachee with only one or two sessions.

### Case G1: trigger and open state

At 1280px, open the dashboard and click Join session in the header.

**Pass:** the pill shows a video icon, "Join session" and a chevron. While the menu is open the pill has a light accent tint. The menu opens under the pill, aligned to its right edge, 420px wide with rounded corners and a soft shadow.

### Case G2: Today block

With a session today, open the menu. Repeat once that session has started.

**Pass:** a "Today" card with an accent wash sits at the top, one row per session today across all coachees: avatar, full name, "Today · {time}" and the session title. Once a session is under way its row turns white and a small accent dot pulses in front of it. Clicking a Today row opens that session.

### Case G3: carousel paging and selection

Open the menu with six or more coachees. Use the next and previous arrows, then click a coachee.

**Pass:** five coachees per page. Previous is disabled on the first page and Next on the last. The page slides rather than jumps. The selected coachee has an accent ring and dark name; the others are grey. Clicking a coachee swaps the strip and list below without closing the menu or changing the page.

### Case G4: dot strip

Pick a coachee with past and upcoming sessions. Hover each dot.

**Pass:** the strip shows the coachee's full name on the left and month labels with dots on the right, oldest on the left. Past dots are pale accent, upcoming dots are hollow accent rings, today's dot is larger with a halo, and on a session page that session's dot is the largest solid dot. The month you're anchored on is bold. Hovering a dot grows only that dot and shows one dark pill reading "{date} · {title}" above the strip's right side.

### Case G5: list rows

Look at the list under the strip.

**Pass:** each row shows the date (e.g. "Tue Aug 25") in a fixed column, the title, and "Upcoming" or "Previous" below it. Upcoming rows are slightly dimmed. Rows end with a faint chevron. At most five rows.

### Case G6: the three windows

1. Pick the coachee who has a session today.
2. Open one of another coachee's sessions, then open the menu on that page.
3. Pick a coachee with no session today, away from any session page.

**Pass:** (1) the list shows up to two sessions before today's and two after; today's session is in the Today card, not the list. (2) That coachee is preselected, and their session's row has an accent background and a "Current" chip instead of a chevron, with up to two sessions on each side. (3) The two most recent past sessions and the two nearest upcoming ones.

### Case G7: sparse history

Pick the coachee with only one or two sessions, then one with none.

**Pass:** the list shows only the sessions that exist, with nothing filled in from other coachees. With none, it reads "No sessions with {first name} yet".

### Case G8: opening a session

Click a list row. Open the menu again and click a dot.

**Pass:** the menu closes, the session page opens, and a toast reads "Opened {first name} · {date} · {title}".

### Case G9: closing

Open the menu and press Esc. Open it again and click outside it.

**Pass:** both close the menu. Opening it again returns to the default coachee.

### Case G10: loading and errors

Block `coaching_sessions/nearest` and open the menu. Remove the block and click Try again.

**Pass:** while loading, three grey placeholder rows show. With the request blocked, the menu shows "Couldn't load sessions" and a Try again link inside the menu. Try again loads the list.

### Case G11: 375px

At 375px, open the menu.

**Pass:** the menu fits on screen with a small margin on each side, the page doesn't scroll sideways, and the list scrolls inside the menu when it's taller than the screen.

### Case G12: dark mode

Repeat G2 to G5 in Dark.

**Pass:** the menu, Today card, avatars, dots, tooltip and "Current" chip all read clearly, with no white panels or black text.

### Case G13: keyboard

Tab to Join session and press Enter. Tab through the coachees and rows, press Enter on a coachee, then on a row.

**Pass:** Enter opens the menu with focus inside it. Tab reaches the Today rows, the arrows, each visible coachee, the dots and each row, with a visible focus style. Enter on a coachee selects it and keeps the menu open. Enter on a row opens that session.
