# Plan B: Global Actions Page — Kanban Board at `/actions`

## Context

This is future work. The global `/actions` page provides a holistic view of ALL actions across ALL coaching sessions and ALL time. The kanban board is the right UI for this scope — drag-and-drop between status columns makes sense when triaging a large backlog.

## Route Structure

Follow the existing dashboard pattern:

| File | Purpose |
|------|---------|
| `src/app/actions/layout.tsx` | Standard app layout (copy from `src/app/dashboard/layout.tsx`) |
| `src/app/actions/page.tsx` | Renders `ActionsPageContainer` inside `PageContainer` |

## Sidebar Navigation

**Modify**: `src/components/ui/app-sidebar.tsx` — add "Actions" link below "Dashboard" using `CheckSquare` icon from lucide-react.

## Component Structure

| File | Purpose |
|------|---------|
| `src/components/ui/actions/actions-page-container.tsx` | Orchestrator — data fetching, filter state, renders header + board |
| `src/components/ui/actions/actions-page-header.tsx` | Title + filter controls row |
| `src/components/ui/actions/kanban-board.tsx` | Kanban board with drag-and-drop columns |

## Code Relocation

The kanban board code originally prototyped in `previous-actions-cards.tsx` should be adapted and moved to `src/components/ui/actions/`:
- `KanbanBoard`, `KanbanColumn`, `DraggableActionCard`, `DragOverlay` setup
- Adapt to use real `Action` type + `SessionActionCard` from Plan A
- `GhostCard` -> use `NewActionCard` from Plan A
- `statusBadgeVariant()`, `statusLabel()`, `COLUMN_ORDER` -> extract to shared util

## Filtering (Design Direction)

- **Status**: ToggleGroup — Outstanding | All | Completed
- **Time range**: Select — Last 30 days | Last 90 days | All time
- **Coaching relationship**: Select — filter by relationship
- **Assignee**: My actions vs All

## Data Fetching

```typescript
useUserActionsList(userId, {
  scope: UserActionsScope.Sessions,
  // No coaching_session_id — all sessions
});
```

## Dependencies

- `@dnd-kit/core` and `@dnd-kit/utilities` (already installed)

## After Plan B Implementation

- `@dnd-kit` packages only used by the global page, not the session tab
