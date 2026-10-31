# Test Plan: Manually Testing the Design System Redesign

Checks the Phase 1 design-system redesign layer by layer, matching the stacked PRs: tokens and themes, restyled primitives, status components, the toast pill, single-line toast copy, and (in later parts) the header and the Join session menu. Each part names the PR it covers; run a part against that layer or anything above it in the stack.

Results go in the PR for the layer under test, not in this plan.

## 1. Prerequisites

1. Backend on `:4000` from current `main`, started with email off: `RESEND_API_KEY=` and `SESSION_REMINDER_EMAIL_TEMPLATE_ID=` both blank. Global search needs a backend build that includes the search endpoint.
2. Frontend on the branch under test, `npm run dev` on `:3000`.
3. Logins from `.env.local`: coach `PW_ORG_ADMIN_LOGIN_*`, coachee `PW_USER_LOGIN_*`.
4. Theme switching: the header's theme toggle (Light, Dark, System). Run every part in **both** Light and Dark unless the case says otherwise.
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

### Case A4: System follows the OS

Set the toggle to System, then switch the OS between light and dark appearance.

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

Look at the organization initials at the bottom of the left sidebar, in both themes.

**Pass:** it's a 28px square with rounded corners, not a circle. In Dark it's a neutral grey tile with light initials.

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
