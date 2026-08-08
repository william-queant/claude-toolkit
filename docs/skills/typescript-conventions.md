# TypeScript Conventions

> Strict TypeScript patterns and compiler selection — prefer the TypeScript 7 native compiler when a project ships it. Use when writing or reviewing TypeScript, running a typecheck, adding or tightening types, or deciding between type and interface

**Type:** Core Skill (always included)
**Source:** [`core/skills/ct-typescript-conventions/SKILL.md`](../core/skills/ct-typescript-conventions/SKILL.md)

## Overview

Rules for writing TypeScript that leverages the type system fully. These assume strict mode is enabled and prioritize catching errors at compile time over runtime.

The skill also covers **which compiler to run**. TypeScript 7 — the Go-native port — reached GA on 2026-07-08 as `typescript@7.0.2`, with Microsoft reporting 8x–12x faster full builds. The guidance is availability-aware in the same spirit as [ct-esnext-idioms](../stacks/esnext-idioms.md): prefer TS7 where a project already has it, fall back cleanly where it doesn't, and never upgrade a project unprompted.

## Compiler Selection

### Detect before you assume

Read the **installed** version, resolved from the directory being edited (monorepo workspaces can pin different majors):

```bash
node -p "require('typescript/package.json').version"   # major >= 7 -> TS7
```

`typescript@7.0.2` whitelists `./package.json` in its `exports` map, and 5.x/6.x have no `exports` map at all, so this subpath resolves on every major.

Three detection traps:

| Trap | Why it misleads |
|---|---|
| Looking for a `tsgo` binary | TS7's only CLI binary is `tsc`. `tsgo` belonged to the pre-GA `@typescript/native-preview` package, which is frozen at a `7.0.0-dev` nightly. |
| Reading the `package.json` semver range | `overrides`, `resolutions`, pnpm/bun catalogs and stale lockfiles all override it — and `*`, `latest`, `>=5` all resolve to 7.x today. |
| Probing the API (`ts.createProgram`) | On TS7 `require("typescript")` exposes only `version` and `versionMajorMinor`, so an API probe reports a false negative. |

### When TS7 is available

Flags are unchanged from 6.x — `tsc --noEmit`, `tsc -p <path>`, `tsc -b`, `tsc --watch`. New in TS7:

| Flag | Meaning |
|---|---|
| `--checkers <n>` | Type-checking workers per project (default 4). Microsoft warns that varying it "may surface order-dependent results" — pin it in CI. |
| `--builders <n>` | Projects built concurrently in build mode (default 4). |
| `--singleThreaded` | Most deterministic setting. |
| `--lsp` | Language server over LSP (there is no `tsserver` binary). |

Note that watch mode is labelled a prototype at the GA tag: it rebuilds but does not incrementally recheck.

### When a tool embeds the compiler — do not switch

TypeScript 7.0 ships **no stable programmatic API**; Microsoft targets 7.1 for "a new (and different) API" with no committed date. Anything that embeds the compiler is blocked:

| Tool | Status on TS7 |
|---|---|
| `typescript-eslint` | Peer range `<6.1.0`; install fails `ERESOLVE`, and a forced install crashes during lint |
| `vue-tsc`, `svelte-check`, `@astrojs/check` | Crash on `ERR_PACKAGE_PATH_NOT_EXPORTED` — TS7 has no `./lib/*` export |
| `ts-node` | Crashes in config load |
| `ts-jest` | Peer range `>=4.3 <7` |
| `@angular/compiler-cli` | Peer range `>=6.0 <6.1` (Microsoft suggests a hybrid: TS7 at the CLI, TS6 for editor support) |

Unaffected — these carry no `typescript` dependency at all: Vite, Bun, `tsx`, Vitest, Jest, Biome.

**A type-check smoke test will not catch these failures.** typescript-eslint's breakage surfaces at `npm ci` and at lint time while `tsc --noEmit` still passes. When a blocked tool is present, install both compilers side by side rather than downgrading — this is Microsoft's documented escape hatch:

```json
{
  "devDependencies": {
    "@typescript/native": "npm:typescript@^7.0.2",
    "typescript": "npm:@typescript/typescript6@^6.0.2"
  }
}
```

