# Phase 6 (rs#399): role-neutral keys — frontend plan

Contract: board `Phase6RoleNeutralKeys` v2. One FE PR, released with the BE PR in one deploy. No dual keys: the FE reads only the new shapes. `coach_id` / `coachee_id` stay (seat ids).

## Goal and definition of done

- The FE parses and renders the phase 6 shapes: `participants: [Participant, Participant]` on relationships and session lists, `actions_by_relationship`, `participant_not_a_member`.
- No code derives a **role** from `coach_id === userId` / `coachee_id === userId`. Roles come from `viewer.role` (the signed-in user) or `participants[].role` (anyone). Picking "the other person" by id (`p.id !== userId`) is identity, not role, and stays.
- Membership comes from `participants[].is_member`.
- Participants are found by id, never by array index, even though the BE always sends [coach seat, coachee seat].
- Unit tests, e2e route mocks and the manual plans use the new shapes; tsc, lint (no new warnings), vitest (no `Errors`), and one or two e2e specs in Docker pass.
- Verified against the BE PR locally (throwaway DB only), then both PRs together on one PR preview, with the BE plan's Definition of done scenario: coach, coachee and both colleagues each see correct names, roles, membership and actions.

## Design

### Types (`src/types/coaching-relationship.ts`, new `src/types/participant.ts`)

```ts
export interface Participant {
  id: Id;
  first_name: string;
  last_name: string;
  email: string;
  role: RelationshipRole; // coach | coachee | colleague, from the BE
  is_member: boolean;
}
```

- `CoachingRelationship`: drop `coach_is_member`, `coachee_is_member`.
- `CoachingRelationshipWithUserNames` = `CoachingRelationship & { participants: [Participant, Participant] }`. Drop the six name/email keys. Keep the type name in this PR to keep the diff reviewable (26 files import it); a rename can follow.
- `EnrichedCoachingSession`: drop `coach?: User`, `coachee?: User`; add `participants: Option<[Participant, Participant]>` (Some with `include=relationship`), normalized in `transformCoachingSession` like `series` and `topics` (`coaching-session.ts:92–95`). Fix the stale comment at `:69–70`.
- Parse at the boundary. Today nothing validates relationship responses: `isCoachingRelationshipWithUserNames` (`:141–168`) has no callers, and `CoachingRelationshipApi.list/get/updateKind` (`coaching-relationships.ts:34, 52, 96`) are bare casts. Add `parseCoachingRelationship` (checks `participants` is a 2-tuple of valid `Participant`s, role via `RelationshipRole`) and run every relationship fetcher and `transformCoachingSession` through it. Against the wrong backend (old tab after the deploy, or the new FE before the BE), the read then fails as an SWR error with an error state, not a `TypeError` deep in a render. Replace the unused guard with it.
- `defaultCoachingRelationshipWithUserNames`: placeholder participants with empty ids, roles Coach and Coachee by seat, so `otherParticipantOf(rel, "")` is deliberate.
- Delete `CoachingRelationshipWithUsers` (no readers). Rename `BatchCoacheeActionsResponse` (`action.ts:146`) with its key.

### One small participant module (`src/lib/participants.ts`)

Story-shaped helpers every reader goes through:

