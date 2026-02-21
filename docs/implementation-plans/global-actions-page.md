# Global Actions Page — Kanban Board at `/actions`

Issue: [#302](https://github.com/refactor-group/refactor-platform-fe/issues/302)

## Status: Implemented

The global `/actions` page provides a holistic view of ALL actions across ALL coaching sessions. A kanban board with drag-and-drop between status columns enables triage and status management.

---

## Architecture

### Route Structure

| File | Purpose |
|------|---------|
| `src/app/actions/layout.tsx` | Standard app layout (mirrors `dashboard/layout.tsx`) |
| `src/app/actions/page.tsx` | Renders `ActionsPageContainer` inside `PageContainer` |

### Sidebar Navigation

`src/components/ui/app-sidebar.tsx` — "Actions" link below "Dashboard" using `CheckSquare` icon from lucide-react.

### Component Hierarchy

```
ActionsPageContainer
├── ActionsPageHeader
│   ├── <h1>Actions</h1>
│   ├── CoachViewToggle (My Actions | Coachee Actions — coach only)
│   ├── StatusVisibilityFilter (ToggleGroup: Open | All | Closed)
│   ├── TimeRangeFilter (Select: Last 30d | 90d | All time)
│   ├── TimeFieldToggle (ToggleGroup: Due date | Created date)
│   └── RelationshipFilter (Select: All | specific relationship)
└── KanbanBoard
    ├── DndContext
    │   ├── KanbanColumn (NotStarted) — useDroppable
    │   │   └── KanbanActionCard[] — useDraggable
    │   ├── KanbanColumn (InProgress)
    │   ├── KanbanColumn (Completed)
    │   ├── KanbanColumn (WontDo)
    │   └── DragOverlay → KanbanActionCard (drag preview)
```

### Component Files

| File | Purpose |
|------|---------|
| `src/components/ui/actions/actions-page-container.tsx` | Orchestrator — auth, data, filter state, mutations |
| `src/components/ui/actions/actions-page-header.tsx` | Title + filter controls row |
| `src/components/ui/actions/kanban-board.tsx` | DndContext + columns + DragOverlay |
| `src/components/ui/actions/kanban-column.tsx` | Droppable column with header + scrollable card list |
| `src/components/ui/actions/kanban-action-card.tsx` | Draggable wrapper around SessionActionCard + relationship badge |
| `src/components/ui/actions/utils.ts` | Pure utility functions (groupByStatus, filters, labels) |

### Data Fetching

| File | Purpose |
|------|---------|
| `src/lib/hooks/use-all-actions-with-context.ts` | Fetches + enriches all user actions (reuses existing pipeline) |

---

## Design Decisions

- **Card mode**: Full inline editing via `SessionActionCard` (variant="current")
- **Columns**: All 4 status columns always exist (NotStarted, InProgress, Completed, WontDo); visibility controlled by filter
- **Time filter**: User-selectable — filter by `due_by` or `created_at`
- **Scope**: User's own actions; coaches get a `CoachViewMode` toggle to view coachee actions
- **Data strategy**: Reuses the existing enrichment pipeline (`buildSessionLookupMaps` + `addContextToActions`) with same API calls as What's Due — no new backend endpoints
- **No sortable**: `@dnd-kit/sortable` not used — within-column ordering uses the sort filter, not manual drag reorder

## Filter Enums

Added to `src/types/assigned-actions.ts`:

| Enum | Values | Purpose |
|------|--------|---------|
| `StatusVisibility` | Open, All, Closed | Controls which kanban columns render |
| `TimeRange` | Last30Days, Last90Days, AllTime | Client-side date range filter |
| `TimeField` | DueDate, CreatedDate | Which date field the time range applies to |

## Drag-and-Drop Status Change Flow

1. `onDragEnd` fires with `active.id` (action ID) and `over.id` (target column = `ItemStatus`)
2. If target status differs from current:
   a. Call `ActionApi.update(actionId, { ...action, status: newStatus, status_changed_at: DateTime.now() })`
   b. On success: SWR revalidates via `useActionMutation`, card appears in new column
   c. On failure: Show error toast
3. Both status change methods work: drag to column OR inline `StatusSelect` dropdown

## Dependencies

- `@dnd-kit/core` — DndContext, useDraggable, useDroppable, DragOverlay
- `@dnd-kit/utilities` — CSS transform helpers

## Files Modified (existing)

| File | Change |
|------|--------|
| `src/types/assigned-actions.ts` | Added `StatusVisibility`, `TimeRange`, `TimeField` enums |
| `src/components/ui/app-sidebar.tsx` | Added "Actions" nav link with `CheckSquare` icon |
| `package.json` / `package-lock.json` | Added @dnd-kit deps |

## Files Created (new)

| File | Purpose |
|------|---------|
| `src/components/ui/actions/utils.ts` | groupByStatus, applyTimeFilter, statusLabel, etc. |
| `src/lib/hooks/use-all-actions-with-context.ts` | Fetches + enriches all user actions |
| `src/components/ui/actions/actions-page-container.tsx` | Page orchestrator |
| `src/components/ui/actions/actions-page-header.tsx` | Filter controls |
| `src/components/ui/actions/kanban-board.tsx` | DndContext + columns |
| `src/components/ui/actions/kanban-column.tsx` | Droppable column |
| `src/components/ui/actions/kanban-action-card.tsx` | Draggable card wrapper |
| `src/app/actions/layout.tsx` | Route layout |
| `src/app/actions/page.tsx` | Route page |

## Test Files

| File | Tests |
|------|-------|
| `__tests__/components/ui/actions/utils.test.ts` | 19 tests — pure utility functions |
| `__tests__/lib/hooks/use-all-actions-with-context.test.ts` | 9 tests — hook data fetching + enrichment |
| `__tests__/components/ui/actions/kanban-board.test.tsx` | 7 tests — column visibility, rendering, counts |
| `__tests__/components/ui/actions/actions-page-header.test.tsx` | 8 tests — filter controls, coach toggle |
| `__tests__/components/ui/actions/actions-page-container.test.tsx` | 8 tests — integration: loading, error, filter toggle |

**Total: 51 new tests, all passing**
