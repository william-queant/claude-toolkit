# Vanilla Extract Patterns

> Type-safe CSS with vanilla-extract, sprinkles, and recipes.

**Type:** Stack Skill (requires `vanilla-extract` stack)
**Source:** [`stacks/vanilla-extract/skills/ct-vanilla-extract-patterns/SKILL.md`](../stacks/vanilla-extract/skills/ct-vanilla-extract-patterns/SKILL.md)
**Directory Mappings:** `src/styles/`, `src/theme/`
**File Extensions:** `.css.ts`

## Overview

vanilla-extract provides zero-runtime, type-safe CSS written in TypeScript. All styles are authored in `*.css.ts` files and extracted to static CSS at build time.

**Important:** All vanilla-extract files MUST use the `*.css.ts` extension. The build plugin only processes these files.

## Core API

### style() -- Single Class Styles

Creates a single scoped class name with type-checked CSS properties.

```ts
import { style } from '@vanilla-extract/css';

export const button = style({
  padding: '8px 16px',
  borderRadius: '4px',
  ':hover': { opacity: 0.9 },
});
```

Compose styles by passing an array:

```ts
export const primaryButton = style([button, { background: 'blue', color: 'white' }]);
```

### styleVariants() -- Variant Maps

Creates a map of related style variants from a single definition.

```ts
export const colorVariant = styleVariants({
  primary: { background: 'blue', color: 'white' },
  secondary: { background: 'gray', color: 'black' },
  danger: { background: 'red', color: 'white' },
});
```

### recipe() -- Component Variants

Creates multi-variant styles with `defaultVariants` and compound variants. Requires `@vanilla-extract/recipes`.

```ts
export const buttonRecipe = recipe({
  base: { padding: '8px 16px', borderRadius: '4px' },
  variants: {
    color: {
      primary: { background: 'blue', color: 'white' },
      secondary: { background: 'gray', color: 'black' },
    },
    size: {
      small: { fontSize: '12px' },
      medium: { fontSize: '14px' },
      large: { fontSize: '16px' },
    },
  },
  defaultVariants: { color: 'primary', size: 'medium' },
});
```

### globalStyle() -- Use Sparingly

For CSS resets, body defaults, or third-party element overrides only.

## Theming

### Contract-first theming (recommended)

```ts
import { createThemeContract, createTheme } from '@vanilla-extract/css';

export const vars = createThemeContract({
  color: { brand: null, text: null, background: null },
  space: { small: null, medium: null, large: null },
});

export const lightTheme = createTheme(vars, {
  color: { brand: '#0066ff', text: '#1a1a1a', background: '#ffffff' },
  space: { small: '4px', medium: '8px', large: '16px' },
});
```

Use `vars` for type-safe token references: `style({ color: vars.color.brand })`

### Sprinkles -- Atomic Utility Classes

Requires `@vanilla-extract/sprinkles`. Creates constrained atomic CSS classes with responsive conditions.

## Anti-patterns

| Anti-pattern                  | Why it's wrong                                                   |
| ----------------------------- | ---------------------------------------------------------------- |
| **Inline styles**             | Defeats the purpose. Use `style()` or `sprinkles()`.             |
| **Runtime CSS**               | vanilla-extract is build-time only.                              |
| **Overusing globalStyle**     | Prefer scoped `style()`. Global styles create implicit coupling. |
| **Non-`.css.ts` files**       | Style definitions in `.ts` files will not be processed.          |
| **String-based theme values** | Use the `vars` object for type-safe references.                  |

## Best Practices Reference

| Topic                                     | Guide                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `type` vs `interface` for theme contracts | [Type vs Interface](../best-practices/typescript/type-vs-interface.md)       |
| `satisfies` for config validation         | [The satisfies Operator](../best-practices/typescript/satisfies-operator.md) |
