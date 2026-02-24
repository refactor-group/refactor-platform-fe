# Playwright MCP — UX/UI Verification & Planning Infrastructure

## Status: Implemented

## Goal

Configure Playwright MCP so Claude Code can launch a browser, navigate the running app, take screenshots, and interact with UI elements. Build three Claude commands on top of this capability, with **visual prototype generation** (HTML prototypes using real components) and **FigJam diagram creation** for flow suggestions.

1. **`/ux-verify`** — Verify that a feature's implementation matches design intent
2. **`/ux-explore`** — Explore existing UI and suggest UX/UI improvements
3. **`/ux-plan`** — Plan new feature UX by examining the current UI state

---

## Prerequisites

- Dev server running at `http://localhost:3000` (already configured in `playwright.config.ts`)
- Playwright already installed as a devDependency (`@playwright/test@^1.55.1`)
- Existing E2E helpers in `__tests__/e2e/helpers.ts` for auth/API mocking

---

## Step 1: Configure Playwright MCP Server

### File: `/.mcp.json` (project root)

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--caps", "vision"]
    }
  }
}
```

**Why `--caps vision`?** This enables coordinate-based interactions (click_xy, drag_xy, mouse_move_xy, etc.) for precise visual work. The primary use cases are visual — comparing screenshots against designs, evaluating layout/spacing, and verifying UI appearance.

**Alternative:** If accessibility-tree mode is ever needed (e.g., for programmatic structure analysis), a second MCP server entry could be added without `--caps vision`. Not needed initially.

### Permissions

Playwright MCP tool permissions added to `.claude/settings.local.json` under `permissions.allow`:

```json
"mcp__playwright__browser_navigate",
"mcp__playwright__browser_take_screenshot",
"mcp__playwright__browser_click",
"mcp__playwright__browser_type",
"mcp__playwright__browser_hover",
"mcp__playwright__browser_drag",
"mcp__playwright__browser_press_key",
"mcp__playwright__browser_select_option",
"mcp__playwright__browser_snapshot",
"mcp__playwright__browser_navigate_back",
"mcp__playwright__browser_wait_for",
"mcp__playwright__browser_tabs",
"mcp__playwright__browser_resize",
"mcp__playwright__browser_console_messages",
"mcp__playwright__browser_evaluate",
"mcp__playwright__browser_close",
"mcp__playwright__browser_fill_form",
"mcp__playwright__browser_file_upload",
"mcp__playwright__browser_handle_dialog",
"mcp__playwright__browser_network_requests",
"mcp__playwright__browser_run_code",
"mcp__playwright__browser_install",
"mcp__playwright__browser_mouse_click_xy",
"mcp__playwright__browser_mouse_move_xy",
"mcp__playwright__browser_mouse_drag_xy",
"mcp__playwright__browser_mouse_down",
"mcp__playwright__browser_mouse_up",
"mcp__playwright__browser_mouse_wheel"
```

> **Note:** Tool names based on the Playwright MCP README. If any differ at runtime, adjust accordingly.

---

## Step 2: Convenience npm Script

### File: `package.json`

```json
"dev:pw": "npm run dev"
```

Alias that makes intent clear when starting the dev server for Playwright MCP sessions. Provides a hook point for future env vars (e.g., `NEXT_PUBLIC_MOCK_AUTH=true`).

---

## Step 3: Prototype Route Scaffold

### File: `src/app/prototype/layout.tsx`

Minimal layout that renders prototype content with the root layout's global styles and theme provider, but prototype pages themselves are standalone — no auth/sidebar required.

```tsx
import type { ReactNode } from "react";

export default function PrototypeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
```

### File: `src/app/prototype/.gitignore`

```
# Ignore generated prototypes, keep layout and gitignore
**/page.tsx
!layout.tsx
```

Generated prototypes are placed as subdirectories (e.g., `src/app/prototype/dashboard-redesign/page.tsx`) and served at `http://localhost:3000/prototype/dashboard-redesign`.

### Prototype Fidelity Principle

All three commands follow the same fidelity approach:

