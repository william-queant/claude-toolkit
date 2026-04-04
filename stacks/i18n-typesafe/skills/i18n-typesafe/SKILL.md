---
name: i18n-typesafe
description: Typesafe-i18n internationalization patterns for SolidJS
---

# Typesafe-i18n Patterns

## Overview

typesafe-i18n provides fully type-safe translations with autocompletion. Translation keys are checked at compile time -- missing or misspelled keys cause TypeScript errors.

## Setup with SolidJS

### Installation
```bash
npm install typesafe-i18n
```

### Directory Structure
```
src/
  i18n/
    i18n-types.ts       # Auto-generated types
    i18n-util.ts         # Auto-generated utilities
    i18n-solid.tsx       # SolidJS adapter
    en/
      index.ts           # Base locale (source of truth)
    fr/
      index.ts           # French translations
```

### Configuration (.typesafe-i18n.json)
```json
{
  "baseLocale": "en",
  "adapter": "solid",
  "outputPath": "src/i18n/{locale}/",
  "typesFileName": "i18n-types",
  "utilFileName": "i18n-util"
}
```

### Run the Generator
```bash
npx typesafe-i18n
```
This watches your base locale and regenerates types automatically.

## Base Locale (en)

The base locale is the source of truth. All types are derived from it.

```ts
// src/i18n/en/index.ts
import type { BaseTranslation } from '../i18n-types';

const en = {
  common: {
    welcome: 'Welcome, {name:string}!',
    itemCount: '{count:number} {{item|items}}',
    save: 'Save',
    cancel: 'Cancel',
    loading: 'Loading...',
    error: 'Something went wrong',
  },
  auth: {
    signIn: 'Sign in',
    signOut: 'Sign out',
    email: 'Email address',
    password: 'Password',
    forgotPassword: 'Forgot your password?',
  },
  events: {
    title: 'Events',
    create: 'Create event',
    noEvents: 'No events yet',
    attendees: '{count:number} {{attendee|attendees}}',
  },
} satisfies BaseTranslation;

export default en;
```

## Adding Translations (fr)

```ts
// src/i18n/fr/index.ts
import type { Translation } from '../i18n-types';

const fr = {
  common: {
    welcome: 'Bienvenue, {name} !',
    itemCount: '{count} {{article|articles}}',
    save: 'Enregistrer',
    cancel: 'Annuler',
    loading: 'Chargement...',
    error: 'Une erreur est survenue',
  },
  auth: {
    signIn: 'Se connecter',
    signOut: 'Se deconnecter',
    email: 'Adresse email',
    password: 'Mot de passe',
    forgotPassword: 'Mot de passe oublie ?',
  },
  events: {
    title: 'Evenements',
    create: 'Creer un evenement',
    noEvents: 'Aucun evenement pour le moment',
    attendees: '{count} {{participant|participants}}',
  },
} satisfies Translation;

export default fr;
```

The `Translation` type is derived from the base locale. Missing keys or wrong parameter types cause compile errors.

## Using LL in Components

```tsx
import { useI18nContext } from '../i18n/i18n-solid';

const EventList = (props) => {
  const { LL } = useI18nContext();

  return (
    <div>
      <h1>{LL().events.title()}</h1>
      <Show when={props.events.length > 0} fallback={<p>{LL().events.noEvents()}</p>}>
        <For each={props.events}>{(event) =>
          <div>
            <span>{event.name}</span>
            <span>{LL().events.attendees({ count: event.memberCount })}</span>
          </div>
        }</For>
      </Show>
      <button>{LL().events.create()}</button>
    </div>
  );
};
```

### Provider Setup
```tsx
// App.tsx
import { I18nProvider } from './i18n/i18n-solid';
import { loadLocale } from './i18n/i18n-util';

const App = () => {
  loadLocale('en'); // Load initial locale

  return (
    <I18nProvider locale="en">
      <Router />
    </I18nProvider>
  );
};
```

## Plural Rules

typesafe-i18n uses `{{singular|plural}}` syntax. The plural form is selected based on the preceding number parameter.

```ts
const en = {
  itemCount: '{count:number} {{item|items}}',
  // count=0 -> "0 items"
  // count=1 -> "1 item"
  // count=5 -> "5 items"
};
```

For languages with more complex plural rules (e.g., Arabic), use the full plural form:
```ts
const ar = {
  itemCount: '{count} {{element|two elements|elements}}',
};
```

## Parameterized Translations

Parameters are type-checked based on the base locale definition.

```ts
// Base locale
const en = {
  greeting: 'Hello {name:string}, you have {count:number} new messages',
  link: 'Click {0:string}',  // Positional parameter
};

// Usage -- TypeScript enforces parameter types
LL().greeting({ name: 'Alice', count: 3 });
LL().link('here');
```

## Namespace Organization

For large applications, organize translations by feature/domain.

```ts
const en = {
  // Global namespace
  common: { ... },
  auth: { ... },

  // Feature namespaces
  events: { ... },
  profile: { ... },
  settings: { ... },
  admin: { ... },
};
```

Keep namespaces flat (one level deep). Avoid deeply nested structures -- they make keys verbose and harder to manage.

## Anti-Patterns

1. **Hardcoded strings** -- Every user-visible string must go through `LL()`. No raw string literals in components.
2. **Missing translations** -- The `Translation` type catches these at compile time, but only if you run the type checker. Always run `tsc --noEmit` in CI.
3. **Interpolating HTML** -- Do not embed HTML in translation strings. Use component composition instead.
4. **Dynamic key access** -- Avoid `LL()[dynamicKey]()`. It bypasses type safety. Use conditional rendering or a lookup map.
5. **Forgetting to load locale** -- Call `loadLocale()` before rendering. Missing locale data causes runtime errors.
6. **Over-splitting namespaces** -- Too many small namespaces add overhead. Group by feature, not by component.