- `participantOf(rel, userId): Option<Participant>`
- `otherParticipantOf(rel, userId): Option<Participant>` (identity: the one whose id isn't `userId`; for a self-relationship such as dev's Jim→Jim, the coachee seat, matching today's `session.ts:298` and `people.ts:37`)
- `seatParticipant(rel, Seat.Coach | Seat.Coachee): Option<Participant>` (by `coach_id` / `coachee_id`, for seat-ordered copy such as "Jim → Cara")
- `roleOf(rel, userId): Option<RelationshipRole>` (reads `participants[].role`)
- `participantName(p)`, `nonMemberIds(rel)`, `isMember(rel, userId)`

### Readers to migrate

| Area | File:line | Change |
|---|---|---|
| Relationship names | `src/lib/utils/relationship.ts:23–45` `getCoachName`/`getCoacheeName` | seat lookup via `seatParticipant` |
| Role | `relationship.ts:52–97` `getOtherParticipantName`, `isUserCoach`, `getUserRoleInRelationship`, `resolveUserNameInRelationship` | no src callers: delete, with their tests in `__tests__/session.test.ts:191–260` |
| Session → relationship | `relationship.ts:105–135` `buildRelationshipWithUserNames` | copy `session.participants` |
| Name lookup / pair label | `relationship.ts:139–156` | via participants; pair label orders by role (colleague: viewer first) |
| Role helpers | `coaching-relationship.ts:226–291` `isUserCoach`, `isUserCoachee`, `getColleagueRelationships`, `getRelationshipsAsCoach/Coachee`, `isUserCoach/CoacheeInRelationship` | `roleOf(...)`; delete the two unused `...InRelationship` |
| Sort / other name | `coaching-relationship.ts:307–328` | `otherParticipantOf` |
| Membership | `coaching-relationship.ts:331–340` `isMember`, `nonMemberIdsOf` | `participants[].is_member` |
| People menu | `src/lib/people.ts:36–40` `otherParticipant` | `otherParticipantOf` |
| Profile roles, coaches, colleagues | `src/lib/utils/user-roles.ts:50–58, 87–104` | `roleOf`; names from the other participant |
| Role summary | `src/lib/api/user-coaching-relationships.ts:38–39` | via the role helpers |
| Session other person | `src/lib/move-draft.ts:28`, `src/lib/schedule-draft.ts:95`, `src/lib/utils/session.ts:298`, `src/lib/hooks/use-join-session-menu.ts:139` | `otherParticipantOf` on `session.participants` |
| Change kind dialog | `src/lib/change-relationship-dialog-model.ts:104` | `roleOf(relationship, member)` |
| Add relationship dialog | `src/lib/add-relationship-dialog-model.ts:102` | `roleOf(existing, member.userId)` |
| Duplicate error copy | `src/lib/api/relationship-errors.ts:53` | seat participants' names |
| Batch actions | `src/types/action.ts:147`, `src/lib/api/relationship-actions.ts:96` | `coachee_actions` → `actions_by_relationship` |
| 409 reason | `src/types/membership.ts:7` | delete `NotAMemberReason.Coachee` (src never switches on it); tests in `__tests__/types/membership.test.ts`, `resend-invite.test.ts`, `use-not-a-member-toast.test.tsx`, `use-move-session.test.tsx` |
| MSW handlers | `src/test-utils/msw-handlers.ts:27–35` | already stale (`coach_name`); return `participants` |

Left alone: equality checks that only match a pair or a participant, not a role (`coaching-relationship.ts:136`, `getRelationshipsForUser` at `:296–301` and its caller `people.ts:58`, `add-relationship-dialog-model.ts:85`, `actions-page-container.tsx:171`, `member-list.tsx:28`). They read seat ids, which the contract keeps.

### Actions page views (`src/types/assigned-actions.ts:81–84`)

Jim: the toggle follows the viewer's roles across their relationships in the current organization (`viewer.role`), and colleagues get their own view. No BE change: `assignee=colleague` exists (contract `AssigneeScopeColleague` v1, rs#512).

| Viewer's roles | Toggle |
|---|---|
| coach and colleague | My Actions \| Coachee Actions \| Colleagues' Actions |
| coach only | My Actions \| Coachee Actions |
| colleague only | My Actions \| Colleagues' Actions |
| coachee only | none (My Actions) |

- Types: rename `CoachViewMode` → `ActionsViewMode` (colleagues use it now) with members `MyActions`, `CoacheeActions`, new `ColleagueActions = "colleague_actions"`. URL values unchanged, so bookmarks keep working. Add `AssigneeScope.Colleague = "colleague"`.
  - This replaces the earlier member rename: with its own colleague view, `CoacheeActions` names exactly what it shows (Jim agreed).
  - Rename sites: `assigned-actions.ts:78–84` (and its doc comment), `use-actions-view.ts:7, 17, 25`, `use-all-actions-with-context.ts:7, 62`, container `:22, 117, 304`, header `:23, 30–32, 73, 80, 86`, `use-actions-fetch.ts:14` and the doc comments at `:52–56, 72–76`, `__tests__/lib/hooks/use-open-action-count.test.ts:6, 71`.
- `actionsViewsFor(relationships): ActionsViewMode[]` next to `coachesAnyone` in `coaching-relationship.ts`: My Actions always; Coachee Actions if any `viewer.role` is Coach; Colleagues' Actions if any is Colleague. Pure, unit-tested.
- Container (`actions-page-container.tsx:62, 99–101, 304`): replaces `isACoach` (auth store, any org) with `actionsViewsFor` on the current organization's relationships.
  - The URL's `view` stays in state as the requested view, never rewritten by loading. The effective view is the requested one when the viewer has it, else My Actions (a colleague-only member at `?view=coachee_actions` gets My Actions, not an empty board).
  - Resolve views only once the relationships list has loaded (it returns `[]` while loading, which would read as "coachee only"): until then the toggle area is a steady placeholder and nothing is fetched (the fetch already waits, `use-actions-fetch.ts:101, 121`).
  - `relationshipOptions` (`:168–176`) lists today every relationship the user is in, either kind. Narrow it by the effective view: Coachee Actions → relationships where `viewer.role` is Coach; Colleagues' Actions → `kind` Colleague; My Actions → all. Add the view to its deps.
  - The effective `rel` is the URL's only when it's in those options, else none, computed before the fetch. This matters: with `rel`, the fetch uses the single-relationship route (`relationship-actions.ts:50–57`), which 422s on a scope the relationship doesn't have, so a bookmarked `?view=colleague_actions&rel=<coaching rel>` must never be sent. The URL's `rel` is removed only on a user's view switch (`handleViewModeChange`), not on load.
- Header (`actions-page-header.tsx:66–92`): takes `views: ActionsViewMode[]` instead of `isCoach`; renders the toggle when there are two or more, items mapped from a label table. Label "Colleagues' Actions" (Jim). Check the three-item group at phone width; the row already wraps.
- Fetch (`use-actions-fetch.ts:58–67, 103–112`): `selectAssigneeScope` switches on the view (exhaustive): Colleagues' Actions → `Some(AssigneeScope.Colleague)`. With the relationship filter narrowed per view, the `filteredToColleagues` case (Coachee Actions narrowed to a colleague relationship, sent with no scope) goes away.
- Unassigned stays scope-less in every view, as today (`use-actions-fetch.ts:39–42`): an unassigned action belongs to no one, so the Coachee and Colleagues' views show the same unassigned list across both kinds unless a relationship is picked.
- Unchanged: `goals-overview-card.tsx:180` (dashboard, coaching only), the header Actions badge (`use-open-action-count.ts:21`, `DEFAULT_ACTIONS_VIEW`).

### Not changing

- `?role=` on GET /users/{id}/coaching-relationships: the FE doesn't send it.
- `coach_id` / `coachee_id`: kept by the contract; their rename is a later phase.
- Display copy: Phase 4 already keys copy off the role; this PR only changes where the role comes from.

## Tests

- Factories first: `createMockRelationship` and `createMockEnrichedSession` (`__tests__/test-utils.ts`), `__tests__/utils/action-test-utils.ts`, `__tests__/factories/coaching-session.factory.ts` and `__tests__/lib/scheduling/roster.ts` build `participants`. A `createMockParticipant` helper.
- 23 unit test files inline the removed relationship keys, and 5 inline `coach:` / `coachee:` session users (`upcoming-session-card`, `use-all-actions-with-context`, `use-join-session-menu`, `assigned-actions.test`, `session.test`); move them onto the factories rather than re-inlining.
- Actions views: `actionsViewsFor` for each row of the role table; header renders 0, 2 or 3 items; container falls back to My Actions for a view the viewer lacks, keeps the URL's `view` while relationships load, and never requests with a `rel` the view doesn't offer (bookmarked `?view=colleague_actions&rel=<coaching rel>` and `?view=coachee_actions&rel=<colleague rel>`); fetch sends `assignee=colleague` for Assigned and All, none for Unassigned. Update `actions-page-header.test.tsx`, `actions-page-container.test.tsx`, `use-actions-fetch.test.ts`, `use-all-actions-with-context.test.ts`, `use-open-action-count.test.ts`. E2E: one new spec, isolated with `page.route` via `helpers.ts:287` (relationship mocks carrying `viewer.role`), for a coach-and-colleague viewer: three items, and Colleagues' Actions requests `assignee=colleague`. `coach-actions-not-regressed.spec.ts:120` and `coachee-sees-own-actions.spec.ts:176` keep passing; their mocks need `viewer.role` too.
- New unit tests: the boundary parser (accepts the new shape, rejects the old with an error), `src/lib/participants.ts` (including the self-relationship), `roleOf` driving profile roles for a colleague-only user, `actions_by_relationship` parsing, `participant_not_a_member` for coaching.
- E2E route mocks (14 files: `helpers.ts`, `new-session-dialog-layout-helpers.ts`, `header`, `topic-provenance`, `coachee-sees-own-actions`, `week-grid-roles`, `add-relationship-dialog`, `action-edit-textarea-scroll`, `actions-exit-animation`, `coach-actions-not-regressed`, `join-session-menu`, `resend-calendar-invite`, `week-grid-drag`, `week-grid-navigation`) switch to the new shapes and drop `display_name` from people. Run one or two in Docker; CI runs the rest.
- Manual (`colleague_relationships_manual_testing.md`): COL-24 and COL-34a expect the toggle per the role table (MEMBER: My \| Colleagues'; COACH: all three; KID: My \| Colleagues'; COACHEE: none). COL-44 becomes "RC isn't offered in Coachee Actions' relationship filter, and `?view=coachee_actions&rel=<RC>` sends no request with RC". COL-45 becomes "falls back to My Actions". New COL-48: Colleagues' Actions with COL-41's seed, as MEMBER (Assigned: COACH-only and both, never MEMBER-only; `assignee=colleague`) and as COACH (no R1 action); Unassigned shows every unassigned action, R1's included.
- Manual: add a phase 6 section to `docs/test-plans/colleague_relationships_manual_testing.md` (names, roles, membership, actions board, removed-member refusal for coaching and colleagues).

## Order of work (one PR, reviewable commits)

1. Types, boundary parser wired into the fetchers, `participants.ts`, factories.
2. Relationship readers (utils, role helpers, membership, people, user-roles).
3. Session readers (`participants` on sessions, the four "other person" sites, `buildRelationshipWithUserNames`).
4. `actions_by_relationship`, `participant_not_a_member`.
4a. Actions page views (FE only; needs no phase 6 BE change, so it can be verified against today's BE).
5. Remove dead helpers; removal sweep (grep src, tests, e2e, docs for every removed key; full lint diffed against main).
6. Tests, e2e mocks, manual plan.

## Release

First, both PRs together on one PR preview (`backend_ref: PR#<be>`).

Merging to `main` builds only the non-production images (`build_and_push_nonproduction_images.yml`). Production images build only from a published GitHub release (`build_and_push_production_images.yml`), and `deploy_to_do.yml` is a manual dispatch. So for production: merge the FE PR, merge the BE PR, cut a release in both repos and wait for both production images, then run one deploy. Open tabs on the old FE show the relationship error state until reloaded.

## Decisions (Jim, 2026-11-19)

This plan is committed in the FE PR.

1. Keep the `CoachingRelationshipWithUserNames` name in this PR.
2. Keep the `?view=coachee_actions` URL value. Rename the type `CoachViewMode` → `ActionsViewMode`, not the member.
3. Keep the "Coachee Actions" label; add the role-driven toggle with "Colleagues' Actions".
