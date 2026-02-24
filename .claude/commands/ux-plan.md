Plan the UX/UI for a new feature by exploring the current UI, understanding existing patterns,
and producing visual prototypes with implementation guidance. You are a product-minded UX
engineer who designs within the constraints of the existing design system.

**Input**: $ARGUMENTS — feature description and target area (e.g. `"notification bell in the top nav"`,
`"bulk action toolbar for the actions page"`)

## Workflow

### 0. Ensure dev server is running and authenticate
Before any browser interaction, check if the dev server is already running:
- Run `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` via Bash
- If the response is `000` (connection refused) or any non-2xx/3xx code, start the dev
  server in the background: `npm run dev:pw &` via Bash, then poll `http://localhost:3000`
  every 2 seconds (up to 30 seconds) until it responds
- If it's already responding, proceed immediately

Then authenticate if needed:
- Use Playwright MCP to navigate to the target route
- If the page is the login form (URL is `/` and the page contains a "Sign In with Email"
  button), auto-login:
  1. Read `PW_LOGIN_EMAIL` and `PW_LOGIN_PASSWORD` from `.env.local` via Bash:
     `grep '^PW_LOGIN_EMAIL=' .env.local | cut -d'"' -f2`
  2. If either is empty, ask the user to fill in their credentials in `.env.local`
  3. Click the `#email` input and type the email
  4. Click the `#password` input and type the password
  5. Click the "Sign In with Email" button
  6. Wait for navigation to complete (URL should change away from `/`)
- If already on an authenticated page, proceed immediately

### 1. Understand the feature request
Parse the input to identify:
- What the feature does (user-facing behavior)
- Where it lives in the app (which route/area)
- Who uses it (coach, coachee, both)
- What triggers it and what it produces

Ask clarifying questions if the request is ambiguous.

### 2. Read the source code for the target area
- Find the page/component source for where the feature will live
  (trace from `src/app/` → page.tsx → component tree)
- Use Serena's `get_symbols_overview` and `find_symbol` to map the component hierarchy
- Note the existing layout patterns, data flow, and component composition

### 3. Capture the current UI state
- Navigate to the target area with Playwright MCP
- Take screenshots at desktop (1280px), tablet (768px), and mobile (375px)
- Capture the surrounding UI context — what's above, below, beside the target area

### 4. Survey existing patterns and available components
Search the codebase for patterns that inform the design:
- **Nearby features**: How do similar features in the same area work? What components do they use?
- **shadcn components**: Check `src/components/ui/` for available primitives
  (buttons, cards, dialogs, dropdowns, tabs, etc.)
- **Kibo UI components**: Check `src/components/kibo/ui/` for specialized components
  (pill, choicebox, etc.)
- **Layout patterns**: How are other pages/sections structured? What grid/flex patterns are used?
- **Data types**: Check `src/types/` for relevant domain types the feature will need
- **API patterns**: Check `src/lib/api/` for existing API namespaces the feature might use

### 5. Design 2-3 options
For each option, design a complete UX approach:

**Option N: [Descriptive name]**
- **Concept**: One-sentence description of the approach
- **Layout**: Where elements are placed, how they relate to surrounding UI
- **Components**: Which existing components to use (specific file paths)
- **New components needed**: Any components that don't exist yet
- **Interaction flow**: Step-by-step user interaction (click → see → do)
- **States**: Empty, loading, populated, error, edge cases
- **Responsive behavior**: How it adapts at tablet and mobile
- **Tradeoffs**: Pros and cons of this approach

### 6. Generate visual prototypes for each option
For each design option:
1. Create a prototype at `src/app/prototype/[feature]-option-[n]/page.tsx`
2. Start from a faithful reproduction of the existing surrounding UI — copy the exact
   layout, Tailwind classes, and component hierarchy from the real source code
3. Use realistic mock data matching types from `src/types/`
4. Add the new feature using the project's actual shadcn/Kibo UI components
5. Include surrounding context (sidebar, nav, page shell) so the feature is seen in situ
6. Navigate to `http://localhost:3000/prototype/[feature]-option-[n]` and screenshot at
   desktop, tablet, and mobile viewports

Present each option with its screenshot(s) and a summary of tradeoffs.

### 7. Create flow diagrams
Use Figma MCP's `generate_diagram` to create FigJam diagrams showing:
- **User flow**: How the user discovers, enters, uses, and exits the feature
- **State transitions**: If the feature has multiple states (e.g., collapsed/expanded,
  empty/populated), diagram the transitions
- **Navigation impact**: If the feature affects app navigation, show how it integrates
  with the existing nav structure

### 8. Produce the implementation plan
After presenting the visual options, provide implementation guidance for each:

- **Component plan**: Files to create/modify, with paths
- **Data requirements**: Types, API calls, store changes needed
- **Interaction spec**: Events, handlers, state management approach
- **Accessibility**: ARIA labels, keyboard navigation, focus management, screen reader considerations
- **Testing approach**: What to test and how (unit, integration, E2E)

### 9. Recommend an option
State which option you recommend and why, considering:
- Consistency with existing UI patterns
- Implementation complexity vs UX benefit
- Accessibility
- Responsive behavior
- Future extensibility

## Important notes
- Always read source code before generating prototypes — never guess at the layout
- Use the project's actual shadcn (`@/components/ui/`) and Kibo UI (`@/components/kibo/ui/`) components
- Import `cn` from `@/components/lib/utils`
- Prototypes should be visually indistinguishable from the real page except for the new feature
- Design within the existing design system — don't introduce new colors, fonts, or spacing
  values that aren't already in the Tailwind config
- Reference `.claude/coding-standards.md` for TypeScript and React conventions
- Clean up prototype files after the user has reviewed them (or note they should be cleaned up)
