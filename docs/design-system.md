# GRREAT Design System — "Ink & Paper"

**Status:** adopted. Winner of a 3-proposal, 3-judge evaluation (Ink & Paper 98, Typecase 98, pragmatic-hybrid 97; 2/3 judges chose Ink & Paper as the base). Grafted-in ideas from the other two are marked ⊕ throughout.

**Principle:** every visual decision is a CSS custom property; every component is a plain `.astro` file with a scoped `<style>` that consumes tokens and exposes variants via `data-*` attributes remapping local custom properties — the pattern the codebase already proves with `--bucket`. No Tailwind, no Sass, no PostCSS, no client runtime.

**ADR — Tailwind rejected** ⊕: the site has ~6 recurring utility-shaped patterns; a framework buys 40k classes and a second dialect to cover six. Revisit only if the authenticated app grows dozens of dense data-UI screens.

---

## 1. Tokens

Two files. **Layer 1 (primitives)** keeps the existing `:root` names verbatim ⊕ — `--paper`, `--ink`, `--hair`, etc. from `global.css:10-25` — so migration step 1 is a true zero-diff and no alias/cleanup step ever exists. **Layer 2 (semantic)** is the only color vocabulary components may use. Dark mode later = one `[data-theme='dark']` block remapping Layer 2.

