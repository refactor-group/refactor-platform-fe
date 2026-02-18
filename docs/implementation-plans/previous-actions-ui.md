# Plan A: Session Actions Tab — Vertical Card Stack

## Context

The Actions tab on a coaching session page serves three purposes:
1. Create new actions with metadata (assignee, due date, status)
2. Edit existing actions for this session
3. Review relevant outstanding actions from previous sessions

The session tab uses a focused, vertical card stack — sequential like a conversation, with clear separation between "this session" and "previous." The kanban board prototype is better suited for the future global `/actions` page (see `global-actions-page.md`).

All components use the real `Action` type and real API hooks — no mock/prototype data.

## Layout

```
+---------------------------------------------------+
|  This Session                                     |
|                                                   |
|  +-----------------------------------------------+|
|  | [Card] Review quarterly goals...              ||
|  | AR JL  .  Due: Feb 20  .  In Progress  [ ]    ||
|  +-----------------------------------------------+|
|  +-----------------------------------------------+|
|  | [Card] Schedule skip-level meeting...         ||
|  | JL     .  Due: Feb 25  .  Not Started  [ ]    ||
|  +-----------------------------------------------+|
|  + - - - - - - - - - - - - - - - - - - - - - - - +|
|  | + Add action                                  ||
|  | [body] [assignee v] [due date] [Save]         ||
|  + - - - - - - - - - - - - - - - - - - - - - - - +|
+---------------------------------------------------+
| > Previous Actions  * 3 outstanding     [chevron] |
|  (collapsible, shows outstanding from other       |
|   sessions -- status/checkbox editable,           |
|   body read-only, includes session link)          |
+---------------------------------------------------+
```

## Component Architecture

### `SessionActionCard` (`session-action-card.tsx`)

Card component for displaying a real `Action` with two variants:

- **`"current"`**: full editing (inline body edit, delete, all fields editable)
- **`"previous"`**: read-only body, no delete, status/checkbox still editable, shows session date link

Props: `action: Action`, coach/coachee IDs+names, change callbacks, `variant`, optional `onDelete`.

UI elements:
- Card with overdue red left border (`border-l-4 border-l-red-500`)
- Completed styling (`opacity-60`, `line-through`)
- Inline-editable body textarea (Enter to save, Escape to cancel)
- Assignee avatar stack with popover for toggling
- Due date calendar popover
- Status badge + Select dropdown
- Completion checkbox

### `GhostActionCard` (`ghost-action-card.tsx`)

Enhanced creation card capturing body, assignee, and due date.

- Idle: dashed-border placeholder with Plus icon + "Add action"
- Editing: textarea + `AssigneeSelector` dropdown + date picker + Save/Cancel
- Defaults due date to 7 days from now

### `ActionsList` (`actions-list.tsx`)

Orchestrator with two data sources:

1. **Current session actions**: `useUserActionsList(userId, { scope: Sessions, coaching_session_id })`
2. **All outstanding actions**: `useUserActionsList(userId, { scope: Sessions })` filtered client-side to exclude current session and keep only outstanding/overdue

Rendered layout:
- Section 1: vertical stack of `SessionActionCard variant="current"` + `GhostActionCard`
- Section 2: `Collapsible` with count badge, containing `SessionActionCard variant="previous"` cards

## Files

| File | Action |
|------|--------|
| `src/components/ui/coaching-sessions/session-action-card.tsx` | **Create** |
| `src/components/ui/coaching-sessions/ghost-action-card.tsx` | **Create** |
| `src/components/ui/coaching-sessions/actions-list.tsx` | **Rewrite** |
| `src/components/ui/coaching-sessions/coaching-tabs-container.tsx` | **Verify** (no changes needed) |
| `src/components/ui/coaching-sessions/previous-actions-cards.tsx` | **Delete** |

## Key Reusable Code

| What | File |
|------|------|
| `Action` type, `defaultAction()` | `src/types/action.ts` |
| `ItemStatus`, `actionStatusToString()` | `src/types/general.ts` |
| `useUserActionsList`, `UserActionsQueryParams` | `src/lib/api/user-actions.ts` |
| `UserActionsScope` | `src/types/assigned-actions.ts` |
| `AssigneeSelector`, `AssigneeOption`, `AssignmentType` | `src/components/ui/assignee-selector.tsx` |
| `Collapsible` / `CollapsibleContent` / `CollapsibleTrigger` | `src/components/ui/collapsible.tsx` |

## Verification

1. `npm run typecheck` passes
2. Navigate to coaching session > Actions tab
3. Session actions appear as vertical cards with real data
4. Create action via ghost card (body + assignee + due date) -> card appears
5. Inline edit body, change status, toggle checkbox, change due date, change assignees -> all persist via API
6. Delete action -> card removed
7. Collapsible "Previous Actions" shows outstanding items from other sessions with count badge
8. Previous action cards: status/checkbox editable, body read-only, session link shown
9. Overdue styling (red border, red date) works correctly
10. Empty states handled gracefully
