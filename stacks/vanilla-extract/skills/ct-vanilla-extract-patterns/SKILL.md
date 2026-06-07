---
name: ct-vanilla-extract-patterns
description: Type-safe CSS with vanilla-extract, sprinkles, and recipes
---

# Vanilla Extract Patterns

All styles in `*.css.ts` files only. Build-time extraction, zero runtime.

## Core APIs

```ts
// style() -- scoped class
export const button = style({ padding: '8px 16px', ':hover': { opacity: 0.9 } });

// Compose via array
export const primary = style([button, { background: 'blue', color: 'white' }]);

// styleVariants() -- variant map
export const color = styleVariants({
  primary: { background: 'blue', color: 'white' },
  danger: { background: 'red', color: 'white' },
});
```

## recipe() -- Multi-Variant Components

```ts
export const btn = recipe({
  base: { padding: '8px 16px', border: 'none' },
  variants: {
    color: { primary: { background: 'blue' }, secondary: { background: 'gray' } },
    size: { sm: { fontSize: '12px' }, md: { fontSize: '14px' }, lg: { fontSize: '16px' } },
  },
  compoundVariants: [{ variants: { color: 'primary', size: 'lg' }, style: { fontWeight: 'bold' } }],
  defaultVariants: { color: 'primary', size: 'md' },
});
// Usage: btn({ color: 'secondary', size: 'lg' })
```

## Theming

Contract-first approach -- define shape, then fill per theme:

```ts
export const vars = createThemeContract({
  color: { brand: null, text: null, bg: null },
  space: { sm: null, md: null, lg: null },
});
export const light = createTheme(vars, {
  color: { brand: '#0066ff', text: '#1a1a1a', bg: '#fff' },
  space: { sm: '4px', md: '8px', lg: '16px' },
});
// Use in styles: style({ color: vars.color.brand })
```

## Sprinkles

Constrained atomic utility classes with responsive conditions:

```ts
const props = defineProperties({
  conditions: { mobile: {}, tablet: { '@media': '(min-width: 768px)' } },
  defaultCondition: 'mobile',
  properties: { display: ['none', 'flex', 'block'], padding: vars.space },
});
export const sprinkles = createSprinkles(props);
```

## Performance

> _Verified against vanilla-extract (2026-06)._

Zero-runtime is the point: all classes/vars are extracted at build, the browser does the styling. Keep it that way — the wins below are about *bytes shipped* and *theme-swap cost*, not JS.

### Theme swap = one attribute write, zero re-render

`createTheme` returns a **class that only sets CSS custom properties**. Swapping themes is one DOM write; the cascade repaints — no component re-render, no JS restyle.

```ts
// createTheme(tokens) -> [class, contract]; createTheme(contract, tokens) -> class
export const [themeClass, vars] = createTheme({ color: { bg: '#fff', text: '#111' } });
export const dark = createTheme(vars, { color: { bg: '#111', text: '#eee' } }); // same contract, new values

// runtime: flip the class on a root element — that's the entire cost
root.className = isDark ? dark : themeClass;            // no setState, no re-render
```

Prefer the attribute path if you'd rather not own the class: register the theme on a selector at build time, then the runtime cost is a single `data-*` write.

```ts
// build time (.css.ts): bind a theme to a selector
createGlobalTheme('[data-theme="dark"]', vars, { color: { bg: '#111', text: '#eee' } });
// runtime: one attribute write, cascade does the rest
document.documentElement.dataset.theme = 'dark';
```

`assignVars` is the *build-time* way to assign a whole contract in one shot inside a `style()`/`globalStyle()` `vars` block — handy for declaring a theme on a selector — not a runtime knob. Never put theme values in component state; let the CSS-variable cascade do it.

### Sprinkles dedup — CSS grows with declarations, not components

Each property-value(-condition) emits **one class, once**. 500 components calling `sprinkles({ padding: 'md' })` share a single class. Stylesheet size is bounded by `properties x values x conditions`, not usage. (Note: `style({ padding: vars.space.md })` does *not* dedupe across call sites — route high-frequency props through sprinkles to get the shared class.)

```ts
// good: high-frequency layout/spacing -> sprinkles (deduped)
<div class={sprinkles({ display: 'flex', paddingInline: 'lg' })} />
// reserve style() for genuine one-offs
```

Keep condition sets lean: every condition multiplies class count per property. A property with 6 values across 3 breakpoints = 18 classes.

### Logical properties (also your RTL story)

Author `paddingInline` / `marginInline` / `insetInlineStart` instead of `left`/`right`. One stylesheet flips for RTL via `dir="rtl"` — no duplicate LTR/RTL CSS, no runtime mirroring lib.

| physical            | logical              |
| ------------------- | -------------------- |
| `paddingLeft/Right` | `paddingInline`      |
| `marginTop/Bottom`  | `marginBlock`        |
| `left` / `right`    | `insetInlineStart/End` |

## Anti-Patterns

1. **Inline styles** -- Use `style()` or `sprinkles()`.
2. **Runtime CSS** -- No `document.createElement('style')` or CSS-in-JS libs alongside.
3. **Overusing globalStyle** -- Prefer scoped `style()`. Reserve global for resets only.
4. **Non-`.css.ts` files** -- Build plugin only processes `*.css.ts`.
5. **Raw CSS variable strings** -- Use the `vars` object for type-safe references.
6. **Theme in component state** — Re-renders the tree on toggle. Swap a class/`data-theme` on the root; the CSS-var cascade handles the rest with zero re-render.
7. **Bespoke `style()` for common spacing/layout** — Defeats sprinkles dedup (`style()` doesn't merge identical declarations across call sites). Route high-frequency props through `sprinkles()`; one shared class instead of N.
8. **Physical left/right** — Forces a second RTL stylesheet. Use logical `*Inline`/`*Block` props; one sheet flips with `dir="rtl"`.
9. **Wide conditions x properties matrix** — Class count = properties x values x conditions. Trim breakpoints and property lists before they explode the CSS.

## See Also

- `ct-solidjs-patterns` — keep theme out of the reactive graph; swap a `data-theme` attribute, not a signal.
- `ct-i18n-typesafe` — RTL = `dir` from locale (i18n) + logical properties (here).
- `ct-capacitor-ui` — mobile webview: animate `transform`/`opacity` only; avoid `box-shadow`/`filter` on scrolled nodes.