All type/space tokens are **rem** (user font-size scaling works). Type floor is **10px** ⊕ (raises today's 8/9px mono).

### `src/styles/tokens/primitives.css`

```css
/* LAYER 1 — the ONLY file with raw values. Names preserved from current global.css. */
:root {
  /* Color (existing names, existing values) */
  --paper: #f0ede4;
  --paper-light: #f8f6ef;
  --ink: #151513;
  --muted: #6c6a62;
  --hair: #b9b5aa;
  --yellow: #f4e548;
  --blue: #2448ff;
  --red: #ef4b3f;
  --green: #3a8f65;
  --purple: #9d4edd;
  --orange: #e15c16;
  --white: #ffffff;

  /* Type families (existing names) */
  --serif: 'DM Serif Display', Georgia, serif;
  --sans: 'IBM Plex Sans', Arial, sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, monospace;

  /* Type scale — current 8/9/10/11/12/13/14/18px sprawl collapses to 5 UI steps.
     10px floor: today's 8px (colophon, .reg) and 9px (labels) move up. */
  --text-1: 0.625rem;    /* 10px micro — was 8/9/10px */
  --text-2: 0.75rem;     /* 12px label/ui — was 11/12px */
  --text-3: 0.8125rem;   /* 13px body-s */
  --text-4: 0.875rem;    /* 14px body */
  --text-5: 1.125rem;    /* 18px lead / h3 */
  /* Display (fluid; values lifted from current clamps) */
  --text-d1: clamp(1.125rem, 2vw, 1.625rem);  /* 18→26  now-action */
  --text-d2: clamp(1.75rem, 4vw, 3rem);       /* 28→48  section titles */
  --text-d3: clamp(2.625rem, 8vw, 4.875rem);  /* 42→78  wordmark, mobile floor baked in */
  --text-tagline: clamp(1rem, 2.5vw, 1.375rem); /* 16→22 */
  --text-numeral: 2.5rem;                     /* 40px bucket letters / now-index */

  --leading-none: 1;
  --leading-tight: 1.05;    /* display serif (was 1.02/0.83) */
  --leading-snug: 1.3;
  --leading-normal: 1.5;
  --leading-relaxed: 1.6;

  /* Tracking — current drift (0.05–0.14em caps; -3.5/-2/-1.5px display) snaps to 3 values */
  --tracking-display: -0.03em;
  --tracking-caps-1: 0.08em;
  --tracking-caps-2: 0.12em;

  /* Space — 4px base. Current ad-hoc px values snap to nearest step. */
  --space-1: 0.25rem;  --space-2: 0.5rem;   --space-3: 0.75rem;
  --space-4: 1rem;     --space-5: 1.25rem;  --space-6: 1.5rem;
  --space-7: 2rem;     --space-8: 2.5rem;   --space-9: 3rem;
  --space-10: 3.5rem;  --space-11: 4rem;

  /* Lines / radii / motion */
  --border-1: 1px;  --border-2: 2px;  --border-3: 3px;
  --radius: 0;                              /* squared corners: a decision, not an absence */
  --duration-fast: 0.15s;
  --duration-slow: 0.3s;

  /* Layout — fluid tokens that delete whole media-query classes */
  --shadow-offset: clamp(5px, 1vw, 7px);    /* replaces the 7px→5px 760px patch */
  --gutter: clamp(1.125rem, 4vw, 2.25rem);  /* 18→36px; replaces the #1 duplicated query pair */
  --measure: 65ch;                          /* ⊕ ch-based prose measure (was ad-hoc 520/600/680px) */
  --content-max: 70rem;                     /* 1120px, keeps current --max-width value */
}

/* Breakpoint convention (vars can't feed media queries — this comment IS the token):
   md = 48rem (768px, replaces 760px) · lg = 64rem (1024px). min-width ONLY. */
```

### `src/styles/tokens/semantic.css`

```css
/* LAYER 2 — roles. Components consume ONLY these (+ space/type primitives). */
:root {
  color-scheme: light;

  --surface-page:    var(--paper);
  --surface-raised:  var(--paper-light);   /* cards, inputs */
  --surface-focus:   var(--white);         /* input focus bg (was hardcoded #fff) */
  --surface-accent:  var(--yellow);        /* highlight card, hover fills, focus ring */
  --surface-inverse: var(--ink);           /* filled buttons, kicker chip */

  --text-strong:  var(--ink);
  --text-muted:   var(--muted);
  --text-inverse: var(--paper-light);
  --text-link-hover: var(--blue);

  --border-strong: var(--ink);             /* structural rules, card edges */
  --border-hair:   var(--hair);            /* internal dividers, ruled grids */

  --focus-ring: var(--yellow);
  --shadow-hard: var(--shadow-offset) var(--shadow-offset) 0 var(--border-strong);

  /* Feedback — decoupled from bucket colors so they can diverge */
  --feedback-error:   var(--red);
  --feedback-success: var(--green);
  --feedback-warning: var(--orange);
  --feedback-info:    var(--blue);

  /* Category (bucket) palette */
  --bucket-goals: var(--red);       --bucket-research: var(--blue);
  --bucket-roadmap: var(--purple);  --bucket-execution: var(--orange);
  --bucket-analysis: var(--green);  --bucket-time: var(--ink);
}
```

No composite `--textstyle-*` font-shorthand tokens ⊕ (judges flagged `font:` shorthand's silent resets as a footgun — dropped).

**Layer 3 (component tokens)** — `--btn-bg`, `--card-pad` — declared *inside* a component's scoped style, defaulting to Layer 2. Applied **sparingly**: Button and Card get a component-token API (parents retune via local vars); everything else uses plain semantic tokens ⊕.

### `src/styles/tokens/themes.css` (dark-mode readiness — ship the file, not the toggle)

```css
[data-theme='dark'] {
  color-scheme: dark;
  --surface-page: #14130f;   --surface-raised: #1c1b16;  --surface-focus: #262620;
  --surface-inverse: var(--paper-light);
  --text-strong: #eae7dc;    --text-muted: #99968b;      --text-inverse: #14130f;
  --border-strong: #eae7dc;  --border-hair: #3a382f;
  /* --surface-accent stays yellow: brand accent survives inversion */
}
```

### Rules that keep it honest
- Hex codes and raw px ramps exist **only** in `primitives.css`.
- Components reference semantic tokens (colors) + primitives (space/type) — never a primitive color directly.
- Anything needed by >1 component's scoped style becomes a token, not a shared class.

---

## 2. File layout

```
src/
├── styles/
│   ├── tokens/
│   │   ├── primitives.css   # Layer 1 (only file with raw values)
│   │   ├── semantic.css     # Layer 2 (roles)
│   │   └── themes.css       # [data-theme='dark'] remap
│   ├── base.css             # reset, html/body, links, :focus-visible, reduced-motion
│   ├── utilities.css        # ONLY .sr-only — hard cap
│   └── global.css           # @layer orchestrator; APPEND-CLOSED ⊕ (legacy shrinks to zero)
├── components/
│   ├── primitives/          # Button, Card, MicroLabel, Prose, Rule, RuledGrid,
│   │   …                    # Input, Field, VisuallyHidden
│   ├── layout/              # Container, Section, Stack, Cluster, Switcher
│   ├── patterns/            # HighlightCard, AnnotatedList, StatusMessage,
│   │   …                    # Topbar, Footer, BucketCard, (future: Modal, NavBar, PageShell)
│   └── landing/             # current 9 components become thin compositions
├── content/
│   ├── buckets.ts           # 6 bucket defs {key, letter, name, desc}
│   └── principles.ts
├── layouts/BaseLayout.astro # + theme?: 'light'|'dark' prop → <html data-theme>
└── pages/index.astro
```

`global.css` becomes the cascade orchestrator (Astro bundles `@import` natively):

```css
@layer tokens, base, utilities, legacy;   /* scoped component styles are unlayered → always win */
@import './tokens/primitives.css' layer(tokens);
@import './tokens/semantic.css'   layer(tokens);
@import './tokens/themes.css'     layer(tokens);
@import './base.css'              layer(base);
@import './utilities.css'         layer(utilities);
/* legacy: current section CSS, deleted block-by-block during migration */
```

**Directory rules:** `layout/` may only use space/size tokens (no color, no content knowledge). `primitives/`+`patterns/` style themselves via scoped `<style>` only. `landing/` composes and should rarely have a `<style>` block. Inline `style=""` is banned except primitive-injected custom properties (e.g. Stack's `--stack-gap`).

---

## 3. Component inventory & APIs

Conventions (universal): typed `export interface Props` with destructured defaults (BaseLayout's existing pattern); `class` passthrough via `class:list`; `...rest` spread for aria/data attrs; variants as `data-variant` string unions (never class-string concatenation); interactive scripts target `data-*` hooks + `aria-describedby`, never `nextElementSibling`.

### `components/layout/`

| Component | Props | Replaces |
|---|---|---|
| `Container` | `size?: 'content'\|'measure'\|'full' = 'content'`, `as? = 'div'` | re-declared `max-width + margin auto + var(--gutter)` in `.hero`, `section`, `.colophon` |
| `Section` | `title: string`, `number?: string` (omit → CSS-counter auto ⊕), `id?: string` (omit → slug from title ⊕), `rule?: boolean = true` — slots: default, `intro` | the ×5 copy-pasted scaffold + manual "03 /" numbering |
| `Stack` | `gap?: 1–11 = 6`, `as? = 'div'` | `style="margin-top:20px"` soup |
| `Cluster` | `gap?`, `align?`, `justify?`, `as? = 'div'` | topbar/colophon flex-wrap rows |
| `Switcher` ⊕ | `threshold?: string = '28rem'`, `gap?` | simple row→column flips (SignupForm layout) without a query |

### `components/primitives/`

| Component | Props | Notes |
|---|---|---|
| `Button` | `variant?: 'solid'\|'outline'\|'ghost' = 'solid'`, `size?: 'md'\|'sm' = 'md'`, `type?: 'button'\|'submit' = 'button'`, `href?: string` (renders `<a>`), `full?: boolean` | component-token API (`--btn-*`); §5 |
| `Card` | `variant?: 'default'\|'highlight' = 'default'`, `pad?: 1–11 = 6`, `as? = 'div'` | `highlight` = `--surface-accent` bg + `--shadow-hard` + `margin-inline-end: var(--shadow-offset)` compensation, maintained in exactly one place |
| `MicroLabel` | `size?: 'micro'\|'label' = 'label'`, `muted?: boolean`, `as? = 'span'` | THE mono-caps microlabel (9+ call sites) |
| `Prose` | `size?: 'body'\|'body-s' = 'body'`, `muted? = true`, `measure? = true` | the 5 inline-styled intro paragraphs |
| `Rule` | `weight?: 'strong'\|'hair' = 'strong'` | section rules / hairlines, `aria-hidden` built in |
| `RuledGrid` | `min?: string = '13rem'`, `as? = 'ul'` | ONE mechanism (gap-trick: `gap: var(--border-1); background: var(--border-hair)`), `repeat(auto-fit, minmax(min(var(--grid-min),100%),1fr))` — deletes the 35-line nth-child version AND the 900px/500px queries |
| `Input` | `type? = 'text'`, `name`, `id`, `placeholder?`, `required?` | single focus treatment: global `:focus-visible` only, deletes `outline: none` |
| `Field` | `label: string`, `id: string`, `hint?: string`, `hideLabel?: boolean` — slot: control | future app forms |
| `VisuallyHidden` | `as? = 'span'` | unifies `.honeypot` + `.sr-only` |

### `components/patterns/`

| Component | Props | Notes |
|---|---|---|
| `HighlightCard` | `index: string`, `label: string`, `owner?: string` — slot: default | the NOW card; own-width reflow via `@container` |
| `AnnotatedList` | `items: {lead: string; note?: string; marker?: string}[]`, `columns?: 1\|2 = 1` | feedback rows AND principles rows share one anatomy |
| `StatusMessage` | `state: 'idle'\|'success'\|'error'\|'warning'`, `id: string` | `aria-live="polite"`, states via `data-state` → `--feedback-*`; forms point at it with `aria-describedby` |
| `BucketCard` | `bucket: 'goals'\|'research'\|'roadmap'\|'execution'\|'analysis'\|'time'`, `letter`, `name`, `desc` | keeps the `data-bucket` → `--bucket` remap verbatim |
| `Topbar` | `folio?: string`, `pageNo?: string` — slot: nav | |
| `Footer` | `links?: {label: string; href: string}[]` | fix "PROPHETARY" typo in passing |
| *future* `Modal` | native `<dialog>` + vanilla `showModal()` | zero framework |
| *future* `NavBar`, `PageShell` | Topbar/`.shell` generalized when the app surface starts | |

### `components/landing/`
The 9 existing components survive as thin compositions: `BucketExplainer` = `<Section>` + `<RuledGrid>` + `buckets.map(b => <BucketCard {...b}/>)` from `content/buckets.ts`; `Principles` maps `principles.ts` into `<AnnotatedList columns={2}>`. Keep `slot="form"` composition. **`landing/` never grows again** — new pages build from `layout/` + `primitives/` + `patterns/`.

---

## 4. Mobile-first responsive rules

Base styles ARE the mobile styles. Priority order when a component must adapt:

1. **Intrinsic — no query.** Fluid `--gutter`, `--shadow-offset`, display `clamp()`s; `RuledGrid` auto-fit (kills bucket-grid 900px/500px queries); `Cluster` flex-wrap (colophon, topbar).
2. **`Switcher`** ⊕ for simple row→column flips keyed to own width (SignupForm).
3. **Container queries** for structural component reflow (HighlightCard's 3-col→stacked): `container-type: inline-size` on the root + `@container (min-width: 34rem)`. Components stay correct inside future app sidebars/split panes.
4. **Viewport queries — escape hatch.** `min-width` only, two named breakpoints (`48rem` md, `64rem` lg), written *inside the owning component's scoped style* — the "five scattered 760px blocks" problem becomes structurally impossible. Expected residue after migration: ~2–3 total (topbar folio, section top padding).
5. **Type floor: `--text-1` (10px).** Nothing smaller, ever.

---

## 5. Foundational code

### 5a. Tokens
See §1 — `primitives.css`, `semantic.css`, `themes.css` are complete as written; create them verbatim.

### 5b. `src/components/layout/Section.astro` (the layout primitive)

```astro
---
export interface Props {
  title: string;
  number?: string;      // omit → auto CSS counter; pass to override
  id?: string;          // omit → slug derived from title
  rule?: boolean;
}
const { title, number, id, rule = true } = Astro.props;
const slug = id ?? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
---

{rule && <hr class="rule" aria-hidden="true" />}
<section class="section" aria-labelledby={`${slug}-title`}>
  <header class="header">
    <span class="number" aria-hidden="true">{number ? `${number} /` : null}</span>
    <h2 id={`${slug}-title`} class="title">{title}</h2>
  </header>
  {Astro.slots.has('intro') && <div class="intro"><slot name="intro" /></div>}
  <slot />
</section>

<style>
  .rule {
    border: 0; border-top: var(--border-1) solid var(--border-strong);
    max-inline-size: var(--content-max);
    margin: 0 auto; inline-size: calc(100% - 2 * var(--gutter));
  }
  .section {
    counter-increment: section;   /* base.css: body { counter-reset: section } */
    max-inline-size: var(--content-max);
    margin-inline: auto;
    padding: var(--space-8) var(--gutter) 0;   /* fluid gutter: no 760px patch */
  }
  @media (min-width: 48rem) { .section { padding-block-start: var(--space-10); } }

  .header { display: flex; align-items: baseline; gap: var(--space-3); margin-block-end: var(--space-6); }
  .number {
    font-family: var(--mono); font-size: var(--text-1); font-weight: 500;
    text-transform: uppercase; letter-spacing: var(--tracking-caps-2);
    color: var(--text-muted); min-inline-size: var(--space-9);
  }
  .number:empty::before { content: counter(section, decimal-leading-zero) ' /'; }
  .title {
    margin: 0; font-family: var(--serif); font-weight: 400;
    font-size: var(--text-d2); line-height: var(--leading-tight);
    letter-spacing: var(--tracking-display);
  }
  .intro {
    max-inline-size: var(--measure); margin-block-end: var(--space-6);
    font-size: var(--text-4); line-height: var(--leading-relaxed);
    color: var(--text-muted);
  }
</style>
```

Reordering sections in `index.astro` renumbers for free; explicit `number` still wins when the editorial conceit demands it.

### 5c. `src/components/primitives/Button.astro`

```astro
---
export interface Props {
  variant?: 'solid' | 'outline' | 'ghost';
  size?: 'md' | 'sm';
  type?: 'button' | 'submit';
  href?: string;
  full?: boolean;
  class?: string;
}
const { variant = 'solid', size = 'md', type = 'button', href, full = false, class: className, ...rest } = Astro.props;
const Tag = href ? 'a' : 'button';
---

<Tag
  class:list={['btn', className]}
  data-variant={variant}
  data-size={size}
  data-full={full || undefined}
  {...(href ? { href } : { type })}
  {...rest}
>
  <slot />
</Tag>

<style>
  .btn {
    /* component tokens — the retuning API for parents/themes */
    --btn-bg: var(--surface-inverse);
    --btn-fg: var(--text-inverse);
    --btn-border: var(--border-strong);
    --btn-bg-hover: var(--surface-accent);
    --btn-fg-hover: var(--text-strong);
    --btn-pad-y: var(--space-3);
    --btn-pad-x: var(--space-6);

    display: inline-flex; align-items: center; justify-content: center;
    gap: var(--space-2);
    padding: var(--btn-pad-y) var(--btn-pad-x);
    border: var(--border-2) solid var(--btn-border);
    border-radius: var(--radius);
    background: var(--btn-bg); color: var(--btn-fg);
    font-family: var(--mono); font-size: var(--text-2); font-weight: 500;
    text-transform: uppercase; letter-spacing: var(--tracking-caps-2);
    text-decoration: none; cursor: pointer;
    transition: background var(--duration-fast), color var(--duration-fast);
  }
  .btn:hover { background: var(--btn-bg-hover); color: var(--btn-fg-hover); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn[data-variant='outline'] { --btn-bg: transparent; --btn-fg: var(--text-strong); }
  .btn[data-variant='ghost']   { --btn-bg: transparent; --btn-fg: var(--text-strong); border-color: transparent; }
  .btn[data-size='sm']         { --btn-pad-y: var(--space-2); --btn-pad-x: var(--space-4); }
  .btn[data-full]              { inline-size: 100%; }
  /* No viewport query ⊕: width is the CALLER's concern (Switcher/container decides). */
  /* Focus: global :focus-visible ring only — no per-component override. */
</style>
```

Parent retuning example (Layer 3 in action): `.now-card .btn { --btn-bg-hover: var(--surface-page); }`.

---

## 6. Migration — ordered by dependency; every step ships, page pixel-comparable throughout

**Step 0 — Visual-regression baseline (~30 min)** ⊕. Playwright screenshots of the live page at 375/768/1280px (webapp-testing skill). Every step below must diff-match.

**Step 1 — Tokens under the existing CSS (zero visual change).** Create `styles/tokens/*`, `base.css`, `utilities.css`; rewrite `global.css` as the `@layer` orchestrator with the current ~600 lines appended under `layer(legacy)`. Because Layer 1 keeps `--paper`/`--ink`/`--hair`/`--yellow`… verbatim ⊕, **no alias block is needed and no cleanup step exists** — legacy CSS just keeps working. Declare `global.css` append-closed ⊕. Move `body { counter-reset: section }` into `base.css`. Also: drop the unused Plex Sans 500 weight from the font URL.

**Step 2 — Kill inline styles + duplicate hidden-helpers.** Extract `Prose`, `MicroLabel`, `VisuallyHidden`, `Rule`, `Stack`. Replace the 6 `style=""` attributes; move `.sr-only` out of SignupForm's `<style is:global>` into `utilities.css`; honeypot uses `VisuallyHidden`. Fix the Footer "PROPHETARY" typo. Smallest risk, highest hygiene.

**Step 3 — `Section` + `Container`.** Convert all 5 sectioned components; auto-numbering live from day one ⊕. Delete `.section-*`, `.section-rule`, and container recipes from the legacy layer.

**Step 4 — The rest of the primitives + patterns (one PR per section, any order).**
- `BucketExplainer` → `content/buckets.ts` + `RuledGrid` + `BucketCard`; delete `.bucket-*`.
- `Principles` → `content/principles.ts` + `AnnotatedList columns={2}`; deletes the 35-line nth-child block.
- `FeedbackLoop` → `Card` + `AnnotatedList marker="→"`.
- `WorkingSession` → `HighlightCard` ×2 in a `Stack gap={5}` (container-query reflow).
- `SignupForm` → `Switcher` + `Input` + `Button` + `StatusMessage`; JS targets `aria-describedby`/`data-state`, killing `nextElementSibling` and class-string coupling; delete the input's `outline: none`.
- `Masthead`/`Topbar`/`Footer` → `Container`, `Cluster`, `MicroLabel`; keep `slot="form"`.
Each PR deletes its legacy-layer block; screenshots must match Step 0 baseline.

**Step 5 — Delete the (now empty) legacy layer.** `global.css` ≈ 15 lines of imports. Optionally self-host the three font families in `public/fonts/` with `font-display: swap` (same-origin on Workers).

**Step 6 — Polish + future-proofing.** Add `themes.css` + `theme` prop on BaseLayout (`<html data-theme={theme}>`); confirm zero `max-width` media queries remain; app-surface components (`PageShell`, `NavBar`, `Modal`) built on demand from the same primitives.

**Guardrail (add to CI alongside vitest):** fail on `#[0-9a-f]{3,6}` outside `src/styles/tokens/`, `style="` in `.astro` (excluding `--`-prefixed custom-property injection), and `max-width:` inside `@media`. Five lines of grep; keeps the system from regressing.

---

## 7. Synthesis notes (what was grafted, and from where)

| ⊕ Graft | Source | Why |
|---|---|---|
| Keep existing token names as Layer 1; no alias block, no cleanup step | pragmatic-hybrid | flagged by all 3 judges; makes Step 1 zero-diff and preserves grep-ability vs. grreat-vault |
| Playwright screenshot baseline as Step 0 | Typecase | judges 1 & 2: highest-value single idea |
| CSS-counter auto section numbering with explicit-prop override, day one | Typecase / pragmatic-hybrid | judges 1 & 2; override prop answers judge 3's grep-ability objection |
| `65ch` prose measure | Typecase | tracks the actual font |
| 10px type floor, expressed in rem | Typecase (floor) + Ink & Paper (rem) | mobile legibility + user font-size scaling |
| Dropped `--textstyle-*` composite font tokens | judges 2 & 3 | `font:` shorthand silently resets sub-properties |
| Component-token APIs on Button/Card only, not system-wide | judge 3 | retuning API where useful, not a maintenance liability |
| `Switcher` primitive alongside container queries | Typecase | simpler mental model for plain row→column flips |
| Button: no viewport query; `full` prop instead | judges 1 & 2 | fixes the proposal's own container-query doctrine violation |
| "global.css is append-closed" rule + written Tailwind ADR | pragmatic-hybrid | one-line governance that outperforms linters |
