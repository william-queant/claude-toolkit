---
name: vanilla-extract-patterns
description: Type-safe CSS with vanilla-extract, sprinkles, and recipes
---

# Vanilla Extract Patterns

## Overview

vanilla-extract provides zero-runtime, type-safe CSS written in TypeScript. All styles are authored in `*.css.ts` files and extracted to static CSS at build time.

## style() -- Single Class Styles

Creates a single scoped class name with type-checked CSS properties.

```ts
// button.css.ts
import { style } from '@vanilla-extract/css';

export const button = style({
  padding: '8px 16px',
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px',
  ':hover': {
    opacity: 0.9,
  },
  ':focus-visible': {
    outline: '2px solid blue',
  },
});
```

Compose styles by passing an array:
```ts
export const primaryButton = style([button, { background: 'blue', color: 'white' }]);
```

## styleVariants() -- Variant Maps

Creates a map of related style variants from a single definition.

```ts
import { styleVariants } from '@vanilla-extract/css';

export const colorVariant = styleVariants({
  primary: { background: 'blue', color: 'white' },
  secondary: { background: 'gray', color: 'black' },
  danger: { background: 'red', color: 'white' },
});
// Usage: colorVariant.primary, colorVariant.secondary, etc.
```

Map from data:
```ts
const colors = { brand: '#0066ff', accent: '#ff6600' } as const;
export const bgColor = styleVariants(colors, (color) => ({
  backgroundColor: color,
}));
```

## recipe() -- Component Variants

Creates multi-variant styles with `defaultVariants` and compound variants. Requires `@vanilla-extract/recipes`.

```ts
import { recipe } from '@vanilla-extract/recipes';

export const buttonRecipe = recipe({
  base: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: 'none',
  },
  variants: {
    color: {
      primary: { background: 'blue', color: 'white' },
      secondary: { background: 'gray', color: 'black' },
    },
    size: {
      small: { fontSize: '12px', padding: '4px 8px' },
      medium: { fontSize: '14px', padding: '8px 16px' },
      large: { fontSize: '16px', padding: '12px 24px' },
    },
  },
  compoundVariants: [
    {
      variants: { color: 'primary', size: 'large' },
      style: { fontWeight: 'bold' },
    },
  ],
  defaultVariants: {
    color: 'primary',
    size: 'medium',
  },
});

// Usage: buttonRecipe({ color: 'secondary', size: 'large' })
```

## globalStyle() -- Use Sparingly

Sets global styles. Use only for CSS resets, body defaults, or third-party element overrides.

```ts
import { globalStyle } from '@vanilla-extract/css';

globalStyle('html, body', {
  margin: 0,
  padding: 0,
  fontFamily: 'system-ui, sans-serif',
});

// Can target children of a scoped class
globalStyle(`${container} > a`, {
  color: 'inherit',
});
```

## Theming -- createTheme / createThemeContract

### Contract-first theming (recommended)
```ts
// theme.css.ts
import { createThemeContract, createTheme } from '@vanilla-extract/css';

export const vars = createThemeContract({
  color: { brand: null, text: null, background: null },
  space: { small: null, medium: null, large: null },
  font: { body: null },
});

export const lightTheme = createTheme(vars, {
  color: { brand: '#0066ff', text: '#1a1a1a', background: '#ffffff' },
  space: { small: '4px', medium: '8px', large: '16px' },
  font: { body: 'system-ui, sans-serif' },
});

export const darkTheme = createTheme(vars, {
  color: { brand: '#66aaff', text: '#e0e0e0', background: '#1a1a1a' },
  space: { small: '4px', medium: '8px', large: '16px' },
  font: { body: 'system-ui, sans-serif' },
});
```

Use `vars` in any style:
```ts
export const heading = style({ color: vars.color.brand });
```

## Sprinkles -- Atomic Utility Classes

Requires `@vanilla-extract/sprinkles`. Creates a constrained set of atomic CSS classes.

```ts
import { defineProperties, createSprinkles } from '@vanilla-extract/sprinkles';

const responsiveProperties = defineProperties({
  conditions: {
    mobile: {},
    tablet: { '@media': 'screen and (min-width: 768px)' },
    desktop: { '@media': 'screen and (min-width: 1200px)' },
  },
  defaultCondition: 'mobile',
  properties: {
    display: ['none', 'flex', 'block', 'grid'],
    padding: vars.space,
    gap: vars.space,
  },
});

export const sprinkles = createSprinkles(responsiveProperties);

// Usage: sprinkles({ display: 'flex', padding: 'medium', gap: { mobile: 'small', desktop: 'large' } })
```

## File Naming

All vanilla-extract files MUST use the `*.css.ts` extension. The build plugin only processes these files.

```
src/
  components/
    Button/
      Button.tsx
      Button.css.ts      <-- styles here
  theme/
    theme.css.ts
    sprinkles.css.ts
```

## Anti-Patterns

1. **Inline styles** -- Defeats the purpose. Use `style()` or `sprinkles()` instead.
2. **Runtime CSS** -- vanilla-extract is build-time only. Do not use `document.createElement('style')` or CSS-in-JS runtime libs alongside it.
3. **Overusing globalStyle** -- Prefer scoped `style()`. Global styles create implicit coupling.
4. **Non-`.css.ts` files** -- Style definitions in `.ts` files will not be processed by the plugin.
5. **String-based values for theme tokens** -- Use the `vars` object for type-safe references, not raw CSS variable strings.
