# Code Style

> Code structure & style: guard clauses, lookup tables, destructuring, no classes, no magic values.

**Type:** Core Skill (always included)
**Source:** [`core/skills/ct-code-style/SKILL.md`](../../core/skills/ct-code-style/SKILL.md)

## Overview

Universal, target-independent conventions for writing small, flat, data-driven functions. Always active — no stack required. It complements `ct-typescript-conventions` (types) and `ct-esnext-idioms` (modern features). Stack skills win where they overlap.

## Rules

- **Guard clauses / early returns** — no `else`/`else if` after a `return`.
- **Lookup tables** over `if/else if` chains keyed on a value (`discounts[type] ?? 0`).
- **Ternaries** — one level, never nested.
- **Full ES6 destructuring** — basic, renaming, defaults, nested, rest, in parameters.
- **Arrow-only, no `class`, no `this`** — model behavior as functions + closures.
- **No magic numbers/strings** — named constants; user-facing text → i18n keys.

## Carve-outs (stack skills win)

- **SolidJS props:** never destructure reactive `props` — it breaks reactivity. See [`ct-solidjs-patterns`](../best-practices/solidjs/props-patterns.md).
- **Platform classes:** `class`/`this` only where a third-party lib/platform requires it (Cloudflare Durable Objects, `class X extends Error`).

Three of these rules are additionally enforced by Biome in the scaffolded `biome.json` (`noUselessElse`, `noNestedTernary`, `useArrowFunction`). "No magic numbers" stays guidance-only — it is too noisy to enforce mechanically.
