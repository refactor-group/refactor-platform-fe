# Frontend Visual Style Guide

The project's visual language for building UI. Two inputs feed this doc:

1. **The implemented system** — the shadcn/Tailwind tokens in `src/styles/globals.css` +
   `tailwind.config.ts`, and the patterns already shipped on the **dashboard**
   (`src/components/ui/dashboard/**`). This is the source of truth; everything here is
   grounded in real files you can open.
2. **A north-star reference dashboard** (a polished fintech dashboard) that the current
   dashboard was visually modeled on. We borrowed its *structural* idioms — flat cards,
   hairline borders, generous whitespace, quiet hover-revealed affordances. We did **not**
   adopt its color story wholesale. Observed-but-not-adopted idioms are listed at the end so
   the distinction stays explicit.

> This is a **living document** — start here, keep it accurate, grow it as the UI grows.
> When you add a durable pattern, cite the file it lives in so it stays verifiable.

**Hard rules (the short version):**
- Style with **semantic tokens** (`bg-card`, `text-muted-foreground`, `border-border`), never
  raw hex. Both light and dark themes come for free that way.
- **Flat surfaces, hairline borders** — dashboard cards are `border shadow-none`, not drop
  shadows.
- **Quiet by default** — secondary text is `muted-foreground`; row actions stay hidden until
  hover; affordances rest at reduced opacity.
- **`tabular-nums` on every number, date, time, and count.**
- **Never encode meaning in hue alone** — pair color with an icon, text, or position.

---

## 1. Foundations

### Color tokens

Defined as HSL CSS variables in `src/styles/globals.css` (`:root` = light, `.dark` = dark) and
exposed as Tailwind colors in `tailwind.config.ts`. **Use the semantic Tailwind class, not the
raw value.** The palette is intentionally **neutral** (grayscale) — there is no global brand
accent hue.

| Token / class | Light HSL | Meaning / use |
|---|---|---|
| `background` | `0 0% 100%` | Page background (white) |
| `foreground` | `0 0% 3.9%` | Primary text (near-black) |
| `card` / `card-foreground` | `0 0% 100%` / `0 0% 3.9%` | Card surface + its text |
| `primary` / `primary-foreground` | `0 0% 9%` / `0 0% 98%` | Primary buttons, strong emphasis (near-black, **not** a color) |
| `secondary` | `0 0% 96.1%` | Secondary button fill |
| `muted` / `muted-foreground` | `0 0% 96.1%` / `0 0% 45.1%` | Muted surfaces, skeletons, hover tints / **secondary & meta text** |
| `accent` | `0 0% 96.1%` | Hover background for `ghost`/`outline` controls |
| `destructive` / `destructive-foreground` | `0 84.2% 60.2%` / `0 0% 98%` | Delete / danger (the only saturated semantic color) |
| `border` / `input` | `0 0% 89.8%` | Hairline borders + input borders |
| `ring` | `0 0% 3.9%` | Focus ring |
| `chart-1…5` | various | Chart series (themeable; light + dark variants exist) |

Dark mode mirrors these (near-black surfaces, near-white text); because everything keys off the
tokens, you rarely write `dark:` overrides — only to *bump intensity* where a `/20` tint
disappears over a near-black surface (see hover tints below).

### Typography

Font is **Inter** (`--font-sans`, set on `body` in `globals.css`; `fontFamily.sans` in the
Tailwind theme). Roles below are taken from real dashboard components — prefer them over ad-hoc
sizes.

| Role | Classes | Seen in |
|---|---|---|
| Page heading | `text-xl sm:text-2xl font-semibold tracking-tight` | `welcome-header.tsx` |
| Page subtitle | `text-sm text-muted-foreground mt-1` | `welcome-header.tsx` |
| Card title | `text-base font-semibold` | `coaching-sessions-card-header.tsx` |
| Primary value / count | `text-lg font-semibold tabular-nums` | `goals-overview-card.tsx` |
| Row primary text | `text-[13px] font-medium text-foreground truncate` | `coaching-sessions-row.tsx` |
| Row secondary / meta | `text-xs text-muted-foreground tabular-nums truncate` | `coaching-sessions-row.tsx` |
| Small label | `text-xs text-muted-foreground` | throughout |
| Body | `text-sm` | throughout |

