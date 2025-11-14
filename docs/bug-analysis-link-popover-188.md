# Bug Analysis: Link Popover Issue #188

**Issue**: [GitHub Issue #188](https://github.com/refactor-group/refactor-platform-fe/issues/188)
**Version**: 1.0.0-beta2
**Priority**: High (UX Impact)

## Problem Summary

The URL link popover exhibits three distinct issues:

1. **Duplicate Popover Display**: Popover sometimes appears twice - once in the correct location and once in the upper-left corner
2. **Poor Link Selection UX**: Clicking existing links doesn't show popover above/below the link as expected
3. **Navigation Difficulties**: Cursor behavior doesn't match standard rich text editors (popover should only appear when cursor is directly on link text)

## Root Cause Analysis

### Issue 1: Duplicate Popover Rendering

**Root Cause**: Portal positioning calculation issue in `popover.tsx:300-344`

The `PopoverContent` component has complex logic for determining the portal container and calculating positions:

```typescript
// popover.tsx:301-323
const portalContainer = React.useMemo(() => {
  if (!portal) return null;
  if (container) return container;

  // Find closest positioned ancestor (not static)
  const referenceElement = context.refs.reference.current;
  if (!referenceElement) return document.body;

  if ('parentElement' in referenceElement) {
    let element = referenceElement.parentElement;
    while (element) {
      const position = window.getComputedStyle(element).position;
      if (position !== 'static') {
        return element;
      }
      element = element.parentElement;
    }
  }

  return document.body;
}, [portal, container, context.refs.reference]);
```

**Problem**:
- The algorithm searches for a positioned ancestor, but when it finds one, it calculates relative positions (lines 326-344)
- However, FloatingUI already handles positioning through its middleware
- This creates a conflict where FloatingUI positions the element, then the component adjusts it again relative to the container
- Result: One popover at FloatingUI's calculated position, another at the adjusted position

**Evidence**:
- `containerRef` is passed from `SimpleToolbar` (line 85 of simple-toolbar.tsx) to `LinkPopover` (line 209 of coaching-notes.tsx)
- The ref points to `.coaching-notes-editor` div
- The popover component tries to be "smart" about positioning within this container
- But the dual positioning logic creates the duplicate appearance

### Issue 2: Popover Position When Editing Links

**Root Cause**: Single positioning strategy in `link-popover.tsx:243-353`

The `LinkPopover` component uses a fixed positioning strategy:

```typescript
// link-popover.tsx:334-352
<Popover {...popoverProps}>
  <PopoverTrigger asChild>
    <LinkButton ... />
  </PopoverTrigger>

  <PopoverContent
    sideOffset={8}
    alignOffset={0}
    side="bottom"
    align="start"
  >
    <LinkMain {...linkHandler} />
  </PopoverContent>
</Popover>
```

**Problem**:
- Popover is hardcoded to `side="bottom"` and `align="start"`
- This works for the toolbar button trigger
- But doesn't adapt when the user is editing an existing link in the text
- When a link is active in the editor, the popover should position relative to the link text, not the toolbar button

**Missing Logic**: No detection of whether user is:
1. Creating a new link (position under toolbar button ✓)
2. Editing an existing link (should position near the link text ✗)

### Issue 3: Auto-Open Behavior

**Root Cause**: Aggressive auto-open logic in `link-popover.tsx:45-77`

```typescript
// link-popover.tsx:49-59
React.useEffect(() => {
  if (!editor) return;
  const { href } = editor.getAttributes("link");

  if (editor.isActive("link") && url === null) {
    setUrl(href || "");
    onLinkActive?.(); // Triggers popover open
  }
}, [editor, onLinkActive, url]);

// link-popover.tsx:61-77
React.useEffect(() => {
  if (!editor) return;

  const updateLinkState = () => {
    const { href } = editor.getAttributes("link");
    setUrl(href || "");

    if (editor.isActive("link") && url !== null) {
      onLinkActive?.(); // Triggers popover open
    }
  };

  editor.on("selectionUpdate", updateLinkState);
  return () => editor.off("selectionUpdate", updateLinkState);
}, [editor, onLinkActive, url]);
```

**Problem**:
- Popover opens on **every** `selectionUpdate` event when cursor is on a link
- This happens even when user is just navigating through the document
- Standard rich text editor behavior: Only show popover when user **clicks** the link with intent to edit

**Expected Behavior**:
- User navigating with arrow keys across a link → No popover
- User clicking on a link → Show popover for editing
- Alternative: Show link preview tooltip (non-interactive) during navigation, full popover only on explicit interaction

## Impact Assessment

| Issue | Severity | User Impact | Frequency |
|-------|----------|-------------|-----------|
| Duplicate Popover | High | Confusing UI, looks broken | Occasional |
| Wrong Position on Edit | Medium | Annoying but usable | Every link edit |
| Aggressive Auto-Open | High | Prevents navigation | Every cursor movement on links |

## Proposed Solution

### Phase 1: Fix Duplicate Popover (Critical)

**Change**: Simplify portal positioning logic in `popover.tsx`

**Current approach**: Find positioned ancestor + calculate relative position
**New approach**: Trust FloatingUI's positioning, only use container for boundary clipping

```typescript
// popover.tsx - Simplified container logic
const portalContainer = React.useMemo(() => {
  if (!portal) return null;
  // Always use document.body for portal
  // Use boundary prop for constraining, not container positioning
  return document.body;
}, [portal]);

// Remove the complex position adjustment (lines 326-344)
const enhancedStyle = React.useMemo(() => {
  return {
    position: context.strategy,
    top: context.y ?? 0,
    left: context.x ?? 0,
    ...style,
  };
}, [context, style]);
```

**Rationale**:
- FloatingUI is designed to handle positioning with boundaries
- The `boundary` prop in `link-popover.tsx:318-322` should constrain the popover
- No need for custom position recalculation

### Phase 2: Adaptive Popover Positioning (High Priority)

**Change**: Detect context and position appropriately in `link-popover.tsx`

```typescript
// New utility function
function getLinkPositionInEditor(editor: Editor): { x: number; y: number } | null {
  if (!editor.isActive("link")) return null;

  const { state } = editor;
  const { from, to } = state.selection;
  const start = editor.view.coordsAtPos(from);
  const end = editor.view.coordsAtPos(to);

  return {
    x: start.left,
    y: start.bottom
  };
}

// In LinkPopover component
const linkPosition = React.useMemo(() => {
  if (!editor || !editor.isActive("link")) return null;
  return getLinkPositionInEditor(editor);
}, [editor, editor?.state.selection]);

const popoverPositioning = React.useMemo(() => {
  if (linkPosition) {
    // Editing existing link - position near the link
    return {
      side: "bottom" as const,
      align: "start" as const,
      sideOffset: 4,
    };
  } else {
    // Creating new link - position under toolbar button
    return {
      side: "bottom" as const,
      align: "start" as const,
      sideOffset: 8,
    };
  }
}, [linkPosition]);

// Apply to PopoverContent
<PopoverContent
  sideOffset={popoverPositioning.sideOffset}
  side={popoverPositioning.side}
  align={popoverPositioning.align}
>
```

**Alternative Approach**: Create two separate popovers:
- One triggered by toolbar button (current implementation)
- One triggered by link click in editor (new floating popover near link)

This is cleaner separation of concerns and matches standard rich text editor patterns.

### Phase 3: Improve Auto-Open Behavior (High Priority)

**Change**: Only auto-open on explicit user action, not cursor movement

```typescript
// Option A: Remove auto-open entirely
// Set autoOpenOnLinkActive={false} in simple-toolbar.tsx:85
<LinkPopover
  hideWhenUnavailable={false}
  containerRef={containerRef}
  autoOpenOnLinkActive={false}  // Add this
/>

// Option B: Smarter detection - only open on click, not selection change
const useLinkHandler = (props: LinkHandlerProps) => {
  const { editor, onSetLink, onLinkActive } = props;
  const [url, setUrl] = React.useState<string | null>(null);
  const lastInteractionType = React.useRef<'click' | 'selection' | null>(null);

  React.useEffect(() => {
    if (!editor) return;

    const handleTransaction = ({ transaction }: { transaction: any }) => {
      // Detect if this was a click vs keyboard navigation
      const wasMouse = transaction.getMeta('pointer');
      if (wasMouse && editor.isActive("link")) {
        const { href } = editor.getAttributes("link");
        setUrl(href || "");
        onLinkActive?.();
      }
    };

    editor.on("transaction", handleTransaction);
    return () => editor.off("transaction", handleTransaction);
  }, [editor, onLinkActive]);

  // Remove the aggressive selectionUpdate listener (lines 61-77)

  // ... rest of implementation
};

// Option C: Add click handler to links in the editor
// In coaching-notes.tsx, enhance createLinkClickHandler:
const createLinkClickHandler = (onLinkClick?: (href: string) => void) =>
  (_view: unknown, event: Event) => {
    const target = event.target as HTMLElement;
    const mouseEvent = event as MouseEvent;

    if (isClickOnLink(target, mouseEvent)) {
      if (mouseEvent.shiftKey) {
        // Existing behavior - open in new tab
        event.preventDefault();
        openLinkInNewTab(target);
        return true;
      } else {
        // New behavior - trigger link edit popover
        event.preventDefault();
        const href = getLinkHref(target);
        onLinkClick?.(href);
        return true;
      }
    }
    return false;
  };
```

**Recommendation**: Combination of Option A + Option C
- Disable aggressive auto-open on selection changes
- Add explicit click handler for links in editor content
- Keep toolbar button as primary entry point for creating new links

## Implementation Plan

### Step 1: Fix Duplicate Popover (30 min)
**File**: `src/components/ui/tiptap-ui-primitive/popover/popover.tsx`

- Simplify `portalContainer` logic (always use document.body)
- Remove complex position recalculation in `enhancedStyle`
- Test: Verify popover appears only once in correct location

### Step 2: Disable Aggressive Auto-Open (15 min)
**File**: `src/components/ui/coaching-sessions/coaching-notes/simple-toolbar.tsx`

- Add `autoOpenOnLinkActive={false}` prop to `LinkPopover`
- Test: Verify cursor can move across links without opening popover

### Step 3: Add Click-to-Edit Behavior (45 min)
**Files**:
- `src/components/ui/coaching-sessions/coaching-notes.tsx`
- `src/components/ui/tiptap-ui/link-popover/link-popover.tsx`

- Enhance `createLinkClickHandler` to detect normal clicks on links
- Add state management for "edit mode" in LinkPopover
- Position popover near clicked link (using TipTap's `coordsAtPos`)
- Test: Click on link → popover appears near link, not toolbar

### Step 4: Improve Positioning Strategy (1 hour)
**File**: `src/components/ui/tiptap-ui/link-popover/link-popover.tsx`

- Detect if editing existing link vs creating new link
- Use different positioning strategy for each case
- Consider implementing separate popovers for better separation
- Test: Both creation and editing workflows feel natural

### Step 5: Polish & Edge Cases (30 min)
- Test rapid clicking, keyboard navigation
- Test on different screen sizes
- Test with floating toolbar visible/hidden
- Ensure accessibility (keyboard-only workflow)

**Total Estimate**: 3 hours

## Testing Checklist

- [ ] Popover appears only once (no duplicate)
- [ ] Creating new link: Popover under toolbar button
- [ ] Editing existing link: Popover near link text
- [ ] Cursor navigation across links: No popover
- [ ] Click on link: Popover opens for editing
- [ ] Shift+click on link: Opens in new tab (existing)
- [ ] Keyboard-only workflow: Can create and edit links
- [ ] Floating toolbar: Link popover works when toolbar is floating
- [ ] Boundary constraints: Popover stays within editor container
- [ ] Rapid interactions: No visual glitches

## Alternative Approaches Considered

### Approach 1: Use TipTap's Built-in Link Extension
**Pros**: Battle-tested, maintained by TipTap team
**Cons**: Less customization, may not match design system
**Decision**: Rejected - Current implementation is nearly there, just needs fixes

### Approach 2: Implement Bubble Menu for Links
**Pros**: Standard pattern in rich text editors, appears directly near content
**Cons**: Requires refactoring, loses toolbar button UX
**Decision**: Consider for v2 - Good long-term direction

### Approach 3: Separate Toolbar Button and Inline Editor
**Pros**: Clear separation, easier to maintain
**Cons**: More components, more state management
**Decision**: Recommend for Step 4 if time permits

## References

- [TipTap Link Extension Docs](https://tiptap.dev/api/marks/link)
- [TipTap Bubble Menu](https://tiptap.dev/api/extensions/bubble-menu)
- [FloatingUI Positioning](https://floating-ui.com/docs/tutorial)
- [React Component Patterns for Rich Text](https://github.com/ianstormtaylor/slate/blob/main/site/examples/hovering-toolbar.tsx)

## Success Criteria

1. **No duplicate popovers**: Single popover instance, always correctly positioned
2. **Intuitive navigation**: Users can move cursor across links without popover appearing
3. **Clear editing workflow**:
   - Toolbar button → Popover under button
   - Click on link → Popover near link
4. **Performance**: No lag or visual glitches during interaction
5. **Accessibility**: Full keyboard navigation support maintained

---

**Analysis Date**: 2025-10-15
**Analyzed By**: Claude Code
**Status**: Ready for Implementation
