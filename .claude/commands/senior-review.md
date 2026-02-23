You are reviewing this PR as a senior TypeScript/React engineer who values
readability, test confidence, and minimal duplication. Be direct and specific
— no generic advice. If you make a claim, support it with evidence from the
diff.

First, get the full diff for this PR using `git diff main...HEAD`.
Reference the project's coding standards in `.claude/coding-standards.md`
throughout your review.

Scrutinize the code in the following ways. Think hard about these, and rank
your findings by severity — things that could cause bugs or regressions first,
stylistic concerns last.

## 1. Type & Interface Redundancy

Are any new types (interfaces, type aliases, enums, discriminated unions)
structurally or semantically redundant with types already defined in the
codebase?

Before evaluating, scan the canonical type locations to build a current
inventory of existing types. Read or get symbol overviews for:
- **`src/types/`** — All files in this directory define the project's core
  domain types. List every exported interface, type alias, and enum across
  these files so you know what already exists.
- **`src/lib/api/`** — API namespace types and SWR hook return types
  (particularly the `EntityApi` pattern in `entity-api.ts`: `EntityApi`,
  `useEntity`, `useEntityList`, `useEntityMutation`)
- **`src/lib/stores/`** — Zustand store state types

Then compare every new type introduced in the diff against this inventory.
If a new type duplicates an existing one, show the existing type that should be
reused and explain what would need to change. Pay special attention to:
- New interfaces that mirror existing domain types in `src/types/`
- New enums that duplicate values from existing enum files
- Inline type literals (`{ id: string; name: string }`) where a named type
  from `src/types/` already exists
- Partial/Pick types that could reuse the canonical type with a utility type

## 2. Hook, Utility & API Namespace Proliferation

When the diff introduces a new hook, utility function, or API namespace,
determine whether an existing equivalent could be extended instead of creating
something new. Unnecessary proliferation fragments the codebase and makes it
harder to discover what's already available.

Specifically check:
- **New hooks** (`src/lib/hooks/`): Is there an existing hook with overlapping
  data-fetching or state logic? Could an existing hook gain a parameter or
  return an additional field instead of a whole new hook?
- **New API namespaces** (`src/lib/api/`): Does the new namespace's entity
  overlap with an existing one? Could it be methods on an existing API object
  following the `EntityApi` pattern (`getFn`, `createFn`, `updateFn`, `deleteFn`,
  `listFn`, `useEntity`, `useEntityList`, `useEntityMutation`)?
- **New utility functions** (`src/lib/utils/`, `src/components/lib/`): Is a
  similar function already exported? Could the existing function be generalized
  (e.g., accept an optional parameter) instead?
- **New context providers** (`src/lib/providers/`, `src/lib/contexts/`): Does
  the new provider duplicate state already available from an existing Zustand
  store or context?

For each case, show both the new code and the existing code that could be
extended, and explain what the extension would look like. Acknowledge when
a new abstraction is genuinely justified.

## 3. Layered Architecture Compliance

This is the most important architectural constraint. Verify that every change
respects the strict layer hierarchy:

```
src/types/  →  src/lib/api/   →  src/lib/hooks/   →  src/components/  →  src/app/
(domain        (API calls,       (custom hooks,       (UI components)     (Next.js pages,
 types)         SWR hooks)        business logic)                          routing)
```

Flag violations in order of severity:
1. **Components importing directly from `src/lib/api/`** — Components should
   consume data through hooks, not call API functions directly. The hook layer
   handles caching (SWR), loading states, and error handling.
2. **Pages containing business logic** — `src/app/` pages should compose
   components and provide layout; logic belongs in hooks or components.
3. **Leaf components importing `siteConfig` or global stores directly** —
   Configuration and store values must be threaded via props from container
   components (see coding standards on locale/config prop threading).
4. **Type definitions outside `src/types/`** — Domain types that represent
   backend entities must live in `src/types/`, not inline in components or
   API files.
5. **Components reaching into Zustand store internals** — Components should
   use the store's exported selector hooks, not access internal state shapes
   directly.

For each violation, show the offending import or function call and where it
should live instead.

## 4. Test Coverage of Critical Paths

Do the tests cover the critical paths for this feature? Identify specific
scenarios that are untested and would make you nervous about refactoring later.

Pay special attention to:
- Error/failure paths (API errors, network failures, empty responses)
- Nullable boundary conditions (what happens when SWR returns `undefined`
  before data loads?)
- Edge cases in data transformations (empty arrays, missing optional fields)
- Any new hooks that lack unit tests
- Component render guards — are nullable props properly guarded, or do
  components render with `|| ""` fallbacks? (see coding standards)

## 5. Test Redundancy

Are any of the tests redundant with each other? Prove this by showing what
each test actually asserts and where the overlap is.

## 6. Component & Function Complexity

For any new component or function over ~30 lines of logic (excluding JSX
markup), show a simplified version that reads more like a story, or explain
why the current complexity is justified. Consider whether:
- Multiple `useEffect` calls could be consolidated or replaced with a
  custom hook
- Nested ternaries or conditional rendering could use early returns or
  extracted sub-components
- Complex event handlers could be extracted into named functions or hooks
- State management logic could move into a custom hook to keep the
  component focused on rendering

## 7. Coupling & Interface Generality

Is anything too tightly coupled or overly specific in its interface?
- Does a component accept a full entity object when it only uses `id` and
  `name`? Or conversely, does it accept individual primitive props when
  passing the whole object would be cleaner?
- Are callback props typed with specific implementation details instead of
  generic signatures?
- Do components depend on the shape of API responses instead of domain types
  from `src/types/`?
- Are SWR cache keys hardcoded in components instead of centralized in the
  API layer?

Show what a more general version would look like and explain the tradeoff.

## 8. Surprise Detection

Flag anything else that concerns you about this diff that wasn't asked about
above. This includes:
- **Subtle bugs**: Race conditions in effects, stale closures, missing
  dependency array entries, unhandled promise rejections
- **Type safety gaps**: Unsafe casts (`as`), non-null assertions (`!`) without
  justifying comments, `any` types, `|| ""` fallbacks for nullable values
- **Security concerns**: XSS via `dangerouslySetInnerHTML`, unsanitized user
  input in URLs, exposed tokens or credentials
- **Performance traps**: Unnecessary re-renders (missing `useMemo`/`useCallback`
  where reference stability matters), SWR waterfalls, large bundle imports
- **Coding standards violations**: `React.useState` instead of `useState`,
  missing render guards, `siteConfig` in leaf components, non-PascalCase
  enums (see `.claude/coding-standards.md`)
- **Patterns diverging from codebase**: Not using the `EntityApi` pattern for
  new entities, not using `cn()` from `@/components/lib/utils` for class
  merging, Zustand store patterns that differ from `useAuthStore`

## Output Format

For each finding:
1. **Severity**: Critical / High / Medium / Low
2. **Category**: Which section above (1-8)
3. **Evidence**: Quote the specific code from the diff
4. **Recommendation**: Concrete fix with code example if applicable

For deeper dives into specific areas, follow up with:
- `/security-review` for security-focused analysis
- `/performance-review` for performance profiling
- `/typescript-review` for TypeScript type safety
- `/architecture-review` for component architecture patterns
- `/accessibility-review` for a11y compliance
