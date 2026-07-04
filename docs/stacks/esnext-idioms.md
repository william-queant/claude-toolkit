# ESNext Idioms

> Modern ECMAScript runtime idioms — Temporal, iterator helpers, `using`, structuredClone.

**Type:** Stack Skill (requires `esnext` stack)
**Source:** [`stacks/esnext/skills/ct-esnext-idioms/SKILL.md`](../../stacks/esnext/skills/ct-esnext-idioms/SKILL.md)
**Detected by:** tsconfig `target`/`module`/`lib` = `ESNext`/`ES2022+`, package.json `"type":"module"`, `engines.node >= 20`, or a `.mjs` file
**File Extensions:** `.mjs`, `.cjs`

## Overview

Guidance for preferring current ECMAScript **runtime features** over legacy patterns and hand-rolled polyfills. It is availability-aware: each newer feature notes the runtime/polyfill it needs, so the recommendation never generates code the target can't run. Types are covered by `ct-typescript-conventions`; general code structure by `ct-code-style`.

## Topics

- **Dates → `Temporal`** — immutable, timezone-correct calendar/clock math (polyfill until baseline).
- **Resource management → `using` / `await using`** — deterministic cleanup via `Symbol.dispose`/`asyncDispose`.
- **Iterator helpers** — lazy `map`/`filter`/`take`, `Iterator.concat`, `Array.fromAsync`.
- **Clone & group** — `structuredClone`, `Object.groupBy` / `Map.groupBy`.
- **Async ergonomics** — `Promise.withResolvers`, `AbortSignal.timeout`/`any`, top-level await.
- **Immutable array ops** — `at`, `findLast`, `toSorted`/`toReversed`/`with`.
- **Errors** — `Error({ cause })`, `AggregateError`.
- **ESM hygiene** — `import.meta.dirname` over `__dirname`, dynamic `import()`.

See the [skill source](../../stacks/esnext/skills/ct-esnext-idioms/SKILL.md) for the full patterns, availability notes, and anti-patterns table.
