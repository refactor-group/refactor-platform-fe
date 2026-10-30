# Frontend Visual Style Guide

The project's visual language for building UI. It follows the **Refactor design system**
(the Phase 1 design handoff: indigo accent, pill controls, soft card shadows, Inter at regular
heading weight). Tokens live in `src/styles/globals.css` + `tailwind.config.ts`; this doc says
which token to reach for and why.

> This is a **living document**: keep it accurate and grow it as the UI grows. When you add a
> durable pattern, cite the file it lives in so it stays verifiable.

> **Migration in progress.** The tokens below are live in both themes. Primitives (`Button`,
> `Card`, `Avatar`, toasts) and the header are being rebuilt to the new shapes during Phase 1.
> Sections marked **Target** describe the shape those primitives are moving to; don't hand-patch
> individual screens toward it, the primitive change does that.

**Hard rules (the short version):**
- Style with **semantic tokens** (`bg-fill`, `text-ink-2`, `border-brand-border`), never raw
  hex. Every token has a light and a dark value; components never write `dark:` colors.
- **Accent is scarce.** Only for the primary action (one per view), the live dot, today, and
  selected state.
- **Quiet by default.** Secondary text is `muted-foreground`; row actions stay hidden until
  hover; affordances rest at reduced opacity.
- **`tabular-nums` on every number, date, time, and count.**
- **Never encode meaning in hue alone.** Pair color with an icon, text, or position.
- **No strikethrough anywhere.** Done and closed items go muted instead.
- **Labels are sentence case**, never tracked uppercase. Say "session", never "call".

---

## 1. Foundations

### Color tokens

HSL triplets in `globals.css` (`:root` light, `.dark` dark; next-themes sets the class, and
Auto follows the OS). Tailwind exposes each as a color.

**Neutrals**

| Class | Light | Dark | Use |
|---|---|---|---|
| `background` | `#fff` | `#121214` | Page |
| `card` / `popover` | `#fff` | `#1b1b1f` | Cards, menus, popovers |
| `foreground` | `#0a0a0a` | `#f4f4f5` | Ink: primary text |
| `ink-2` | `#525252` | `#c4c4cb` | Secondary ink: tertiary buttons, body in rows |
| `muted-foreground` | `#737373` | `#8e8e98` | Labels, meta, done-item titles |
| `faint` | `#a3a3a3` | `#5f5f69` | Glyphs, chevrons, hairline-level text only (fails body contrast) |
| `disabled-icon` | `#d4d4d8` | `#3f3f46` | Disabled icon buttons |
| `fill` / `fill-hover` | `#f2f3f5` / `#e4e6ee` | `#26262c` / `#303037` | Secondary buttons, chips, icon buttons |
| `well` | `#f7f7f8` | `#19191c` | Row hover inside menus, modal right pane |
| `border` / `input` | `#e5e7eb` | `#2c2c33` | Borders |
| `hairline` | `#f0f0f0` | `#232328` | Row separators inside a card |

`secondary`, `muted` and shadcn's `accent` all alias `fill`. Note shadcn's `accent` is the
**neutral hover fill**, not the brand accent.

**Brand accent**

| Class | Light | Dark | Use |
|---|---|---|---|
| `primary` / `primary-foreground` | `#5b5fe8` / `#fff` | same | Primary pill fill + its text |
| `primary-disabled` | `#c7cbf3` | `#3a3c6b` | Disabled primary pill |
| `brand` | `#5b5fe8` | `#7b7ff0` | Accent **text**, dots, rings, checks. Use this, not `text-primary` |
| `brand-strong` | `#4b4fd0` | `#7b7ff0` | Text on `brand-tint` (In progress pill) |
| `brand-tint` / `brand-tint-2` | `#eef0fc` / `#eceefc` | `#22233a` / `#262747` | Selected rows, open trigger, today halo |
| `brand-border` | `#dcdff6` | `#34366a` | Hero card and "Current" chip border |
| `brand-dot` / `brand-month` | `#c7c9f5` / `#8f92ee` | `#3d3f7a` / `#6a6ee6` | Past session dots / selected-month dots |
| `bg-hero-wash` | radial accent wash | dark wash | The one hero card per screen |

