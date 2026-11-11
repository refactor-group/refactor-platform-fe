# Manual Test Plans

Procedures for checking a feature in a real browser against a running backend: by hand, or
driven through Playwright MCP. Automated tests (Vitest, the mocked Playwright specs in
`__tests__/e2e/`) are separate; see `docs/testing/frontend-testing-strategy.md`.

Pick a plan by what your change touches, check its **Needs** column before starting, and
report results in the PR, commit or coordination board, never in the plan.

## Index

| Plan | Covers | Run when | Needs | Backend counterpart (`refactor-platform-rs/docs/test-plans/`) |
|---|---|---|---|---|
| [relationship_access_manual_testing.md](relationship_access_manual_testing.md) | What each viewer (coach, coachee, non-participant, org admin, SuperAdmin, removed member) sees or can use, on every surface, linked to the backend access matrix rows | Any change to role gating, permissions or org membership rules; rs#399 phases | Backend fixture from the counterpart; email off | `relationship_access_manual_testing.md` |
| [member_role_change_manual_testing.md](member_role_change_manual_testing.md) | Members page: granting and revoking org admin, the self-row lockout, the last-admin refusal, keeping other org memberships, a role change reaching an open tab | Members page, org roles, the auth store | A sole-admin org and a multi-org member | `organization_member_role_change_manual_testing.md` |
| [week_grid_manual_testing.md](week_grid_manual_testing.md) | The dashboard week grid: cards, the card menu, drag to move with Undo, working hours, phone agenda | The week grid or dashboard session cards | Email off, except Part 8 and Part 9 step 5 (Jim→Jim relationship only) | |
| [new_session_dialog_manual_testing.md](new_session_dialog_manual_testing.md) | The New session dialog: Who, When, Repeat, the overlap step, submit, and Reschedule (move mode) | Scheduling, rescheduling, the StepDialog shell | Email off; a seeded coach with five coachees | |
| [resend_calendar_invite_manual_testing.md](resend_calendar_invite_manual_testing.md) | Resend invite for a series or one-off from the session menu: gating, and a clean calendar afterwards | Resend invite, `.ics` invites | **Sends real email**, only to the allowed pair the plan names; reminder template blank | `ics-calendar-invites-manual-test-plan.md` |
| [transcript_suggestions_ui_manual_testing.md](transcript_suggestions_ui_manual_testing.md) | Suggested actions in the Actions panel: live arrival, accept, edit, dismiss and restore per role, phone, dark mode, keyboard | Suggested actions, transcript scan | A real transcript; live SSE (the mocked specs can't cover it) | `transcript_suggestions_manual_testing.md` |
| [coaching_session_images_manual_testing.md](coaching_session_images_manual_testing.md) | Images in coaching notes: add, render, delete, undo, alt text, failures, a second participant | The notes editor, note images | **By hand only**: Playwright can't reach the collaborative editor | `coaching_session_images_manual_testing.md` |
| [design_system_manual_testing.md](design_system_manual_testing.md) | The design-system layers: tokens and themes, primitives, status components, toasts and their copy, the header | Shared UI primitives, tokens, toast copy | Email off; run in Light and Dark | |

## Adding a plan

- Name it `<feature>_manual_testing.md`, and add a row here in the same PR.
- State the prerequisites up front: backend branch, email on or off, fixture, logins (by
  `.env.local` variable, never the values).
- For a feature with a backend plan, name it as the counterpart and don't re-run its checks.
- Keep the plan static: it is a procedure, not a log.