The `typescript` key must stay pointed at the 6.0 compatibility package, because blocked tools import from `typescript` by peer dependency.

### When TS7 is absent

The floor is `typescript@6.0.3` — the last 6.x release, and the bridge Microsoft designates between 5.9 and 7.0. It also sits inside every current ecosystem peer range. The readiness gate before moving a project to 7 is a clean 6.0 build with `"stableTypeOrdering": true` and no `ignoreDeprecations` set. That flag is a diagnostic aid only — Microsoft notes it can add up to 25% to type-checking time and is not meant to be left on.

### `tsconfig.json` under TS7

These are rejected outright, and `ignoreDeprecations` no longer silences them (in 6.0 they were silenceable errors; in 7.0 there is no escape hatch):

| Rejected | Replacement |
|---|---|
| `baseUrl` | project-root-relative `paths` |
| `outFile`, `downlevelIteration` | remove |
| `target: "es5"` | `"es2015"` or later |
| `module: "amd" \| "umd" \| "system" \| "none" \| "systemjs"` | `"esnext"`, `"preserve"`, or `"nodenext"` |
| `moduleResolution: "node" \| "node10" \| "classic"` | `"bundler"`, `"node16"`, or `"nodenext"` |
| `esModuleInterop` / `allowSyntheticDefaultImports` / `alwaysStrict` set to `false` | drop the override |

These are gone entirely — `TS5023: Unknown compiler option`: `out`, `charset`, `keyofStringsOnly`, `suppressImplicitAnyIndexErrors`, `noImplicitUseStrict`, `importsNotUsedAsValues`, `preserveValueImports`, `suppressExcessPropertyErrors`, `noStrictGenericChecks`.

Two changed defaults account for most real-world breakage:

- **`types` defaults to `[]`.** Ambient globals like `process` vanish with `TS2591`. Set it explicitly: `"types": ["node"]`, or `["bun"]` for Bun projects.
- **`rootDir` defaults to `./`.** With sources under `src/` and an `outDir`, emit fails `TS5011`. Set `"rootDir": "./src"`. This fires **only when the program emits** — `tsc --noEmit` stays silent, so a type-check-only CI job can stay green while the build breaks.

`strict` defaults to `true`, and `stableTypeOrdering` is on and cannot be turned off. `experimentalDecorators` and `emitDecoratorMetadata` both survive.

Project references, `--build` mode, incremental builds, declaration emit, and CommonJS emit all work.

> Reference note: `typescriptlang.org/tsconfig` has not been updated for TS7 and still documents removed options, and there is no TS 7.0 handbook release-notes page. The [GA announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) is the authoritative what's-new source.

## Key Patterns

### Strict Mode

Enable all strict checks in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

Never disable strict checks for convenience.

### No `any`

Never use `any`. It disables type checking entirely.

- Use `unknown` when the type is genuinely not known, then narrow before use
- Use generics when the type varies but has a consistent shape
- Use specific types when you know the data shape

### Type vs Interface

- **Default to `type`.** It covers object shapes, unions, intersections, mapped types, and utility types.
- **Use `interface` only when you need `extends`** (an inheritance hierarchy or declaration merging).

```typescript
// Default: use type for object shapes
type User = {
  id: string;
  email: string;
  role: UserRole;
};

// Unions, intersections, utilities: type
type UserRole = "admin" | "member" | "guest";

// interface only when you need extends
interface Animal {
  name: string;
}
interface Dog extends Animal {
  breed: string;
}
```

### `as const` for Literal Types

Use `as const` to narrow literal values and create readonly tuples:

```typescript
const ROLES = ["admin", "member", "guest"] as const;
type Role = (typeof ROLES)[number]; // "admin" | "member" | "guest"
```

### Exhaustive Switch with `never`

Handle every case in a switch and use `never` to catch missing branches at compile time:

```typescript
function getPermissions(role: UserRole): string[] {
  switch (role) {
    case "admin":
      return ["read", "write", "delete"];
    case "member":
      return ["read", "write"];
    case "guest":
      return ["read"];
    default: {
      const _exhaustive: never = role;
      throw new Error(`Unhandled role: ${_exhaustive}`);
    }
  }
}
```

