---
name: ct-i18n-typesafe
description: Typesafe-i18n internationalization patterns for SolidJS
---

# Typesafe-i18n Patterns

Fully type-safe translations. Missing/misspelled keys cause TypeScript errors at compile time.

## Base Locale (Source of Truth)

All types are derived from the base locale. Other locales implement `Translation` (type-checked against base).

```ts
// src/i18n/en/index.ts
const en = {
  common: {
    welcome: 'Welcome, {name:string}!',
    itemCount: '{count:number} {{item|items}}',
    save: 'Save',
    cancel: 'Cancel',
  },
  events: {
    title: 'Events',
    create: 'Create event',
    noEvents: 'No events yet',
    attendees: '{count:number} {{attendee|attendees}}',
  },
} satisfies BaseTranslation;
```

Other locales mirror this structure with `satisfies Translation`. Missing keys or wrong param types cause compile errors.

## Usage in Components

```tsx
const { LL } = useI18nContext();
// Simple: LL().common.save()
// Params: LL().common.welcome({ name: 'Alice' })
// Plural: LL().events.attendees({ count: 3 }) -> "3 attendees"
```

Wrap app in `<I18nProvider locale="en">` after calling `loadLocale('en')`.

## Plural Rules

`{{singular|plural}}` selected by preceding number param. For complex plural languages (e.g. Arabic): `{{one|two|many}}`.

## Parameterized Translations

Types are inferred from base locale: `{name:string}`, `{count:number}`. TypeScript enforces correct params at call sites.

## Organization

Organize by feature (common, auth, events), one level deep. Avoid deep nesting -- it makes keys verbose.

## Anti-Patterns

1. **Hardcoded strings** -- Every user-visible string goes through `LL()`.
2. **Missing translations** -- Caught at compile time, but only if `tsc --noEmit` runs in CI.
3. **HTML in translations** -- Use component composition instead.
4. **Dynamic key access** -- `LL()[dynamicKey]()` bypasses type safety. Use conditional rendering.
5. **Forgetting loadLocale** -- Must call before rendering or get runtime errors.
6. **Over-splitting namespaces** -- Group by feature, not by component.
