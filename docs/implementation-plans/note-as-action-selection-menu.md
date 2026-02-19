# Add a Note as an Action — Selection Bubble Menu

**Issue:** [#286](https://github.com/refactor-group/refactor-platform-fe/issues/286)
**Parent:** [#283](https://github.com/refactor-group/refactor-platform-fe/issues/283) (Improve working with Actions)

## Context

Coaches and coachees want to select text in their coaching session notes and quickly turn it into an Action for that session. Previously, creating an action required switching to the Actions tab and manually typing or pasting the text. This feature eliminates that friction by offering an inline selection toolbar that appears when text is selected in the notes editor.

## Design Decision: BubbleMenu over Right-Click Context Menu

A TipTap BubbleMenu (floating toolbar above selected text) was chosen over a right-click context menu.

| Criteria | BubbleMenu | Right-Click Context Menu |
|---|---|---|
| Discoverability | Appears automatically on selection | Hidden behind right-click |
| Existing pattern | `LinkBubbleMenu` already uses this | No `ContextMenu` component exists; needs new dependency |
| Native menu conflict | None | Replaces browser context menu (spell check, copy/paste) |
| Accessibility | Visible, focusable buttons with tooltips | Screen readers handle custom context menus inconsistently |
| Mobile/touch | Works naturally with touch selection | Long-press context menus are awkward |
| Implementation cost | Small — follows existing architecture | Medium — new component, new dependency |

## Architecture

### SelectionBubbleMenu Component

A **general-purpose selection toolbar** (not action-specific) that appears when text is selected in the TipTap editor. Icon-only buttons with vertical separators:

```
[ Copy icon ] | [ Add as Action icon ] | [ X Close ]
```

The component is designed to be extensible — future actions (e.g., "Add as Agreement") can be added as new icon buttons before the Close separator.

### shouldShowSelectionMenu Logic

The visibility predicate is extracted as a pure, exported function for testability. It is mutually exclusive with `LinkBubbleMenu`:

- Selection must be non-empty (`from !== to`)
- Selection must NOT be inside a link (`!editor.isActive("link")`)
- Selection must NOT be inside a code block (`!editor.isActive("codeBlock")`)
- Selected text must contain non-whitespace characters

When a selection partially includes a link, `editor.isActive("link")` returns `true`, so `LinkBubbleMenu` takes priority.

### Close Button Behavior

A local `dismissed` state flag is set `true` when the X button is clicked. This is reset to `false` on the next `selectionUpdate` event, so making a new selection re-shows the menu.

### Callback Threading

The notes editor and action creation logic live in separate tabs. The `onAddAsAction` callback is threaded from `CoachingTabsContainer` through `CoachingNotes` into the `SelectionBubbleMenu`:

```
CoachingTabsContainer (handleAddNoteAsAction)
  └─ CoachingNotes (onAddAsAction prop)
       └─ EditorProvider
            ├─ LinkBubbleMenu
            └─ SelectionBubbleMenu (onAddAsAction prop)
```

### Action Creation Defaults

When "Add as Action" is clicked:
- **Body:** trimmed selected text
- **Status:** `NotStarted`
- **Due date:** 7 days from now
- **Assignees:** none (can be edited later in Actions tab)

A success toast with a "View Actions" button switches to the Actions tab.

## Reused Patterns and Primitives

| What | Reused from | Path |
|---|---|---|
| Editor instance | `useTiptapEditor()` hook | `src/lib/hooks/use-tiptap-editor.ts` |
| Button with tooltip | tiptap-ui-primitive `Button` | `src/components/ui/tiptap-ui-primitive/button/button.tsx` |
| Vertical separator | tiptap-ui-primitive `Separator` | `src/components/ui/tiptap-ui-primitive/separator/separator.tsx` |
| BubbleMenu component | `BubbleMenu` from `@tiptap/react/menus` | Same pattern as `link-bubble-menu.tsx` |
| Clipboard copy | `navigator.clipboard.writeText()` | Pattern from `src/components/ui/share-session-link.tsx` |
| Icon styling | `.tiptap-button-icon` CSS class | Used by all tiptap-ui button components |
| Button data attributes | `data-style="ghost"` | Pattern from `mark-button.tsx` and `link-bubble-menu.tsx` |
| Toast with action | `sonner` API | Toaster config in `src/components/ui/sonner.tsx` |
| Error handling | `EntityApiError.isNetworkError()` | Pattern from `actions-panel.tsx` and `new-action-card.tsx` |
| SCSS styling | Popover background, border, shadow | Mirrors `link-bubble-menu.scss` |

## Files Changed

| File | Type | Description |
|---|---|---|
| `__tests__/components/ui/tiptap-ui/selection-bubble-menu.test.tsx` | NEW | 12 tests (7 shouldShow logic, 5 component rendering) |
| `src/components/ui/tiptap-ui/selection-bubble-menu/selection-bubble-menu.tsx` | NEW | SelectionBubbleMenu component with shouldShowSelectionMenu |
| `src/components/ui/tiptap-ui/selection-bubble-menu/selection-bubble-menu.scss` | NEW | Bubble menu styles |
| `src/components/ui/tiptap-ui/index.tsx` | MODIFY | Added SelectionBubbleMenu export |
| `src/components/ui/coaching-sessions/coaching-notes.tsx` | MODIFY | Accept `onAddAsAction` prop, render SelectionBubbleMenu inside EditorProvider |
| `src/components/ui/coaching-sessions/coaching-tabs-container.tsx` | MODIFY | Added `handleAddNoteAsAction` handler with toast, passed to CoachingNotes |

## Testing

### Approach: TDD

Tests were written first and confirmed to fail (module not found), then the component was built to make them pass.

### Test Coverage

**`shouldShowSelectionMenu` pure function (7 tests):**
- Non-empty text selection outside links/code blocks → `true`
- Empty/cursor selection → `false`
- Inside a link → `false`
- Inside a code block → `false`
- Whitespace-only selection → `false`
- Both link and code block active → `false`
- Text with surrounding whitespace (trimmed non-empty) → `true`

**Component rendering (5 tests):**
- Renders without crashing when no editor available
- Mounts inside EditorProvider without errors
- Does not call `onAddAsAction` before user interaction
- Does not call `clipboard.writeText` before user interaction
- Accepts optional editor prop

### Manual QA Checklist

- [ ] Select text in notes → selection toolbar appears above the selection
- [ ] Click Copy icon → text copied to clipboard
- [ ] Click Add as Action icon → success toast appears, action visible in Actions tab
- [ ] Toast "View Actions" button switches to Actions tab
- [ ] Click X → menu dismisses; select new text → menu reappears
- [ ] Select a link → only LinkBubbleMenu appears
- [ ] Partially select across a link boundary → LinkBubbleMenu takes priority
- [ ] Select text in code block → no SelectionBubbleMenu
- [ ] Collaborative editing: create action while another user is editing → no conflicts
