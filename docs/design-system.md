# Design System

The Refactor design system as it ships in code: every token, the type scale, shapes and
elevation, and the components that use them. Where this doc and the code disagree, the code
wins; fix the doc.

`src/styles/globals.css` cites this file by section (`design-system.md › Color`). Keep the
section names stable.

This doc is the reference: what exists and what it is worth. For which token to reach for,
the hard rules (accent is scarce, `tabular-nums`, no strikethrough, sentence case), row and
phone idioms, motion and accessibility, read [`.claude/style-guide.md`](../.claude/style-guide.md).
Code style lives in [`.claude/coding-standards.md`](../.claude/coding-standards.md).

---

## Where things live

| File | Holds |
|---|---|
| `src/styles/globals.css` | Every token: `:root` (light) and `.dark`, both inside `@layer base`. Also the base layer (`border-border` on `*`, `bg-background text-foreground` and the font on `body`) |
| `tailwind.config.ts` | Exposes each token as a Tailwind color, plus the radius, shadow, font size, easing and animation extensions ([Motion tokens](#motion-tokens)) |
| `src/app/layout.tsx` | Loads Inter with `next/font/google` and mounts the one `<Toaster />` |
| `src/lib/providers/root-layout-providers.tsx` | `next-themes` `ThemeProvider` (class strategy, see [Dark mode](#dark-mode)) |
| `src/components/ui/*` | Primitives (`button`, `card`, `chip`, `pill`, `avatar`, `toast-pill`, `step-dialog`, ...) |
| `src/lib/avatar-palette.ts` | User id to avatar tone hash |
| `src/styles/tiptap-variables.scss`, `simple-editor.scss` | The notes editor's own variables and fonts, outside this system |

### Adding or changing a token

1. Add the value to both `:root` and `.dark` in `globals.css`. Write colors as a bare HSL
   triplet (`238.3 75.4% 63.3%`), not `hsl(...)`, so Tailwind's opacity modifiers work
   (`bg-brand/40`, `hover:bg-primary/90`). A token that is the same in both themes can be
   left out of `.dark` (it inherits); a role that should follow another token uses
   `var(--other)`.
2. Expose it in `tailwind.config.ts` under `theme.extend.colors` as `'hsl(var(--name))'`.
   Non-color tokens (gradients, shadows, the scrim) are passed through as `var(--name)`.
3. Add a row to the matching table below (light, dark, hex, use) and, if it changes which
   token to pick, to the style guide.
4. If the token is one the backend's emails mirror, update them too (see
   [Outside the app](#using-the-system-outside-the-app)).

Classes built at runtime must be full literal strings, or Tailwind drops them
(`AVATAR_TONE_CLASSES` in `src/lib/avatar-palette.ts`).

---

## Color

Hex is computed from the HSL triplet and rounded per channel. "inherits" means `.dark` does
not redefine the token: a literal keeps its light value, and a `var()` alias resolves
against the dark value of its target.

### Neutrals

| Token | Light | Dark | Hex light / dark | Use |
|---|---|---|---|---|
| `background` | `0 0% 100%` | `240 5.3% 7.5%` | `#ffffff` / `#121214` | Page, inputs |
| `foreground` | `0 0% 3.9%` | `240 4.8% 95.9%` | `#0a0a0a` / `#f4f4f5` | Primary ink |
| `ink-2` | `0 0% 32.2%` | `240 6.3% 78.2%` | `#525252` / `#c4c4cb` | Secondary ink: ghost and tertiary buttons, inactive header links |
| `muted-foreground` | `0 0% 45.1%` | `240 4.6% 57.6%` | `#737373` / `#8e8e98` | Labels, meta, done titles |
| `faint` | `0 0% 63.9%` | `240 5% 39.2%` | `#a3a3a3` / `#5f5f69` | Glyphs, chevrons, past card meta. Not body text |
| `disabled-icon` | `240 4.9% 83.9%` | `240 5.3% 26.1%` | `#d4d4d8` / `#3f3f46` | Disabled 28px menu icon buttons |
| `fill` | `220 13% 95.5%` | `240 7.3% 16.1%` | `#f2f3f5` / `#26262c` | Secondary buttons, chips, active header link |
| `fill-hover` | `228 22.7% 91.4%` | `240 6.8% 20.2%` | `#e4e6ee` / `#303037` | Hover on `fill` |
| `well` | `240 6.7% 97.1%` | `240 5.7% 10.4%` | `#f7f7f8` / `#19191c` | Row hover in menus, stepped modal pane, past session cards |
| `hairline` | `0 0% 94.1%` | `240 6.7% 14.7%` | `#f0f0f0` / `#232328` | Separators inside a card, header bottom edge |
| `card` | `0 0% 100%` | `240 6.9% 11.4%` | `#ffffff` / `#1b1b1f` | Cards |
| `card-foreground` | `var(--foreground)` | inherits | `#0a0a0a` / `#f4f4f5` | Text on cards |
| `popover` | `0 0% 100%` | `240 6.9% 11.4%` | `#ffffff` / `#1b1b1f` | Menus, popovers |
| `popover-foreground` | `var(--foreground)` | inherits | `#0a0a0a` / `#f4f4f5` | Text in menus |
| `secondary` | `var(--fill)` | inherits | `#f2f3f5` / `#26262c` | shadcn alias of `fill` |
| `secondary-foreground` | `var(--foreground)` | inherits | `#0a0a0a` / `#f4f4f5` | shadcn alias |
| `muted` | `var(--fill)` | inherits | `#f2f3f5` / `#26262c` | shadcn alias of `fill` (`CountPill`) |
| `accent` | `var(--fill)` | inherits | `#f2f3f5` / `#26262c` | shadcn's neutral hover fill. Not the brand accent |
| `accent-foreground` | `var(--foreground)` | inherits | `#0a0a0a` / `#f4f4f5` | shadcn alias |
| `border` | `220 13% 91%` | `240 7.4% 18.6%` | `#e5e7eb` / `#2c2c33` | Default border (applied to `*`) |
| `border-hover` | `240 4.9% 83.9%` | `240 5.3% 26.1%` | `#d4d4d8` / `#3f3f46` | Card border on hover (`card-field.tsx`) |
| `input` | `220 13% 91%` | `240 7.4% 18.6%` | `#e5e7eb` / `#2c2c33` | Input borders |
| `ring` | `0 0% 3.9%` | `240 4.8% 95.9%` | `#0a0a0a` / `#f4f4f5` | Focus ring |

### Brand accent

Three names, three jobs:

- **`primary`** is the fill of the primary pill (`bg-primary text-primary-foreground`). It is the
  same indigo in both themes.
- **`brand`** is accent *text*, dots, rings and checks. In dark mode it lightens to `#7b7ff0`
  so accent text stays readable; use `text-brand`, never `text-primary`.
- **`accent`** (shadcn) is not brand at all: it is the neutral `fill`, used for menu-item focus.

| Token | Light | Dark | Hex light / dark | Use |
|---|---|---|---|---|
| `primary` | `238.3 75.4% 63.3%` | same | `#5b5fe8` / `#5b5fe8` | Primary pill fill, selected chip and day circle |
| `primary-foreground` | `0 0% 100%` | same | `#ffffff` / `#ffffff` | Text on `primary` and on `brand` fills |
| `primary-disabled` | `234.5 64.7% 86.7%` | `237.6 29.7% 32.4%` | `#c7cbf3` / `#3a3c6b` | Disabled primary pill (replaces the opacity fade) |
| `brand` | `238.3 75.4% 63.3%` | `237.9 79.6% 71.2%` | `#5b5fe8` / `#7b7ff0` | Accent text, live dots, now line, today badge, selected avatar ring |
| `brand-strong` | `238.2 58.6% 55.5%` | `237.9 79.6% 71.2%` | `#4b4fd0` / `#7b7ff0` | Text on `brand-tint` (In progress pill, today in the day strip) |
| `brand-tint` | `231.4 70% 96.1%` | `237.5 26.1% 18%` | `#eef0fc` / `#22233a` | Today column, selected rows, empty-day hover, drop target |
| `brand-tint-2` | `232.5 72.7% 95.7%` | `238.2 30.3% 21.4%` | `#eceefc` / `#262747` | Halo around today's session dot |
| `brand-border` | `233.1 59.1% 91.4%` | `237.8 34.2% 31%` | `#dcdff6` / `#34366a` | Hero card border, "Current" chip, empty-day hover border |
| `brand-dot` | `237.4 69.7% 87.1%` | `238 33.3% 35.9%` | `#c7c9f5` / `#3d3f7a` | Past session dots (Join session strip, month grid) |
| `brand-month` | `238.1 73.6% 74.7%` | `238.1 71.3% 65.9%` | `#8f92ee` / `#6a6ee6` | Defined, not used by any component today |
| `--highlight-tint` | `brand` at 10% | `brand` at 20% | n/a | Start of the highlight flash. A full color, not a triplet; a card sets `--highlight-rest` to its own fill so the flash ends there |
| `brand-elapsed` | `230 75% 98.4%` | `237.6 35.2% 27.8%` | `#f8f9fe` / `#2e3060` | Elapsed fill on a session card under way |
| `hero-wash` | gradient, below | gradient, below | n/a | `bg-hero-wash`: hero card background |

`--hero-wash`:

- Light: `radial-gradient(120% 90% at 100% 0%, #e3e6fb, rgba(238, 240, 252, 0.7) 45%, #fff)`
- Dark: `radial-gradient(120% 90% at 100% 0%, #262747, rgba(34, 35, 58, 0.7) 45%, #1b1b1f)`

### Status

| Token | Light | Dark | Hex light / dark | Use |
|---|---|---|---|---|
| `positive` | `142 39% 30.2%` | `142.5 39.1% 63.9%` | `#2f6b45` / `#7fc79a` | Ready and Completed text |
| `positive-solid` | `142 39% 30.2%` | inherits | `#2f6b45` / `#2f6b45` | Completed glyph and `CheckDisc` fill under a white check |
| `positive-tint` | `136.4 26.8% 92%` | `143.3 29% 12.2%` | `#e5f0e8` / `#16281d` | Ready and Completed pill background |
| `positive-wash` | `135 30.8% 94.9%` | `137.1 25.9% 10.6%` | `#eef6f0` / `#142218` | Hover on the Ready pill |
| `warning` | `26 90.5% 37.1%` | `34.7 85.4% 65.1%` | `#b45309` / `#f2b25a` | Warning icon (notes editor offline status) |
| `warning-text` | `22.7 82.5% 31.4%` | `34.7 85.4% 65.1%` | `#92400e` / `#f2b25a` | Overdue meta, "No topics" note on a session card |
| `error` | `4.2 76.5% 40%` | `4.1 92.5% 68.8%` | `#b42318` / `#f97066` | Error icon (`CardError`) |
| `error-tint` | `6.3 82.6% 95.5%` | `4.8 38.5% 12.7%` | `#fdecea` / `#2d1614` | Error icon disc |
| `error-border` | `4.9 69% 86.1%` | `4.1 46% 24.7%` | `#f4c7c3` / `#5c2622` | Defined, not used by any component today |
| `on-hold-ring` | `35.7 61.4% 61.4%` | `36.9 49.2% 48.6%` | `#d9a860` / `#b98a3f` | On hold glyph ring |
| `on-hold-fill` | `39.1 74.2% 93.9%` | `33.3 42.9% 12.4%` | `#fbf3e4` / `#2d2112` | On hold glyph and pill fill |
| `on-hold-text` | `36 76.9% 30.6%` | `34.7 85.4% 65.1%` | `#8a5a12` / `#f2b25a` | On hold pill text, pause bars, "Paused" meta |
| `status-idle` | `0 0% 76.9%` | `240 5.1% 30.6%` | `#c4c4c4` / `#4a4a52` | Not started glyph circle |
| `destructive` | `0 84.2% 60.2%` | `0 62.8% 30.6%` | `#ef4444` / `#7f1d1d` | Delete and danger; error toast icon |
| `destructive-foreground` | `0 0% 98%` | same | `#fafafa` / `#fafafa` | Text on `destructive` |

`error` is for failure states; `destructive` is for delete and danger actions.

### Inverse

The one surface that flips: dark in light mode, light in dark mode.

| Token | Light | Dark | Hex light / dark | Use |
|---|---|---|---|---|
| `inverse` | `0 0% 9%` | `240 4.8% 95.9%` | `#171717` / `#f4f4f5` | Toast pill, dot and month-grid tooltips, hovered drop slot |
| `inverse-foreground` | `0 0% 98%` | `240 5.3% 7.5%` | `#fafafa` / `#121214` | Text on `inverse`, toast countdown ring |
| `toast-check` | `141.7 76.6% 73.1%` | `142.8 64.2% 24.3%` | `#86efac` / `#166634` | Success toast check |
| `toast-warning` | `34.7 85.4% 65.1%` | `26 90.5% 37.1%` | `#f2b25a` / `#b45309` | Warning toast icon |

### Avatar palette

Light mode gives each person one of eight pastel pairs, picked by an FNV-1a hash of the user
id (`avatarToneFor` in `src/lib/avatar-palette.ts`), so a person keeps their color everywhere.
Dark mode remaps all eight pairs to the neutral `avatar` pair in CSS; the hash still runs.

| Token | Light | Hex light | Dark |
|---|---|---|---|
| `avatar` | `var(--fill)` | `#f2f3f5` | inherits (`#26262c`) |
| `avatar-foreground` | `240 5.3% 26.1%` | `#3f3f46` | `240 5.9% 90%` (`#e4e4e7`) |
| `avatar-1` / `-foreground` | `244.6 48.1% 94.7%` / `244.1 34.6% 42%` | `#ecebf8` / `#4b4690` | `var(--avatar)` / `var(--avatar-foreground)` |
| `avatar-2` / `-foreground` | `211.4 60% 93.1%` / `210.3 52.9% 36.7%` | `#e3edf8` / `#2c5d8f` | same |
| `avatar-3` / `-foreground` | `197.1 38.9% 92.9%` / `194 47.8% 31.6%` | `#e6f0f4` / `#2a6577` | same |
| `avatar-4` / `-foreground` | `136.4 26.8% 92%` / `142 39% 30.2%` | `#e5f0e8` / `#2f6b45` | same |
| `avatar-5` / `-foreground` | `150 35.3% 93.3%` / `153.9 55.1% 27.1%` | `#e8f4ee` / `#1f6b4a` | same |
| `avatar-6` / `-foreground` | `39.3 67.4% 91.6%` / `36 76.9% 30.6%` | `#f8eedb` / `#8a5a12` | same |
| `avatar-7` / `-foreground` | `6 71.4% 94.5%` / `7.2 54% 39.2%` | `#fbe9e7` / `#9a3b2e` | same |
| `avatar-8` / `-foreground` | `290.8 39.4% 93.5%` / `288 44.4% 33.1%` | `#f3e8f5` / `#6b2f7a` | same |

`avatar` / `avatar-foreground` also color the org tile in both themes.

### Scrim and rail

| Token | Light | Dark | Hex light / dark | Use |
|---|---|---|---|---|
| `scrim` | `rgba(24, 22, 32, 0.45)` | `rgba(0, 0, 0, 0.6)` | n/a | `bg-scrim` overlay |
| `rail-current` | `80 9.7% 93.9%` | `var(--fill)` | `#f0f1ee` / `#26262c` | Current step row in the rail |
| `rail-border` | `0 0% 92.9%` | `var(--border)` | `#ededed` / `#2c2c33` | Rail's right edge |

### Charts

| Token | Light | Dark | Hex light / dark |
|---|---|---|---|
| `chart-1` | `12 76% 61%` | `220 70% 50%` | `#e76e50` / `#2662d9` |
| `chart-2` | `173 58% 39%` | `160 60% 45%` | `#2a9d90` / `#2eb88a` |
| `chart-3` | `197 37% 24%` | `30 80% 55%` | `#274754` / `#e88c30` |
| `chart-4` | `43 74% 66%` | `280 65% 60%` | `#e8c468` / `#af57db` |
| `chart-5` | `27 87% 67%` | `340 75% 55%` | `#f4a462` / `#e23670` |

shadcn defaults. They are not exposed in `tailwind.config.ts` and no component uses them.

---

## Typography

**Family.** Inter, loaded by `next/font/google` (`subsets: ["latin"]`) in
`src/app/layout.tsx`, its class on `<html>`. The `body` rule in `globals.css` sets
`font-family: Inter, Arial, Helvetica, sans-serif`. Tailwind's `font-sans` points at
`var(--font-sans)`, which nothing defines and no component uses. The notes editor
(`simple-editor.scss`) imports Inter and DM Sans from Google Fonts itself and sets its content
in DM Sans.

**Scale.** Named sizes from `tailwind.config.ts`. Headings sit at regular weight; tracking
is baked into the large sizes.

| Class | Size / line height | Tracking | Weight in use | Where |
|---|---|---|---|---|
| `text-page-title` | 32px / 1.2 | -0.01em | n/a | Defined, unused |
| `text-headline` | 28px / 1.2 | -0.01em | 400 | Stepped modal step title (desktop, `leading-[1.15]`) |
| `text-section` | 26px / 1.25 | -0.01em | 400 | "This week" heading, stepped modal step title (phone) |
| `text-subhead` | 22px / 1.2 | -0.01em | 400 | Next session card headline (`leading-[1.12]`) |
| `text-card-title` | 17px / 1.35 | -0.01em | 400 to 600 | Week range, stepped modal rail title (600) |
| `text-item` | 13.5px / 1.4 | none | 500 | Buttons, list rows, menu rows |
| `text-label` | 12.5px / 1.4 | none | 500 or 400 | Labels, next-session time line, step position |
| `text-pill` | 11.5px / 1.3 | none | 500 | `Pill`, status pills, dot tooltip |
| `text-tiny` | 11px / 1.3 | none | 500 | Session card notes and footer pills, day initials |

Tailwind defaults carry most body copy: `text-sm` (14px, 157 uses in `src/components` and
`src/app`) and `text-xs` (12px, 129 uses) outnumber every named size. Common arbitrary sizes: `text-[13px]` (toasts, session card titles, card
buttons, hints), `text-[11px]`, `text-[10.5px]` (now-line time, drop-slot notes). Weights:
`font-medium` (500) is the default emphasis, `font-semibold` (600) for card titles on
session cards, avatar initials and badges. Counts: `font-medium` 144, `font-semibold` 44,
`font-normal` 11, `font-bold` 3.

Numbers, dates, times and counts use `tabular-nums`.

**Text color roles.**

| Role | Class | Use |
|---|---|---|
| Primary | `text-foreground` | Titles, body, values |
| Secondary | `text-ink-2` | Ghost and tertiary buttons, inactive nav, icon glyphs on fill |
| Muted | `text-muted-foreground` | Labels, meta, hints, done titles |
| Faint | `text-faint` | Chevrons, clear ×, past meta, "Done" footer. Fails body contrast |
| Accent | `text-brand` / `text-brand-strong` | Accent text / accent text on `brand-tint` |

---

## Spacing, radius and elevation

### Radius

| Class | Value | Use |
|---|---|---|
| `rounded-full` | 9999px | Buttons, chips, pills, avatars, toasts, day circles |
| `rounded-card` | 16px | `Card`, `StepDialog` (desktop), week panel |
| `rounded-popover` | 14px | Popover, DropdownMenu, ContextMenu, Select content |
| `rounded-xl` | 12px (Tailwind default) | Session cards, empty-day placeholders, card fields, Today block |
| `rounded-input` | 10px | `Input`, `SelectTrigger`, custom menu rows |
| `rounded-lg` | 8px (`--radius`) | Org tile, rail rows, header org link |
| `rounded-md` | 6px | shadcn leftovers: `Textarea`, `Tooltip`, `HoverCard`, `Command` |
| `rounded-sm` | 4px | Dropdown, Select and Command item rows |

Arbitrary radii in use: `rounded-[14px]` (today column), `rounded-[10px]` (month-grid
tooltip), `rounded-[6px]` (drop slots).

### Shadows

| Class | Light | Dark | Use |
|---|---|---|---|
| `shadow-card` | `0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.05)` | `0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.45)` | `Card`, upcoming session cards |
| `shadow-popover` | `0 12px 32px rgba(0,0,0,.1), 0 2px 6px rgba(0,0,0,.05)` | inherits | Menus, popovers, Select, month-grid tooltip |
| `shadow-toast` | `0 8px 24px rgba(0,0,0,.25)` | inherits | Toast pill |
| `shadow-modal` | `0 24px 60px rgba(0,0,0,.3)` | inherits | `StepDialog` (desktop) |

Flat on purpose: the week panel (`rounded-card border bg-card`, no shadow), past session
cards (`bg-well`), the goals overview card and the plain next-session shell (`shadow-none`).
Menus always carry a 1px `border` (`dropdown-menu.tsx`); in dark mode it is the only edge.
The desktop `StepDialog` adds one in dark mode only (`dark:border`).

### Spacing

Observed, not tokenized. Cards: `p-[22px]` (next session), `p-7` (week panel), `p-6` /
`p-4` (shadcn `CardHeader` / `CardContent` defaults and overrides), `p-[11px]` (session
cards), `px-4 py-3.5` (card fields). Pills: `px-[9px]` at 24px tall (`Pill`), `px-2.5` at
26px (session card footer pill), `px-4 py-2.5` (toast). Gaps: `gap-2` between icon and
label in buttons, `gap-4` between week-grid columns, `gap-2.5` in day agenda lists.

### Motion tokens

Defined in `tailwind.config.ts`. When to use which: style guide §4.

| Token | Value | Use |
|---|---|---|
| `ease-spring` | `cubic-bezier(.2, .8, .2, 1)` | Session dot grow, search expand; the toast spring-back uses the same curve inline |
| `animate-live-pulse` | opacity 1 to .35 to 1, 2s, infinite | Live dot |
| `animate-highlight-pulse` | scale to 1.02 at 35%, 600ms | Compact action card highlight |
| `animate-highlight-tint` | `var(--highlight-tint)` to `var(--highlight-rest)` (default `background`), 2s | Compact action card highlight tint |
| `animate-week-highlight` | `highlight-tint` and `highlight-pulse`, after a 220ms delay | Session card jumped to from the empty-week callout; `animate-week-highlight-still` (tint only) under reduced motion |
| `animate-kanban-card-enter` / `-exit` | scale and fade, 350ms | Action cards entering and leaving (kanban, session panel) |
| `animate-toast-ring` | stroke offset 0 to -43.98 (2π × 7), 6s default | Toast countdown ring |
| `animate-week-enter-from-left` / `-from-right` | 16px slide and fade in, 220ms, `ease-spring` | A new week entering the week panel, from the side it lies on |
| `animate-slide-in-from-left` | 20px slide, fade, scale .97, 0.4s | Unused |
| `animate-accordion-down` / `-up` | Radix content height, 0.2s | Unused (shadcn default) |

---

## Components and patterns

### Buttons

`src/components/ui/button.tsx`. Every variant is a pill: `rounded-full text-item
font-medium`, `gap-2`, 16px icons (`[&_svg]:size-4`), `transition-colors duration-150`, focus
ring `ring-2 ring-ring ring-offset-2`, disabled `opacity-50`.

| Variant | Classes | Use |
|---|---|---|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90`, disabled `bg-primary-disabled` at full opacity | Primary action |
| `secondary` | `bg-fill text-foreground hover:bg-fill-hover` (icon sizes: `text-ink-2`) | Neutral action, circular icon buttons |
| `tertiary` | `text-ink-2 hover:text-foreground`, no fill | Bare text + icon |
| `ghost` | `text-ink-2 hover:bg-fill hover:text-foreground` | Icon buttons in menus and dialogs |
| `outline` | `border border-input bg-background hover:bg-fill hover:text-foreground` | shadcn |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` | Danger |
| `link` | `text-brand underline-offset-4 hover:underline` | Inline link |

| Size | Box | Notes |
|---|---|---|
| `default` | h-10 (40), `px-4` | |
| `sm` | h-9 (36), `px-3.5` | Dense: header, session card buttons |
| `lg` | h-11 (44), `px-5` | |
| `xl` | h-12 (48), `px-6` | Phone footer (stepped modal) |
| `icon` / `icon-sm` / `icon-md` / `icon-lg` | 40 / 36 / 44 / 48 circle | `icon-lg` icon 18px |
| `icon-menu` | 28 circle, 14px icon | With `ghost`: `hover:bg-fill`, disabled `text-disabled-icon` |

The "Schedule session" button (`dashboard/week-grid/week-panel-header.tsx`) overrides its
fill to `bg-brand`, so in dark mode it is `#7b7ff0` rather than the `primary` `#5b5fe8`.

### Chips and pills

`src/components/ui/chip.tsx`, `pill.tsx`, `count-pill.tsx`, `badge.tsx`.

- **`Chip`**: toggle with `aria-pressed`. `sm` 24px `px-2.5 text-xs`; `md` 44px below 900px,
  36px from the `modal` breakpoint up, `px-4 text-[13px]`. Selected
  `bg-primary text-primary-foreground`, else `bg-fill hover:bg-fill-hover`.
- **`FilterChip`**: 24px, `border bg-card`, trailing `text-faint` × that clears.
- **`Pill`**: 24px, `px-[9px] text-pill font-medium`; the caller picks the color pair.
- **`CountPill`**: counter, `bg-muted text-[11px] text-muted-foreground`.
- **`Badge`**: shadcn shape kept: `rounded-full border px-2.5 py-0.5 text-xs
  font-semibold`, `default` is `bg-primary`.

### Status chips

`src/components/ui/status/`, `dashboard/week-grid/session-card.tsx`, `errors/card-error.tsx`.

| State | Look | Tokens | File |
|---|---|---|---|
| Ready (session card) | 26px pill, check + "Ready" + arrow, links to the session | `bg-positive-tint text-positive hover:bg-positive-wash` | `session-card.tsx` (`CardFooterPill`) |
| Prepare (session card) | Same pill, neutral | `bg-fill text-foreground hover:bg-fill-hover` | same |
| Done (session card) | Plain text, no pill | `text-tiny font-medium text-faint` | same |
| Not started | `Pill` | `bg-fill text-ink-2` | `status/status-pill.tsx` |
| In progress | `Pill` | `bg-brand-tint text-brand-strong` | same |
| On hold | `Pill` | `bg-on-hold-fill text-on-hold-text` | same |
| Completed | `Pill` | `bg-positive-tint text-positive` | same |
| Won't do | `Pill` | `bg-fill text-muted-foreground` | same |
| Error (card body) | 36px disc with alert icon, message, full-width retry | `bg-error-tint text-error` | `errors/card-error.tsx` |

The matching 20px glyphs are in `status/status-glyph.tsx` (`status-idle` ring; `brand`
ring with half disc; `on-hold-*` ring, fill and pause bars; solid `positive-solid` with a
white check; `muted-foreground`, `faint` in dark, with a white ×). Meta-line colors:
overdue `font-medium text-warning-text`, paused `text-on-hold-text`, else
`text-muted-foreground` (`status/status-meta.ts`).

The glyph and the pill both open `StatusMenu` (`status/status-menu.tsx`): 180px wide,
`rounded-xl p-1.5`, 36px `rounded-input` rows of glyph plus label in `text-item font-medium`,
with a `text-brand` check on the current status.

### Avatars and org tiles

`src/components/ui/avatar.tsx`.

- **`PersonAvatar`**: circle, sizes 20 / 26 / 28 / 36 / 40, initials `font-semibold`,
  colored by the [avatar palette](#avatar-palette). Selected adds
  `ring-2 ring-brand ring-offset-2 ring-offset-card`.
- **`OrgAvatar`**: 28px, `rounded-lg`, logo image or initials in
  `bg-avatar text-avatar-foreground text-[11px] font-medium`. Used in the header.

### Toasts

`src/components/ui/toast-pill.tsx`, `sonner.tsx`, `src/lib/toast`.

A single-line pill: `rounded-full bg-inverse text-inverse-foreground shadow-toast px-4
py-2.5 text-[13px]`, at most `min(100vw - 32px, 560px)` wide, centred from `sm` up. Leading
icon by kind: success check `text-toast-check`, warning triangle `text-toast-warning`, error
circle-alert `text-destructive`, loading spinner; neutral and info have none. A trailing
18px countdown ring (`stroke-inverse-foreground`, `animate-toast-ring`) empties over the
duration and pauses on hover, focus or a hidden tab. Action and cancel are underlined
`font-medium` text buttons. Sonner places it bottom-center, 24px offset (16px on mobile),
three visible, Sonner swipe off; the pill handles click, swipe and Esc itself.

### Today and the time indicator

`src/components/ui/dashboard/week-grid/` (`day-column.tsx`, `now-line.tsx`), `pulsing-dot.tsx`.

- **Today column**: `bg-brand-tint` with `rounded-[14px]`, bled out by `-mx-2 -my-2.5 p-2.5`;
  the day label goes `font-semibold text-foreground` and the date sits in a 20px `bg-brand`
  badge (`text-[11px] font-semibold text-primary-foreground`). Other days:
  `font-medium text-muted-foreground/60`, past days at `opacity-[.55]`.
- **Now line**: 2px row of a 6px `bg-brand` dot, a 1px `bg-brand` rule and the time in
  `text-[10.5px] font-medium text-brand`. A session under way shows its now dot and elapsed
  fill instead.
- **Live dot** (`PulsingDotTone.Accent`): `bg-brand` with a pinging `bg-brand/40` halo; used
  on cards and the next-session time line when a session is near.
- Today on phones: see [Day strip](#day-strip).

### Empty-day placeholders

`src/components/ui/dashboard/week-grid/empty-day.tsx`, `drop-slots.tsx`.

`h-32 rounded-xl border border-dashed border-border`, empty. When the viewer can schedule,
hover or focus turns it `border-brand-border bg-brand-tint` and reveals "+ Schedule" in
`text-xs font-medium text-brand`; today shows "No sessions today" in
`text-muted-foreground` at rest. Drop slots during a drag: 22px `rounded-[6px]` rows,
target `border-dashed border-brand bg-brand-tint text-brand-strong`, hovered
`bg-inverse text-inverse-foreground`. Phone agenda placeholders: see [Phones](#phones).

### Global header

`src/components/ui/site-header.tsx`.

56px (`h-14`), sticky, `bg-background` with a `border-hairline` bottom. Org tile and name
(`text-[15px] font-medium`), a 24px `bg-hairline` divider, destination pills
(`rounded-full text-sm font-medium`, 34px below `sm`, 36px from `sm`; active
`bg-fill text-foreground`, else `text-ink-2 hover:bg-fill-hover`). The Actions count is a
20px `bg-primary` badge. The avatar menu (`user-menu.tsx`) is 268px wide.

---

## Surfaces

Containers, overlays and the stepped modal.

### Cards

`src/components/ui/card.tsx`, `card-field.tsx`, `dashboard/week-grid/session-card.tsx`.

- **`Card`**: `rounded-card border bg-card text-card-foreground shadow-card`.
  `CardHeader` and `CardContent` keep shadcn's `p-6`; `CardTitle` keeps shadcn's
  `text-2xl font-semibold`, so callers set their own title style.
- **Panel**: the week panel and Today's Briefing are `rounded-card border bg-card` with no
  shadow (`week-panel.tsx`, `todays-briefing-panel.tsx`). The week grid is at least three
  cards tall (`min-h-[428px]`), so paging between weeks doesn't change the panel's height.
- **Card field**: `rounded-xl px-4 py-3.5`, `hover:border-border-hover`.
- **Wells**: `bg-well` marks a recessed area or quiet hover: the stepped modal's right pane,
  past session cards, menu-row hover (`hover:bg-well`), the open drop column.
- **Session card**: `rounded-xl p-[11px]`, upcoming `bg-card shadow-card`, past `bg-well`
  with `text-faint` meta. Under way it fills top-down with `brand-elapsed` and shows a 6px
  `bg-brand` now dot on its left edge. Filtered out `opacity-[.28]`; dragging
  `opacity-[.35]` with a dashed `faint` outline.

### Hero wash

`src/components/ui/dashboard/next-session-card.tsx`, `join-session/today-block.tsx`.

`bg-hero-wash`, always with `border-brand-border`: the next-session card (`Card` with
`ShellTone.Hero`) and the Join session menu's Today block (at `rounded-xl`). The style guide
limits it to one per screen.

### Popovers, menus and tooltips

`src/components/ui/popover.tsx`, `dropdown-menu.tsx`, `context-menu.tsx`, `select.tsx`,
`tooltip.tsx`.

- **Popover**: `w-72 rounded-popover border bg-popover p-4 shadow-popover`.
- **DropdownMenu / ContextMenu / Select content**: `rounded-popover border bg-popover p-1
  shadow-popover`. Items are still shadcn: `rounded-sm px-2 py-1.5 text-sm focus:bg-accent`.
- **Tooltip**: still shadcn: `rounded-md border bg-popover px-3 py-1.5 text-sm shadow-md`.
- **Empty-week callout** (`dashboard/week-grid/empty-week-callout.tsx`): the popover surface
  without a trigger, `rounded-popover border bg-popover shadow-popover px-4 py-3`, centred over
  an empty week; `text-sm text-foreground` message and a `link` button. On phones it sits in
  the agenda's flow as a `rounded-xl bg-well` box, flat.
- **Inverse tooltips** (hand-built): the session-dot tooltip
  (`join-session/session-dot-strip.tsx`, `rounded-full bg-inverse px-2.5 py-1 text-pill`) and
  the month-grid tooltip (`new-session/month-grid.tsx`, `rounded-[10px] bg-inverse
  shadow-popover text-xs`).

### Stepped modal

`src/components/ui/step-dialog.tsx`.

Desktop (900px and up, the `modal` screen): an 860px-wide dialog,
`StepDialogHeight.Tall` 560px or `Standard` 520px, `rounded-card shadow-modal`, `dark:border`,
over `bg-scrim`. Two columns:

- **Rail** (300px): `bg-card`, `border-r border-rail-border`, title `text-card-title
  font-semibold`, step rows `rounded-lg p-2.5` (current `bg-rail-current`, done rows lead with
  a 16px `positive` `CheckDisc`), optional footer pinned to the bottom with a
  `border-hairline` rule above it (`mt-auto border-t pt-3.5`).
- **Pane**: `bg-well`, step title `text-headline`, body the only scroll region, footer
  with the lead (hint or confirm), "n of m" in `text-label tabular-nums`, and step arrows.

Below 900px it becomes the [full-screen step view](#full-screen-step-view).
`StepDialogVariant.Single` drops position, arrows, footer and step list. The base `Dialog`,
`AlertDialog` and `Sheet` are still shadcn (`bg-black/80` overlay, `bg-background`,
`shadow-lg`).

---

## Phones

Also cited as Mobile. Below `lg` the week becomes a day strip plus one day's agenda; below
900px (`modal`) the stepped modal goes full screen. Phone behavior rules: style guide §3
"Phones".

### Day strip

`src/components/ui/dashboard/week-grid/day-strip.tsx`.

Seven 44px `rounded-full` pills, `text-tiny` weekday initial over a `text-sm font-semibold`
date. Selected `bg-brand text-primary-foreground`; today `bg-brand-tint text-brand-strong`;
other days `bg-fill hover:bg-fill-hover`, past days `text-muted-foreground`. A 4px dot marks
days with sessions: `bg-primary-foreground` on the selected day, `bg-brand` otherwise.

### Day agenda

`src/components/ui/dashboard/week-grid/day-agenda.tsx`.

The selected day's session cards in a `gap-2.5` column under a `text-sm font-semibold`
heading. An empty day is a `min-h-14 rounded-xl border border-dashed border-border` row with
"No sessions" in `text-muted-foreground`; while loading it is the same row, empty.

### Full-screen step view

`src/components/ui/step-dialog.tsx`.

Full-screen `bg-well`; a 56px `bg-card` top bar with a `border-hairline` bottom
("Title · n of m" in `text-item`, 44px close); `text-section` step title; a footer
`border-t border-hairline bg-card` with the back arrow and an `xl` (48px) Next or confirm
pill, padded for the safe area.

---

## Dark mode

- **Switch.** `next-themes` with `attribute="class"`, `defaultTheme="system"`,
  `enableSystem`, `disableTransitionOnChange` (`root-layout-providers.tsx`). Tailwind uses
  `darkMode: ["class"]`. The avatar menu offers Light, Dark and Auto (`user-menu.tsx`;
  Auto is `system`). `<html suppressHydrationWarning>` absorbs the class set before hydration.
- **Mapping.** `.dark` redefines the same roles on a cool-grey (zinc) scale; nothing is pure
  black (page `#121214`, cards and menus `#1b1b1f`). Components style with tokens, so most
  need no `dark:` classes. Exceptions are listed under [Known gaps](#known-gaps).
- **Notes per group:**
  - `primary` keeps its indigo; `brand` lightens to `#7b7ff0` for text on dark surfaces.
  - Tints (`brand-tint`, `positive-tint`, `error-tint`, `on-hold-fill`) become dark,
    low-chroma fills; their text tokens lighten.
  - `warning`, `warning-text` and `on-hold-text` share `#f2b25a`.
  - `inverse` flips to a light pill; `toast-check` and `toast-warning` darken to stay
    visible on it.
  - Avatars collapse to the neutral pair; only light mode is colorful.
  - `shadow-card` gets much stronger (40%/45% black). Popover, toast and modal shadows are
    not redefined.
  - `scrim` becomes plain 60% black; `rail-current` and `rail-border` alias `fill` and
    `border`.
  - `positive-solid`, `primary`, `primary-foreground` and `destructive-foreground` do not
    change.

---

## Using the system outside the app

The backend's transactional emails mirror these tokens. Their stylesheet
(`refactor-platform-rs` `domain/templates/email/base.html`) holds the hex values, light and
dark, of `background`, `card`, `foreground`, `ink-2`, `muted-foreground`, `faint`, `fill`,
`hairline`, `border` and `primary`. The reschedule email's "Now" panel also uses `brand`
(`#5b5fe8` / `#7b7ff0`), `brand-tint` (`#eef0fc` / `#22233a`) and `brand-border`
(`#dcdff6` / `#34366a`); its "Before" panel uses the muted greys. The emails also take the
16px card radius and Inter. See `refactor-platform-rs`
`docs/architecture/email_composition.md`. When one of those tokens changes here, change it
there in the same release.

---

## Known gaps

Recorded so the next change can settle each one; the code is current.

**Code vs plan and style guide**

- Session cards: the style guide's decisions log says they stay flat; upcoming ones carry
  `shadow-card`.
- Menu rows: the style guide gives `rounded-input` and `hover:bg-well`; the shadcn
  DropdownMenu, ContextMenu, Select and Command items are still `rounded-sm` with
  `focus:bg-accent` (`fill`). Hand-built rows follow the guide.
- `Tooltip`, `HoverCard`, `Dialog`, `AlertDialog`, `Sheet` and `Textarea` keep shadcn
  shapes (`rounded-md`, `shadow-md`/`shadow-lg`, `bg-black/80` overlay).
- Header destination pills are 34px below `sm` and 36px from `sm` up (`site-header.tsx`),
  not the 36px dense height throughout.
- The avatar menu is 268px (`user-menu.tsx`); the Phase 1 plan says 260.
- Error toasts use `destructive`, as the Phase 1 plan decided, not the `error` token.
- Defined but unused: `brand-month`, `error-border`, `chart-1` to `chart-5`,
  `text-page-title`, `font-sans` (`--font-sans` undefined).
- The Phase 1 plan had the avatar palette function return the neutral pair in dark mode;
  the code always returns the tone and the CSS remaps it.
- The plan merged ghost into tertiary; the code keeps both (tertiary bare, ghost
  hover-filled) and adds `icon-md` (44) and `icon-lg` (48), and `PersonAvatar` size 20.
- The plan moved the compact action card highlight to `primary`; the code uses `brand`.
- `globals.css` has two `@layer base` blocks applying `border-border` and the `body`
  colors; the first also sets the font.

**Colors outside the token set**

Raw Tailwind palette colors bypass the tokens and need their own `dark:` handling, or have
none:

- `text-red-500` (19 uses) and `border-red-500` (13) for form errors in
  `setup/account-setup-form.tsx`, `password-reset/reset-password-form.tsx`,
  `password-reset/forgot-password-form.tsx` and `members/profile-info-update-form.tsx`.
- `bg-zinc-800` / `border-zinc-700` and `bg-yellow-200` in
  `coaching-sessions/transcript-bubble.tsx`.
- `text-violet-600 dark:text-violet-400` and `text-sky-600` in
  `coaching-sessions/topic-provenance.tsx`.
- `text-amber-500` in `coaching-sessions/transcript-status-indicator.tsx` and
  `transcript-empty-state.tsx`.
- `bg-yellow-200` in `search/search-snippet.tsx`.
- `bg-green-500` / `bg-gray-900` in `presence-indicator.tsx`.
- Raw palette classes in the auth and entry pages: `app/page.tsx`,
  `app/setup/[token]/page.tsx`, `app/forgot-password/page.tsx`,
  `app/reset-password/[token]/page.tsx`, `app/organizations/[id]/members/page.tsx`.

Token-based `dark:` overrides, which are intended: the Won't do glyph (`dark:fill-faint`)
and the desktop stepped modal border (`dark:border`).

### Specified, not yet implemented

From the owner's Claude Design spec (a `design-system.md` outside this repo). It is a
proposal, not the authority; where it differs from the code, the code is what ships.

- **Destructive recolor:** proposed `#c9291c` in both themes; code ships `#ef4444` /
  `#7f1d1d`.
- **Error patterns:** field, banner and whole-page errors. Only the card pattern
  (`CardError`) exists; `error-border` is defined for the banner but unused.
- **Input focus:** proposed accent border plus a 3px accent tint ring; code uses
  `ring-2 ring-ring ring-offset-2`.
- **Menu rows:** proposed 36 to 40px rows, 10px radius, hover `well`, focus `fill`,
  selected accent tint with a check; code rows are shadcn (see above).
- **Bottom sheet** for phones (20px top radius, handle, at most 82% tall): not built; the
  avatar menu is still a dropdown.
- **Day strip:** proposed 56px pills, 12px radius, 5px dot; code is 44px `rounded-full`
  with a 4px dot.
- **Dashboard:** the Today's Briefing panel ships with the next session and goals cards;
  Your tasks, Prep this week, Member updates and the Work-through modal are not built.
- **Session glance** (read-only stepped modal from a past card), **session requests** and
  the **Members page** redesign: not built.
- **Search grouped by person:** code groups by kind, Sessions first.
- **`brand-month` dots** for the selected month in the session scrubber: token exists,
  unused.
- **`text-page-title`** for page titles: defined, unused.
