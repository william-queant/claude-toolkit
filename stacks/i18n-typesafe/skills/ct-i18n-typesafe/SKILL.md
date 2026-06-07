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

## Performance

> _Verified against typesafe-i18n + SolidJS (2026-06)._

Ship one locale, not all. typesafe-i18n generates both loaders -- pick the async one.

```ts
// CORRECT: per-locale dynamic import -> separate chunk, only active locale fetched
import { loadLocaleAsync } from './i18n/i18n-util.async';
await loadLocaleAsync(detectLocale());   // e.g. 'en' loads the i18n/en chunk only

// WRONG: i18n-util.sync static-imports every dictionary at module top -> all in this bundle
import { loadLocale } from './i18n/i18n-util.sync';
loadLocale('en');                        // loadAllLocales() is worse
```

Build formatters once per locale; never construct Intl objects in a component or list row. (Measured: constructing `Intl.NumberFormat` ~20x slower than reusing one instance.)

```ts
// src/i18n/formatters.ts -- constructed once via loadFormatters(locale)
export const initFormatters: FormattersInitializer<Locales, Formatters> = (locale) => ({
  // Intl.* is expensive to construct; reuse the instance across all calls
  currency: (v: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(v),
});
// usage in en/index.ts: price: 'Total: {amount:number|currency}'  -- typed param, not new Intl.* at the call site
```

Don't block first paint on the locale fetch. In Solid, `<Suspense>` only suspends on a tracked resource read -- a bare `await loadLocaleAsync()` will NOT trip the boundary. Drive it off a resource (or use the Solid adapter's `<TypesafeI18n>`, which withholds children until the locale loads):

```tsx
import { createResource, Suspense } from 'solid-js';
// loaded() is read inside the boundary, so Suspense shows the shell until the chunk arrives
const [loaded] = createResource(detectLocale, loadLocaleAsync);
<Suspense fallback={<AppShell />}>{loaded.state === 'ready' && props.children}</Suspense>
// index.html: a modulepreload link for /assets/i18n-en-*.js overlaps with the main bundle fetch
```

RTL: drive the html dir attribute from the locale; use CSS logical properties so layout flips with zero extra CSS or JS.

```css
.card { margin-inline-start: 1rem; padding-inline: 1rem; inset-inline-start: 0; } /* not margin-left */
```

## Anti-Patterns

1. **Hardcoded strings** -- Every user-visible string goes through `LL()`.
2. **Missing translations** -- Caught at compile time, but only if `tsc --noEmit` runs in CI.
3. **HTML in translations** -- Use component composition instead.
4. **Dynamic key access** -- `LL()[dynamicKey]()` bypasses type safety. Use conditional rendering.
5. **Forgetting loadLocale** -- Must call before rendering or get runtime errors.
6. **Over-splitting namespaces** -- Group by feature, not by component.
7. **Sync `loadLocale` / `loadAllLocales` in app code** -- `i18n-util.sync` static-imports every dictionary into the bundle that pulls it in. Use `loadLocaleAsync` so each locale is its own chunk.
8. **Constructing `Intl.NumberFormat`/`DateTimeFormat` per render** -- ~20x costlier than reuse; build once in `formatters.ts` and reference via `{v:number|formatter}`.
9. **Awaiting `loadLocaleAsync` without a Suspense-tracked resource** -- Blanks the screen until the JSON loads, and a bare `await` never trips Solid's `<Suspense>`. Gate via `createResource` (or `<TypesafeI18n>`), show a shell fallback, and modulepreload the active locale.
10. **Physical CSS for layout (`margin-left`, `left`)** -- Breaks RTL and needs per-dir overrides. Use logical properties (`margin-inline-start`, `inset-inline-start`).

## See Also

- `ct-solidjs-patterns` — the `createResource`-tracked `<Suspense>` boundary (a bare `await` never suspends in Solid) and `lazy()` cold-start splitting.
- `ct-vanilla-extract-patterns` — RTL = `dir` from locale (here) + logical properties authored in `.css.ts` (there).
