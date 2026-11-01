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