**Status**

| Class | Light | Dark | Use |
|---|---|---|---|
| `positive` | `#2f6b45` | `#7fc79a` | Ready / done text |
| `positive-solid` | `#2f6b45` | `#2f6b45` | Completed glyph fill (white check) |
| `positive-tint` / `positive-wash` | `#e5f0e8` / `#eef6f0` | `#16281d` / `#142218` | Completed pill / row settling after completion |
| `warning` / `warning-text` | `#b45309` / `#92400e` | `#f2b25a` | Overdue meta (a date condition, not a status) |
| `on-hold-ring` / `-fill` / `-text` | `#d9a860` / `#fbf3e4` / `#8a5a12` | `#b98a3f` / `#2d2112` / `#f2b25a` | On hold glyph + pill |
| `status-idle` | `#c4c4c4` | `#4a4a52` | Not started circle |
| `destructive` | unchanged | unchanged | Delete / danger |

**Inverse and avatars**

| Class | Light | Dark | Use |
|---|---|---|---|
| `inverse` / `inverse-foreground` | `#171717` / `#fafafa` | `#f4f4f5` / `#121214` | Toast and dot tooltip: the only surface that flips |
| `toast-check` | `#86efac` | same | Leading check on confirmation toasts |
| `avatar` / `avatar-foreground` | `fill` / `#3f3f46` | `#26262c` / `#e4e4e7` | Org tile; all avatars in dark mode |

### Typography

Inter. Headings are **regular weight** with `-0.01em` tracking (baked into the size tokens).

| Role | Classes |
|---|---|
| Page title | `text-page-title` (32/400) |
| Card headline | `text-headline` (28/400) |
| Section | `text-section` (26/400) |
| Card title | `text-card-title font-medium` (17/500); modal title adds `font-semibold` |
| Body | `text-sm` (14) |
| List item | `text-item font-medium` (13.5/500) |
| Label | `text-label font-medium text-muted-foreground` (12.5/500) |
| Meta | `text-xs text-muted-foreground` (12) |
| Pill text | `text-pill font-medium` (11.5/500) |
| Tiny | `text-tiny font-medium` (11/500) |

### Spacing, radius, shadow

- 8px grid. Card padding 22–28, grid gap `gap-4`, page padding 40.
- Radii: `rounded-full` pills, chips, avatars, icon buttons · `rounded-card` 16 cards and
  modals · `rounded-popover` 14 menus and popovers · `rounded-xl` 12 small cards · `rounded-input`
  10 inputs and menu rows · `rounded-lg` 8 list rows and the org tile.
- Shadows: `shadow-card` on cards, `shadow-popover` on menus, `shadow-toast` on toasts. Outer
  panels and session cards stay flat. Dark menus also carry a 1px `border`.

---

## 2. Surfaces & layout

- **Card:** `bg-card border rounded-card shadow-card`, padding 22–28. Rows inside separate with
  `border-hairline`; no boxes nested in boxes.
- **Hero card** (one per screen, e.g. next session): `bg-hero-wash border-brand-border`.
- **Toast:** `bg-inverse text-inverse-foreground rounded-full shadow-toast`, bottom center.
  The only dark surface in light mode (and the only light one in dark mode).
- Page width comes from `PageContainer` (`max-w-screen-2xl`); don't set your own max width.
- Loading, empty and error states render inside the **same** card chrome so the grid never
  jumps (`GoalsOverviewCardSkeleton`, `GoalsOverviewCardError`).

---

## 3. Controls & idioms

### Buttons (Target)

Pills, `text-item font-medium`, no border, icon + label `gap-2`, 16px lucide icons.

- **Primary:** `bg-primary text-primary-foreground`, disabled `bg-primary-disabled`. One per view.
- **Secondary:** `bg-fill hover:bg-fill-hover text-foreground`.
- **Tertiary:** bare text + icon, `text-ink-2`.
- Heights: 40 default · 36 dense (header) · 44 modal confirm · 48 mobile footer.
- **Icon-sizing gotcha:** `buttonVariants` forces `[&_svg]:size-4`; override with the important
  prefix (e.g. `!h-6 !w-6`).

