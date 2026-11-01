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