1. **Read the existing page's source code first** — use Serena/Grep/Glob to find the actual component tree, layout classes, and data shapes
2. **Reproduce the current state faithfully** — copy the exact layout structure, Tailwind classes, and component hierarchy. Use realistic mock data matching actual types from `src/types/`. The prototype should be visually indistinguishable from the real page.
3. **Include surrounding context** — when the change needs to be seen in situ (sidebar, nav, page shell), replicate the surrounding UI using the same components
4. **Show the proposed change on top** — modify the faithful reproduction to demonstrate the improvement
5. **Generate before and after prototypes** when the change is substantial

---

## Step 4: Claude Commands

All commands in `.claude/commands/`.

### 4a. `/ux-verify` — Verify Implementation Against Design

**File:** `.claude/commands/ux-verify.md`

Workflow:
1. Gather design reference (Figma MCP if URL provided, or text description)
2. Read source code for the target route's component tree
3. Navigate with Playwright, capture screenshots at 3 viewports + interactive states
4. Compare against design — structured report: Matches / Mismatches / Suggestions
5. Generate faithful HTML prototypes showing proposed fixes (before/after)
6. Create FigJam flow diagrams for navigation/flow suggestions

### 4b. `/ux-explore` — Explore & Suggest Improvements

**File:** `.claude/commands/ux-explore.md`

Workflow:
1. Read source code for the target area
2. Navigate and capture initial state
3. Systematically explore: interactive elements, hover/focus states, sub-flows, responsive behavior
4. Evaluate against UX best practices (hierarchy, consistency, spacing, feedback, empty/loading/error states)
5. Prioritized report: Critical / Important / Nice-to-have
6. Generate faithful HTML prototypes showing improvements (before/after)
7. Create FigJam flow diagrams for navigation improvements

### 4c. `/ux-plan` — Plan New Feature UX

**File:** `.claude/commands/ux-plan.md`

Workflow:
1. Understand feature request, read source code for target area
2. Capture current UI state with Playwright
3. Survey existing patterns and available components (shadcn, Kibo UI, layout patterns, data types)
4. Design 2-3 options with component plans, interaction specs, responsive considerations
5. Generate faithful HTML prototypes for each option (feature shown in context of existing UI)
6. Create FigJam flow diagrams for user flows and state transitions
7. Recommend an option with rationale

---

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `.mcp.json` | Created | Playwright MCP server config (vision mode) |
| `.claude/settings.local.json` | Edited | Added Playwright MCP tool permissions |
| `package.json` | Edited | Added `dev:pw` script alias |
| `src/app/prototype/layout.tsx` | Created | Minimal layout for prototype pages |
| `src/app/prototype/.gitignore` | Created | Ignore generated page.tsx files, keep layout |
| `.claude/commands/ux-verify.md` | Created | Verify implementation vs design intent |
| `.claude/commands/ux-explore.md` | Created | Explore UI, suggest improvements with visuals |
| `.claude/commands/ux-plan.md` | Created | Plan new feature UX with prototypes + flows |

---

## Open Questions (Resolved)

1. **Auth for Playwright MCP sessions**: Assuming manual login for now. Root layout providers wrap prototype pages but don't redirect — they just provide context. Future enhancement: auto-inject auth state.

2. **Vision mode vs accessibility mode**: Using `--caps vision` only. Accessibility-tree mode can be added later as a second server entry.

3. **Figma integration**: `/ux-verify` uses Figma MCP optionally. Falls back to textual description if no Figma URL provided. FigJam diagrams available for all three commands.

4. **Screenshot storage**: Ephemeral in-conversation screenshots. Can add persistence later.

5. **Tool names**: Based on Playwright MCP README documentation. Adjust at runtime if needed.

## Future Enhancements

- **Code Connect**: Map Figma component library → codebase components for design-to-code accuracy
- **Accessibility-tree mode**: Second Playwright MCP entry without `--caps vision`
- **Persistent screenshot archive**: Save to `docs/ux-screenshots/` for historical comparison
- **Auth helper**: Auto-inject auth state for Playwright sessions
