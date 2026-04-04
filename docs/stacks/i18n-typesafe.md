# Typesafe-i18n Patterns

> Typesafe-i18n internationalization patterns for SolidJS.

**Type:** Stack Skill (requires `i18n-typesafe` stack)
**Source:** [`stacks/i18n-typesafe/skills/i18n-typesafe/SKILL.md`](../stacks/i18n-typesafe/skills/i18n-typesafe/SKILL.md)
**Directory Mappings:** `src/locales/`, `src/i18n/`

## Overview

typesafe-i18n provides fully type-safe translations with autocompletion. Translation keys are checked at compile time -- missing or misspelled keys cause TypeScript errors.

## Setup

### Directory Structure
```
src/i18n/
  i18n-types.ts       # Auto-generated types
  i18n-util.ts         # Auto-generated utilities
  i18n-solid.tsx       # SolidJS adapter
  en/index.ts          # Base locale (source of truth)
  fr/index.ts          # French translations
```

### Configuration (`.typesafe-i18n.json`)
```json
{
  "baseLocale": "en",
  "adapter": "solid",
  "outputPath": "src/i18n/{locale}/"
}
```

### Run the Generator
```bash
npx typesafe-i18n    # Watches base locale and regenerates types
```

## Base Locale

The base locale is the source of truth. All types are derived from it.

```ts
// src/i18n/en/index.ts
const en = {
  common: {
    welcome: 'Welcome, {name:string}!',
    itemCount: '{count:number} {{item|items}}',
    save: 'Save',
  },
  auth: {
    signIn: 'Sign in',
    signOut: 'Sign out',
  },
} satisfies BaseTranslation;
```

## Adding Translations

Other locales use the `Translation` type derived from the base locale. Missing keys or wrong parameter types cause compile errors.

```ts
// src/i18n/fr/index.ts
const fr = {
  common: {
    welcome: 'Bienvenue, {name} !',
    itemCount: '{count} {{article|articles}}',
    save: 'Enregistrer',
  },
  auth: {
    signIn: 'Se connecter',
    signOut: 'Se deconnecter',
  },
} satisfies Translation;
```

## Usage in Components

```tsx
const { LL } = useI18nContext();

return (
  <div>
    <h1>{LL().events.title()}</h1>
    <span>{LL().events.attendees({ count: event.memberCount })}</span>
  </div>
);
```

### Provider Setup
```tsx
<I18nProvider locale="en">
  <Router />
</I18nProvider>
```

## Parameterized Translations

| Syntax | Example | Description |
|---|---|---|
| `{name:string}` | `'Hello {name:string}'` | Named string parameter |
| `{count:number}` | `'{count:number} items'` | Named number parameter |
| `{{singular\|plural}}` | `'{count} {{item\|items}}'` | Plural forms |
| `{0:string}` | `'Click {0:string}'` | Positional parameter |

## Namespace Organization

Organize translations by feature/domain. Keep namespaces flat (one level deep):

```ts
const en = {
  common: { ... },    // Global
  auth: { ... },       // Authentication
  events: { ... },     // Events feature
  profile: { ... },    // User profile
  settings: { ... },   // Settings
  admin: { ... },      // Admin panel
};
```

## Anti-patterns

| Anti-pattern | Why it's wrong |
|---|---|
| **Hardcoded strings** | Every user-visible string must go through `LL()`. |
| **Missing translations** | `Translation` type catches these at compile time -- run `tsc --noEmit` in CI. |
| **Interpolating HTML** | Do not embed HTML in translation strings. Use component composition. |
| **Dynamic key access** | `LL()[dynamicKey]()` bypasses type safety. Use conditional rendering. |
| **Forgetting to load locale** | Call `loadLocale()` before rendering. |
| **Over-splitting namespaces** | Too many small namespaces add overhead. Group by feature, not component. |