> The base `CardTitle` primitive (`src/components/ui/card.tsx`) defaults to `text-2xl`; dashboard
> cards deliberately override to `text-base font-semibold`. Match the dashboard, not the default.

**Numerals:** add `tabular-nums` to anything numeric (values, dates, times, counts, durations) so
columns and changing values don't jitter.

### Spacing & radius

- `--radius: 0.5rem` (8px). `rounded-lg` = 8px (**cards**), `rounded-md` = 6px (**buttons /
  default control**), `rounded-sm` = 4px (inner toggle items), `rounded-full` (circular icon
  buttons, avatars, dots).
- Card padding: **`p-6`** (24px). Card header: `px-6 pt-6 pb-4`. Compact rows: `py-4`.
- Inter-element gaps: `gap-1.5`/`gap-2` (tight control clusters), `gap-3`/`gap-4` (content).
- Vertical rhythm between major sections: `mt-8` / `mb-8`.

---

## 2. Surfaces & layout

### Cards (the core surface)

Primitive: `src/components/ui/card.tsx` → `rounded-lg border bg-card text-card-foreground
shadow-sm`.

**Dashboard convention — go flat:** override to `border shadow-none` (add `h-full` for grid
cells). Flat surfaces separated by **hairline borders**, not drop shadows, is the signature look.

```tsx
<Card className="border shadow-none h-full">
  <CardContent className="p-6"> … </CardContent>
</Card>
```

- **Internal dividers** are hairlines: `border-t` (optionally inset with `mx-6`) between a card's
  header and body; row lists use `divide-y divide-border/50`.
- **Section header inside a card:** `px-6 pt-6 pb-4 flex flex-wrap items-center justify-between
  gap-3` with a `text-base font-semibold` title on the left and controls on the right
  (`coaching-sessions-card-header.tsx`).

### Page layout

- Page width comes from `PageContainer` (`max-w-screen-2xl`); don't set your own max width.
- Card grids are mobile-first single column, two columns at `md`:
  `grid grid-cols-1 md:grid-cols-2 gap-4` (`dashboard-container.tsx`). Full-width sections sit in
  their own `w-full` block below.

---

## 3. Controls & idioms

### Buttons

Primitive: `src/components/ui/button.tsx`.

- **Variants:** `default` (`bg-primary`, near-black), `outline`, `secondary`, `ghost`, `link`,
  `destructive`.
- **Sizes:** `default` h-10 · `sm` h-9 · `lg` h-11 · `icon` h-10 w-10.
- **Dashboard compact sizing:** `size="sm"` plus `className="text-xs h-8"` for the tighter
  dashboard density.
- **Circular icon button** (the borrowed hover-affordance idiom): `variant="ghost" size="icon"`
  + `rounded-full h-8 w-8 text-muted-foreground/60 hover:text-foreground`. The `rounded-full` is
  what makes the hover background a circle instead of a rounded square.
- **Icon-sizing gotcha:** `buttonVariants` forces `[&_svg]:size-4` (16px) on all child SVGs. To
  use another size, override with the important prefix (e.g. `!h-6 !w-6`). In compact controls,
  icons are usually `h-4 w-4` or `h-3.5 w-3.5`.

### Segmented toggle

`flex items-center rounded-md border p-0.5`; active item `rounded-sm bg-muted text-foreground`;
inactive `text-muted-foreground/50 hover:text-muted-foreground` (`ViewToggle` in
`coaching-sessions-card-header.tsx`). Set `aria-pressed` on each item.

### Rows & quiet affordances

Rows rest quiet and reveal actions on hover — gated on hover **capability**, not viewport width,
so touch devices (no hover) keep actions visible (`coaching-sessions-row.tsx`):

```tsx
// action cluster
className={cn(
  "flex gap-1.5 shrink-0 items-center",
  "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:transition-opacity",
  "[&:has([data-state=open])]:opacity-100", // stay visible while a menu/popover is open
)}
```

