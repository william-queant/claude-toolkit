---
name: ct-esnext-idioms
description: Modern ECMAScript runtime idioms — Temporal, iterator helpers, using, structuredClone
---

# Modern ESNext Idioms

Prefer current ECMAScript runtime features over legacy patterns and hand-rolled polyfills. Types live in `ct-typescript-conventions`; code structure lives in `ct-code-style`; this skill is about *runtime features*.

> Some features below are newer than the Node/browser baseline. Each is tagged with what it needs. When a target can't guarantee it, use the noted polyfill/flag rather than dropping back to the legacy pattern.

## Dates & time → `Temporal`

`Date` is mutable, timezone-naive, and error-prone for math. Use `Temporal` for calendar/clock work.

```ts
const today = Temporal.Now.plainDateISO();               // no time, no tz confusion
const due = today.add({ days: 30 });                     // immutable — returns a new value
const start = Temporal.ZonedDateTime.from("2026-07-04T09:00[Europe/Paris]");
const mins = start.until(Temporal.Now.zonedDateTimeISO()).total("minutes");
```

_Availability: Stage 3 — not yet baseline in Node. Add `temporal-polyfill` (or `@js-temporal/polyfill`) until it ships._ Avoid `Date` mutation, manual `getTime()` ms math, and moment.js.

## Deterministic cleanup → `using` / `await using`

`Symbol.dispose` / `Symbol.asyncDispose` free resources when scope exits — no `try/finally` ladder.

```ts
const openFile = (path: string) => {
  const handle = fs.openSync(path, "r");
  return { handle, [Symbol.dispose]: () => fs.closeSync(handle) };
};

const readHead = (path: string) => {
  using file = openFile(path);       // closed automatically at end of block
  return fs.readSync(file.handle, Buffer.alloc(16), 0, 16, 0);
};                                    // ← dispose runs here, even on throw
```

`await using` awaits `Symbol.asyncDispose` (db connections, locks, spans). _Availability: TS 5.2+ (downlevels) or Node 24+._

## Iterator helpers → lazy, no intermediate arrays

```ts
const firstThree = users.values()
  .filter((u) => u.active)
  .map((u) => u.name)
  .take(3)
  .toArray();                        // only 3 names ever materialised

const merged = Iterator.concat(pageA.values(), pageB.values());
const rows = await Array.fromAsync(streamRows());   // async iterable → array
```

_Availability: Node 22+ / modern browsers._ Replaces `[...a, ...b].filter().map().slice()`, which allocates at every step.

## Clone & group

```ts
const copy = structuredClone(state);                 // deep clone — Map/Set/Date/typed arrays
const byRole = Object.groupBy(users, (u) => u.role); // { admin: [...], guest: [...] }
const byId = Map.groupBy(users, (u) => u.id);        // Map keys (any type)
```

Avoid `JSON.parse(JSON.stringify(x))` (drops `undefined`, turns `Date` into a string, throws on cycles) and manual `reduce` grouping.

## Promise & async ergonomics

```ts
const { promise, resolve, reject } = Promise.withResolvers<Data>();   // no deferred-hack closure
const res = await fetch(url, { signal: AbortSignal.timeout(5_000) }); // auto-abort
const signal = AbortSignal.any([userAbort, AbortSignal.timeout(30_000)]);
```

Top-level `await` is available in ESM modules — no IIFE wrapper.

## Immutable array ops

```ts
const last = items.at(-1);                           // negative index
const newest = orders.findLast((o) => o.settled);
const sorted = scores.toSorted((a, b) => b - a);     // non-mutating; also toReversed/toSpliced/with
const patched = row.with(2, "x");                    // copy with index 2 replaced
```

## Errors with cause

```ts
try {
  await save();
} catch (err) {
  throw new Error("Checkout failed", { cause: err }); // preserve the chain
}
throw new AggregateError(errors, "Some uploads failed"); // aggregate independent failures
```

## ESM hygiene

```ts
const here = import.meta.dirname;          // replaces __dirname (Node 20.11+/21.2+)
const url = import.meta.url;
const mod = await import("./plugin.js");    // dynamic import, not require()
```

## Performance

> _Verified against ECMAScript 2024 / Node 22 (2026-07)._

- **Iterator helpers are lazy** — `take(3)` stops the pipeline after 3 items; the array form processes everything first. Use them for early-exit and large/infinite sequences.
- **`structuredClone` is a native deep copy** — faster and more correct than `JSON.parse(JSON.stringify())`, with no string round-trip.
- **`AbortSignal.timeout`** removes `setTimeout` bookkeeping and leaks; the runtime clears the timer when the signal settles.

## Anti-Patterns

| Legacy | Modern |
| --- | --- |
| `new Date()` math / moment.js | `Temporal` (via polyfill) |
| `try { } finally { close() }` | `using` / `await using` |
| `[...a, ...b].filter().map().slice()` | iterator helpers + `Iterator.concat` |
| `JSON.parse(JSON.stringify(x))` | `structuredClone(x)` |
| manual `reduce` grouping | `Object.groupBy` / `Map.groupBy` |
| deferred `let resolve; new Promise(...)` | `Promise.withResolvers()` |
| `arr[arr.length - 1]` | `arr.at(-1)` |
| `__dirname` / `require()` | `import.meta.dirname` / `import()` |

## See Also

- `ct-typescript-conventions` — typing these values (`satisfies`, discriminated unions for async state).
- `ct-code-style` — structure around these features (guard clauses, no magic numbers, `??`).
