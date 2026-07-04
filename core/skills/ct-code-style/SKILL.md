---
name: ct-code-style
description: Code structure & style — guard clauses, lookup tables, destructuring, no classes, no magic values
---

# Code Style

Write small, flat, data-driven functions. These conventions apply to all JS/TS. Stack skills override where noted below.

## Guard clauses / early returns

Return early on edge cases; never nest the happy path inside `else`.

```ts
// Bad — nested, else-heavy
const price = (user) => {
  if (user) {
    if (user.active) {
      return user.plan.price;
    } else {
      return 0;
    }
  } else {
    return 0;
  }
};

// Good — guard clauses, flat
const price = (user) => {
  if (!user) return 0;
  if (!user.active) return 0;
  return user.plan.price;
};
```

Rule: no `else` / `else if` after a `return`.

## Lookup tables over chained conditionals

```ts
// Bad
const getDiscount = (type) => {
  if (type === "student") return 0.1;
  else if (type === "senior") return 0.15;
  else if (type === "employee") return 0.2;
  else return 0;
};

// Good
const getDiscount = (type) => {
  const discounts = { student: 0.1, senior: 0.15, employee: 0.2 };
  return discounts[type] ?? 0;
};
```

For an exhaustive **typed** union where every case must be handled, prefer an exhaustive `switch` — see `ct-typescript-conventions`.

## Ternaries — one level, never nested

A ternary must not contain another ternary. Nesting → extract a lookup table or guard clauses.

```ts
// Bad — nested ternary
const label = a ? "x" : b ? "y" : "z";

// Good — lookup or guards
const labels = { a: "x", b: "y" };
const label = labels[key] ?? "z";
```

## Destructuring — use it fully

```ts
const { id, name: title, role = "guest", address: { city } = {}, ...rest } = user;
//       basic  rename        default         nested (+ default)        rest
const greet = ({ name, lang = "en" }) => `${GREETING[lang]} ${name}`; // in params
```

**⚠️ Never destructure reactive framework props.** In SolidJS, `const { value } = props` breaks reactivity — read `props.value` at the point of use. This carve-out is authoritative: see `ct-solidjs-patterns`. Destructuring is for plain data objects.

## Functions — arrow-only, no `class`, no `this`

Model behavior as functions and closures over state. No `class`, no `this` in your own code.

```ts
// Bad — class + this
class Counter {
  count = 0;
  inc() {
    this.count++;
  }
}

// Good — closure
const makeCounter = () => {
  let count = 0;
  return { inc: () => ++count, value: () => count };
};
```

**⚠️ Exception:** use `class` / `this` only when a third-party lib or platform leaves no functional alternative — e.g. Cloudflare Durable Objects / `WorkerEntrypoint` (`export class extends DurableObject`), or subclassing built-ins (`class AppError extends Error`). See `ct-cloudflare`, `ct-durable-objects`.

## No magic numbers or strings

Name every literal that carries meaning. User-facing text → i18n keys, never inline strings.

```ts
// Bad
if (retries > 3) show("Trop de tentatives");

// Good
const MAX_RETRIES = 3;
if (retries > MAX_RETRIES) show(LL.errors.tooManyRetries()); // i18n key, not a literal
```

User-facing strings belong in the locale layer — see `ct-i18n-typesafe`.

## Anti-Patterns

| Bad | Good |
| --- | --- |
| `else` after a `return` | guard clauses |
| `if/else if` chain on a value | object lookup table + `??` |
| nested ternary | lookup table or guards |
| `class` + `this` for your own logic | arrow functions + closures |
| destructuring SolidJS `props` | read `props.x` (see `ct-solidjs-patterns`) |
| magic number / inline UI string | named const / i18n key |

## See Also

- `ct-typescript-conventions` — exhaustive `switch` for typed unions; typing destructured params.
- `ct-esnext-idioms` — modern features these patterns pair with (`??`, `Object.groupBy`).
- `ct-solidjs-patterns` — props are reactive; do not destructure them.
- `ct-i18n-typesafe` — where user-facing strings live.