- **Row hover/selection tint:** `hover:bg-muted/20` (bump `dark:hover:bg-muted/50`), selected
  `bg-muted/40 dark:bg-muted/70`. Muted tints over a near-black dark surface need the bump to read.
- **Resting affordance opacity:** icons rest at `/40`–`/60` of `muted-foreground` and go to
  `foreground` on hover.

### Menus

Destructive menu items: `text-destructive focus:text-destructive focus:bg-destructive/10`
(`coaching-sessions-row.tsx`).

### Collapsible cards

Toggle via a full-width header button; rotate the chevron with state:
`<ChevronDown className="h-4 w-4 text-muted-foreground/40 transition-transform duration-200" />`
plus `expanded && "rotate-180"` (`goals-overview-card.tsx`).

---

## 4. States

- **Loading:** skeleton inside the *same* card chrome (`border shadow-none`) — `animate-pulse`
  blocks (`bg-muted rounded`) sized to the real content, so layout doesn't jump
  (`GoalsOverviewCardSkeleton`).
- **Empty:** centered muted text, `text-sm text-muted-foreground` (e.g. "No active goals").
- **Error:** inline `text-sm text-destructive` within the same card chrome — never collapse the
  card or shift the surrounding grid (`GoalsOverviewCardError`).

---

## 5. Motion

- Default `transition-colors` on interactive surfaces; chevrons/expanders use
  `transition-transform duration-200`.
- Named keyframes available in `tailwind.config.ts`: `accordion-down`/`up`,
  `slide-in-from-left`, `kanban-card-enter`/`exit` (~200–400ms, ease-out). Reuse these rather
  than inventing new durations.

---

## 6. Accessibility

- **Hue is never the only signal.** Pair color with icon + text + position (the dashboard health
  signals are icon+label; the Topics "new" dot pairs with `sr-only` text and avatar position).
  This also means a color can be swapped later without breaking meaning.
- `aria-pressed` on toggles, `aria-label` on icon-only buttons, `sr-only` text for any icon-only
  meaning.
- Keep the base focus ring (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
  from `buttonVariants`) — don't strip it.
- Radix Tooltip content is **not** in the DOM until hover; don't assert/expect it before
  interaction.

---

## 7. Reference idioms — observed vs. adopted

From the north-star dashboard, kept explicit so we don't drift into copying things we never
decided to adopt.

| Idiom | Status |
|---|---|
| Flat cards, hairline borders, airy whitespace | **Adopted** |
| Circular icon-button hover affordance | **Adopted** |
| Muted secondary text, quiet rest state | **Adopted** |
| Hairline internal dividers + section headers | **Adopted** |
| Large value with smaller raised cents (`$200` + `.00`) | **Observed, not used** — no monetary display in-app yet. If we ever render large numeric values, this is the idiom to reach for. |
| Pill-shaped action toolbar (filled accent + light-gray pills) | **Observed, not adopted** — our buttons are `rounded-md`. Adopting pills would be a deliberate divergence to decide, not a default. |
| Indigo/violet brand accent | **Not adopted globally** — implemented palette is neutral near-black `primary`. Don't repaint global `--primary` to a color without a design decision. *Feature-scoped* accent hues (e.g. relevance = indigo, immediacy = amber, "new" = violet in the Title+Topics work) live inside that feature, not the global token set. |
| Positive/success green for money-in | **Gap** — there is no global success token (only `destructive`). Define one deliberately if/when a success color is actually needed. |
| Thin rounded utilization bar + legend dots; section header with `‹ month ›` pager | **Observed** — reusable patterns if a future surface needs them. |

---

## 8. To capture later (open)

- Form field / input density and validation styling (beyond the base `input` token).
- Toast / notification conventions.
- A defined success/positive color token, if adopted.
- Data-viz (chart) usage guidance built on the `chart-1…5` tokens.
- Mobile `Sheet` patterns (the Title+Topics work introduces bottom-sheet editing on mobile).