### Icon buttons (Target)

Circles, 36–40px, `bg-fill hover:bg-fill-hover text-ink-2`. Inside menus: 28px, transparent,
hover `bg-fill`, disabled `text-disabled-icon`. Always set `aria-label`.

### Chips (Target)

`rounded-full text-xs font-medium`, height 22–26. Selected `bg-primary text-primary-foreground`;
unselected `bg-fill`. Filter chip: `bg-card border` with a trailing `text-faint` × that clears it.

### Rows & quiet affordances

Rows rest quiet and reveal actions on hover, gated on hover **capability**, not viewport width,
so touch devices keep actions visible (`coaching-sessions-row.tsx`):

```tsx
className={cn(
  "flex gap-1.5 shrink-0 items-center",
  "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:transition-opacity",
  "[&:has([data-state=open])]:opacity-100",
)}
```

- Row hover in menus `bg-well`; keyboard focus `bg-fill`; selected/current `bg-brand-tint`.
- Trailing chevrons are `text-faint`.

### Status (`ItemStatus`)

20px glyph left of the row, 24px pill right; both open the 180px status menu (check on current).

| Status | Glyph | Pill |
|---|---|---|
| Not started | hollow `status-idle` circle | `bg-fill text-ink-2` |
| In progress | `brand` ring, half-filled disc | `bg-brand-tint text-brand-strong` |
| On hold | `on-hold-ring` ring, `on-hold-fill`, pause | `bg-on-hold-fill text-on-hold-text` |
| Completed | solid `positive-solid`, white check; title muted | `bg-positive-tint text-positive` |
| Won't do | solid `faint`, white ×; title muted | — |

### Menus

`rounded-popover shadow-popover border`. Destructive items:
`text-destructive focus:text-destructive focus:bg-destructive/10`.

### Collapsible cards

Full-width header button; chevron `transition-transform duration-200`, `rotate-180` when open
(`goals-overview-card.tsx`).

---

## 4. Motion

- Hover and background changes: `transition-colors duration-150`.
- Expanders: `transition-transform duration-200`. Carousel slide: `duration-[250ms] ease-out`.
- Single-dot grow: `transition-transform duration-[180ms] ease-spring`.
- Live dot: `animate-live-pulse` (opacity 1 → .35 → 1, 2s).
- Existing named keyframes (`accordion-*`, `kanban-card-*`, `highlight-*`) stay for their uses.

---

## 5. Accessibility

- **Hue is never the only signal.** Pair color with icon + text + position.
- Body text holds 4.5:1 in both themes; `faint` is for glyphs only.
- `aria-pressed` on toggles, `aria-label` on icon-only buttons, `sr-only` text for icon-only
  meaning.
- Keep the base focus ring from `buttonVariants`; don't strip it.
- Radix Tooltip content is **not** in the DOM until hover; don't assert it before interaction.

---

## 6. Decisions log

| Idiom | Status |
|---|---|
| Indigo brand accent (`primary` + `brand-*`) | **Adopted** globally (Phase 1 handoff). Replaces the neutral near-black primary. |
| Pill buttons, circular icon buttons | **Adopted** (Target; migrating in Phase 1). Supersedes `rounded-md` buttons. |
| Card shadow (`shadow-card`) | **Adopted** for cards. Outer panels and session cards stay flat. |
| Positive / warning / on-hold tokens | **Adopted** (§1 Status). |
| Cool-grey (zinc) dark scale | **Adopted**; never pure black. |
| Gradients | Only `bg-hero-wash`, once per screen. No decorative shapes, tinted wells or dark cards. |

---

## 7. To capture later (open)

- Per-person pastel avatar palette (light mode only; dark avatars are neutral).
- Form field density and validation styling.
- Mobile bottom sheet and full-screen step view.
- Data-viz guidance on `chart-1…5`.
