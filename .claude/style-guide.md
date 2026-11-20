# Frontend Visual Style Guide

The project's visual language for building UI. It follows the **Refactor design system**
(the Phase 1 design handoff: indigo accent, pill controls, soft card shadows, Inter at regular
heading weight). Tokens live in `src/styles/globals.css` + `tailwind.config.ts`, and their
values are documented in `docs/design-system.md`; this doc says which token to reach for and why.

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

Values: see `docs/design-system.md` › [Color](../docs/design-system.md#color) /
[Typography](../docs/design-system.md#typography) /
[Spacing, radius and elevation](../docs/design-system.md#spacing-radius-and-elevation).
This section says which token to reach for.

### Color tokens

Every token has a light (`:root`) and a dark (`.dark`) value; next-themes sets the class,
and Auto follows the OS. Tailwind exposes each as a color.

**Neutrals**
- `background`: the page. `card` / `popover`: cards, menus, popovers.
- Ink, strongest first: `foreground` (primary text), `ink-2` (tertiary buttons, body in
  rows), `muted-foreground` (labels, meta, done-item titles), `faint` (glyphs, chevrons,
  hairline-level text only; it fails body contrast).
- `fill` / `fill-hover`: secondary buttons, chips, icon buttons. `well`: row hover inside
  menus, the modal's right pane. `disabled-icon`: disabled icon buttons.
- `border` / `input`: borders. `border-hover`: card border on hover. `hairline`: row
  separators inside a card.
- `secondary`, `muted` and shadcn's `accent` all alias `fill`. shadcn's `accent` is the
  **neutral hover fill**, not the brand accent.

**Brand accent** (scarce, see the hard rules)
- `primary` / `primary-foreground`: the primary pill's fill and text. `primary-disabled`:
  the disabled primary pill.
- `brand`: accent **text**, dots, rings, checks. Use it, not `text-primary`; only `brand`
  lightens in dark mode.
- `brand-strong`: text on `brand-tint`. `brand-tint` / `brand-tint-2`: selected rows, open
  trigger, today. `brand-border`: hero card and "Current" chip border.
- `brand-elapsed`: elapsed fill on a session card under way. `brand-dot` / `brand-month`:
  past session dots / selected-month dots.
- `bg-hero-wash`: the one hero card per screen.

**Status**
- `positive`: Ready and done text. `positive-solid`: completed glyph fill (white check).
  `positive-tint` / `positive-wash`: Ready and Completed pill, and its hover.
- `warning` / `warning-text`: overdue meta (a date condition, not a status).
- `error` / `error-tint` / `error-border`: error states (`CardError`). Not for delete or
  danger; that stays `destructive`.
- `on-hold-ring` / `-fill` / `-text`: On hold glyph and pill. `status-idle`: Not started.
- `destructive`: delete and danger.

**Inverse and avatars**
- `inverse` / `inverse-foreground`: toast and dot tooltip, the only surface that flips.
- `toast-check` / `toast-warning`: leading icons on confirmation and warning toasts.
- `avatar` / `avatar-foreground`: the org tile, and every avatar in dark mode.
  `avatar-1` to `avatar-8`: per-person pastels in light mode, picked by `avatarToneFor`.

### Typography

Inter. Headings are **regular weight**; tracking is baked into the size tokens.

| Role | Classes |
|---|---|
| Page title | `text-page-title` |
| Dialog headline | `text-headline` |
| Section | `text-section` |
| Subhead | `text-subhead`, e.g. the Next session card title |
| Card title | `text-card-title font-medium`; modal title adds `font-semibold` |
| Body | `text-sm` |
| List item | `text-item font-medium` |
| Label | `text-label font-medium text-muted-foreground` |
| Meta | `text-xs text-muted-foreground` |
| Pill text | `text-pill font-medium` |
| Tiny | `text-tiny font-medium` |

### Spacing, radius, shadow

- 8px grid; grid gap `gap-4`.
- Radius by shape: `rounded-full` pills, chips, avatars, icon buttons · `rounded-card` cards
  and modals · `rounded-popover` menus and popovers · `rounded-xl` small cards ·
  `rounded-input` inputs and menu rows · `rounded-lg` list rows and the org tile.
- Shadows: `shadow-card` on cards, `shadow-popover` on menus, `shadow-toast` on toasts,
  `shadow-modal` on the stepped modal. Outer panels stay flat. Menus also carry a 1px
  `border`.

---

## 2. Surfaces & layout

Looks and values: `docs/design-system.md` › [Surfaces](../docs/design-system.md#surfaces).

- **Card:** `bg-card border rounded-card shadow-card`. Rows inside separate with
  `border-hairline`; no boxes nested in boxes.
- **Hero card** (one per screen, e.g. next session): `bg-hero-wash border-brand-border`.
- **Toast:** bottom center. The only dark surface in light mode (and the only light one in
  dark mode). Look: [Toasts](../docs/design-system.md#toasts).
- **Stepped modal (`StepDialog`, `ui/step-dialog.tsx`):** use it for every stepped or
  sectioned modal. Height stays fixed across steps. Step arrows always show, disabled at the
  ends, except `StepDialogVariant.Single` (a read-only view) shows no position, arrows,
  footer or step list (`series-detail-dialog.tsx`). While an on-screen keyboard is up, the
  phone view shrinks to the visible area and scrolls the focused field into it
  (`useVisibleViewport`). Layout and sizes:
  [Stepped modal](../docs/design-system.md#stepped-modal) and
  [Full-screen step view](../docs/design-system.md#full-screen-step-view).
- Page width comes from `PageContainer` (`max-w-screen-2xl`); don't set your own max width.
- Loading, empty and error states render inside the **same** card chrome so the grid never
  jumps (`GoalsOverviewCardSkeleton`, `GoalsOverviewCardError`).
- `CardError` (`components/ui/errors/card-error.tsx`) is the error body for cards.

---

## 3. Controls & idioms

### Buttons (Target)

Pills with lucide icons, no border. Variants, sizes and classes:
[Buttons](../docs/design-system.md#buttons).

- **Primary:** `bg-primary text-primary-foreground`, disabled `bg-primary-disabled`. One per view.
- **Secondary:** `bg-fill hover:bg-fill-hover text-foreground`.
- **Tertiary:** `variant="tertiary"`, bare text + icon, `text-ink-2 hover:text-foreground`, no
  background. Not `ghost`: ghost hover-fills and is for icon buttons in menus.
- Sizes by place: `default` in content, `sm` dense (header), `lg` modal confirm, `xl` mobile
  footer.
- **Icon-sizing gotcha:** `buttonVariants` forces `[&_svg]:size-4`; override with the important
  prefix (e.g. `!h-6 !w-6`).

### Icon buttons (Target)

Circles, `bg-fill hover:bg-fill-hover text-ink-2` (`secondary` with an `icon` size). Inside
menus: `ghost` + `icon-menu`, transparent, hover `bg-fill`, disabled `text-disabled-icon`.
Always set `aria-label`. Sizes: [Buttons](../docs/design-system.md#buttons).

### Info buttons (i)

An (i) explains what a choice or field *means*, for people who need it, without adding prose
for everyone else. It sits beside a field label, or at the right edge of a choice card, and
nowhere else.

- **What goes in it:** meaning and consequences ("what a Colleague can do", "whose time zone this
  is"). Never instructions needed to finish the step; those go in the label or the footer hint.
  Never errors.
- **Trigger:** lucide `Info` at 16px, round, `text-ink-2 hover:bg-fill hover:text-foreground`.
  32px beside a label (`-my-2` keeps the row height), 40px on a card. `aria-label="About {title}"`.
  A sibling of the control it explains, never inside it (a button can't sit inside another button).
- **Opens on click or tap** (a Popover, not a Tooltip), so it works on touch. Escape or an outside
  click closes it.
- **Content:** `w-64 p-3 text-sm`. The title in `font-medium text-foreground`, then one or two
  short sentences in `text-muted-foreground`. No links, no actions.
- **One component:** `InfoButton` in `components/ui/info-button.tsx`, used by `RadioCardItem` and
  by field labels.

Examples: the role cards in Pair with…, Add member and Change relationship…; Time zone in Add member.

### Chips (Target)

Use `Chip`: selected `bg-primary text-primary-foreground`, unselected `bg-fill`. Filter chip
(`FilterChip`): `bg-card border` with a trailing `text-faint` × that clears it. Dialogs use
`Chip size="md"`. Sizes: [Chips and pills](../docs/design-system.md#chips-and-pills).

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

`StatusGlyph` left of the row, `StatusPill` right; both open `StatusMenu` (check on the
current status). Completed and Won't do titles go muted. Glyph, pill and menu per status:
[Status chips](../docs/design-system.md#status-chips).

### Menus

Shape: [Popovers, menus and tooltips](../docs/design-system.md#popovers-menus-and-tooltips).
Destructive items:
`text-destructive focus:text-destructive focus:bg-destructive/10`.

### Collapsible cards

Full-width header button; chevron `transition-transform duration-200`, `rotate-180` when open
(`goals-overview-card.tsx`).

### Phones (below 900px or `lg`)

Calm and steady:

- **One way to do a thing.** Drop a per-item action when a header button or the card already
  does it. Example: Move lives on the agenda card, not also in its menu.
- **A few good choices plus an exact input**, not every option (Move sheet: ≤5 suggested times
  and a time field).
- **Controls tapped repeatedly hold still.** Week arrows keep their position across loading and
  range changes. Reserve a line's height rather than letting text appear and disappear.
- **No loading flashes.** Prefetch what the next tap needs; when something must load, use a quiet
  placeholder shaped like the result, not a pulsing grey skeleton.
- Tap targets are 44px; no horizontal scroll at 360px.

iOS Safari:

- **Rows grow with their controls.** iOS draws date, time and number inputs taller than their CSS
  height, and labels wrap, so use `min-h-*` on rows, never a fixed `h-*` (`repeat-step.tsx`).
- **Long-press targets** that open a menu set `select-none [-webkit-touch-callout:none]`, so a
  press doesn't also select text or show iOS's Copy/Cut callout (`session-card.tsx`).
- **The tap that closes a menu only closes it.** On touch, its click lands once the menu is gone;
  swallow it while the menu is open (`session-card-menu.tsx`).
- **Full-screen fixed views** follow the visible viewport while the keyboard is up, or fields
  near the bottom can't be scrolled into view (`useVisibleViewport`).

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
- Mobile bottom sheet.
- Data-viz guidance on `chart-1…5`.
