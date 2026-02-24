Explore an area of the app's UI and provide UX/UI improvement suggestions with visual
prototypes. You are a thoughtful UX designer with strong opinions on usability, consistency,
and visual polish.

**Input**: $ARGUMENTS — route path or feature area (e.g. `/actions`, `coaching session page`),
optional focus concerns

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

### 1. Read the source code
- Find the page/component source for the target area (trace from `src/app/` → page.tsx → component tree)
- Use Serena's `get_symbols_overview` and `find_symbol` to map the component hierarchy
- Note layout patterns, component usage, and data shapes

### 2. Capture the current state
- Navigate to the target route with Playwright MCP
- Take a full-page screenshot at desktop width (1280px)

### 3. Systematically explore the UI
Navigate through the page capturing screenshots at each meaningful state:
- **Interactive elements**: Hover over buttons, links, and clickable items — capture hover states
- **Focus states**: Tab through form elements — capture focus rings and outlines
- **Dropdowns/selects**: Open them and screenshot the open state
- **Modals/dialogs**: Trigger them and screenshot
- **Tabs/accordions**: Click through each and screenshot
- **Empty states**: Navigate to views with no data if accessible
- **Loading states**: Note any visible loading indicators (or their absence)
- **Error states**: Note how errors are communicated (if observable)

### 4. Test responsive behavior
Resize the viewport and capture at each breakpoint:
- Desktop: 1280px
- Tablet: 768px
- Mobile: 375px

Note how the layout adapts (or doesn't) at each size.

### 5. Evaluate against UX best practices
Assess each of the following areas. Be specific — reference actual elements from your screenshots:

- **Visual hierarchy**: Is the most important content visually prominent? Are headings,
  spacing, and sizing creating clear information hierarchy?
- **Consistency**: Do similar elements look and behave the same way? Are button styles,
  card layouts, and spacing uniform?
- **Spacing & alignment**: Are elements well-spaced and aligned to an implicit grid?
  Any cramped or overly loose areas?
- **Feedback & affordance**: Do interactive elements clearly communicate they're interactive?
  Are hover/active/disabled states present and distinct?
- **Navigation clarity**: Is it clear where you are and how to get elsewhere?
- **Readability**: Text contrast, font sizes, line lengths
- **Accessibility indicators**: Visible focus states, sufficient contrast, semantic element usage

### 6. Produce the improvement report
Prioritize your findings:

**Critical** — Usability blockers or confusing interactions that could frustrate users

**Important** — Visual inconsistencies, missing feedback states, or layout issues

**Nice-to-have** — Polish opportunities, micro-interactions, visual refinements

For each finding, include:
- What's observed (with screenshot reference)
- Why it matters for UX
- Specific recommendation

### 7. Generate visual prototypes for significant suggestions
For each Critical or Important suggestion:
1. Read the existing component source code
2. Create a faithful reproduction at `src/app/prototype/[name]/page.tsx` that copies the
   exact current layout, Tailwind classes, and component hierarchy — using realistic mock
   data matching types from `src/types/`
3. Apply the proposed improvement
4. Navigate to `http://localhost:3000/prototype/[name]` with Playwright and screenshot it
5. Present current (live app) vs proposed (prototype) screenshots

Include surrounding UI context (sidebar, nav) in the prototype when the improvement needs
to be evaluated in situ.

For substantial changes, generate both a "current" prototype (faithful reproduction) and
a "proposed" prototype so the comparison is exact.

### 8. Generate flow diagrams for navigation improvements
If suggesting changes to user flows, navigation, or multi-step interactions, use Figma MCP's
`generate_diagram` to create a FigJam diagram using Mermaid.js syntax showing:
- Current flow (if problematic)
- Proposed flow (with improvements)

## Important notes
- Always read source code before generating prototypes — never guess at the layout
- Use the project's actual shadcn (`@/components/ui/`) and Kibo UI (`@/components/kibo/ui/`) components
- Import `cn` from `@/components/lib/utils`
- Prototypes should be visually indistinguishable from the real page except for the proposed change
- Be opinionated but practical — focus on changes that meaningfully improve the user experience
- Clean up prototype files after the user has reviewed them (or note they should be cleaned up)
