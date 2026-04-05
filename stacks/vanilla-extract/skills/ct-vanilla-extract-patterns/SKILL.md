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

## Anti-Patterns

1. **Inline styles** -- Use `style()` or `sprinkles()`.
2. **Runtime CSS** -- No `document.createElement('style')` or CSS-in-JS libs alongside.
3. **Overusing globalStyle** -- Prefer scoped `style()`. Reserve global for resets only.
4. **Non-`.css.ts` files** -- Build plugin only processes `*.css.ts`.
5. **Raw CSS variable strings** -- Use the `vars` object for type-safe references.