### Discriminated Unions for State Modeling

Model states with different associated data as discriminated unions to make illegal states unrepresentable:

```typescript
type AsyncState<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };
```

### `satisfies` Operator

Validate a value conforms to a type while keeping the value's own narrower inferred type instead of collapsing to the annotation. Here it preserves the exact key set (`home`, `user`) rather than the index signature `Record<string, Route>`:

```typescript
type Route = { path: string; children?: Route[] };

const routes = {
  home: { path: "/" },
  user: { path: "/user/:id", children: [{ path: "settings" }] },
} satisfies Record<string, Route>;

// routes.home and routes.user are known keys -- not `Route | undefined` from the index signature.
// Note: routes.home.path is `string`, NOT the literal "/", because `Route` declares `path: string`,
// which widens the literal. To keep a literal, target a narrower type (e.g. a union) or add `as const`.
```

### `const` Type Parameters

Infer literal types from arguments without requiring callers to write `as const`:

```typescript
function createConfig<const T extends readonly string[]>(names: T): Record<T[number], boolean> {
  // `Object.fromEntries` is typed to return a wide `Record<string, boolean>`, so a single
  // localized `as` at a generic helper's return boundary is acceptable here -- it keeps the
  // public signature precise. This is the narrow exception to the "no `as` casts" anti-pattern.
  return Object.fromEntries(names.map(n => [n, false])) as Record<T[number], boolean>;
}

// result: Record<"debug" | "verbose", boolean>
const flags = createConfig(["debug", "verbose"]);
```

### Template Literal Types

Build precise string types from unions:

```typescript
type EventName = "click" | "focus" | "blur";
type Handler = `on${Capitalize<EventName>}`; // "onClick" | "onFocus" | "onBlur"

type Locale = "en" | "fr" | "ja";
type Currency = "USD" | "EUR" | "JPY";
type PriceKey = `price:${Locale}:${Currency}`; // 9 valid combinations
```

### Generic Constraints

Use `extends` to constrain generics, documenting expectations and catching misuse:

```typescript
function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find((item) => item.id === id);
}
```

## Anti-patterns

| Anti-pattern | Description |
|---|---|
| **Type assertions (`as`)** | Tells the compiler "trust me" -- use type guards and narrowing instead. |
| **Non-null assertion (`!`)** | Suppresses null checks. Handle the null case explicitly. |
| **Enum overuse** | Prefer string literal unions. Enums generate runtime code and have surprising behavior. |
| **`Object`, `Function`, `{}`** | Almost never what you want. Use specific interfaces or function signatures. |
| **`@ts-ignore`** | Suppressing errors without tracking means the error will be forgotten. |

## Best Practices Reference

For deeper guidance on the patterns referenced above (sourced from Matt Pocock / Total TypeScript):

| Topic | Guide |
|---|---|
| Default to `type`, use `interface` for `extends` | [Type vs Interface](../best-practices/typescript/type-vs-interface.md) |
| Why enums are problematic, `as const` alternative | [Enums & Alternatives](../best-practices/typescript/enums-alternatives.md) |
| When `any` is acceptable (two exceptions) | [any & unknown](../best-practices/typescript/any-and-unknown.md) |
| State modeling with discriminated unions | [Discriminated Unions](../best-practices/typescript/discriminated-unions.md) |
| Three patterns for generics | [Generics Patterns](../best-practices/typescript/generics-patterns.md) |
| Recommended `tsconfig.json` settings | [TSConfig Cheat Sheet](../best-practices/typescript/tsconfig-cheat-sheet.md) |
| Branded types, assertion functions, type predicates | [Essential Patterns](../best-practices/typescript/essential-patterns.md) |

See the full collection: [TypeScript Best Practices](../best-practices/typescript/README.md)

## Trigger Conditions

- **Keywords:** `typescript`, `type`, `interface`, `generic`
- **File patterns:** `**/*.d.ts`, `**/types/**`
- **Intent patterns:** "define/create type/interface"
