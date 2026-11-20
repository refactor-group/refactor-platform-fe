# File organization

Where new code goes. Follow the newest neighbours; when unsure, count what the tree does before deciding.

## Components (`src/components/ui/`)
- Each app area is a folder: `dashboard/`, `coaching-sessions/`, `members/`, `new-session/`.
- Areas stay flat. Prefix a feature's files so they sort together (`next-session-card.tsx`, `next-session-card-empty.tsx`, `next-session-glance.tsx`). Give a feature its own subfolder only once it is large: `dashboard/week-grid/` is about a dozen files.
- One component per file: kebab-case file, PascalCase export.
- A card's loading and error states are small functions in the card's own file (`GoalsOverviewCardSkeleton`). A larger empty state is a sibling, `<card>-empty.tsx`.
- UI shared across areas goes in a folder named for its kind: `errors/` (`CardError`, `ErrorPage`), `status/`.
- A hook or message builder used by only one area may sit beside its components (`dashboard/use-session-actions.ts`). Anything else that is pure logic goes in `src/lib/`.
- shadcn primitives stay flat in `ui/`. Kibo lives in `components/kibo/ui/`.

## Logic (`src/lib/`)
- Pure logic is a root module named for what it holds: `scheduling-copy.ts`, `new-session-dialog-model.ts`, `session-actions.ts`, `next-session-copy.ts`.
- One concept, one module. Don't re-derive it in a component or hook. `actions-due.ts` owns which actions are due at a session, the previous session, and the overdue rule.
- `lib/utils/` is legacy. Don't add to it. Move a file out when you change it substantially.
- Hooks: `lib/hooks/use-*.ts`. API objects and their SWR hooks: `lib/api/`.

## Tests (`__tests__/`)
- Mirror the source path: `__tests__/components/ui/dashboard/`, `__tests__/lib/`, `__tests__/lib/hooks/`.
- The root `__tests__/hooks/` is legacy. New hook tests go in `__tests__/lib/hooks/`.
- Cross-hook checks that use real hooks together go in `__tests__/integration/`.
- Mocked Playwright specs go in `__tests__/e2e/*.spec.ts`. `*-live.spec.ts` needs a running backend and runs only with `LIVE_E2E`.
