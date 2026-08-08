---
name: ct-typescript-conventions
description: Strict TypeScript patterns and compiler selection -- prefer the TypeScript 7 native compiler when a project ships it. Use when writing or reviewing TypeScript, running a typecheck, adding or tightening types, or deciding between type and interface
---

# TypeScript Conventions

Strict mode enabled. Catch errors at compile time, not runtime.

## Compiler -- prefer TypeScript 7 when the project has it

TypeScript 7 (GA 2026-07-08, `typescript@7.0.2`) is the Go-native compiler; Microsoft reports **8x--12x faster full builds**. In a project that already ships it, use it for every type-check and build. Never install or bump it unprompted.

**Detect the installed version, not the declared range:**

```bash
node -p "require('typescript/package.json').version"   # major >= 7 -> TS7
```

Resolve from the directory you are editing -- monorepo workspaces can pin different majors. Three traps:

- The TS7 binary is **`tsc`**. `tsgo` was the pre-GA `@typescript/native-preview` name -- never put it in a script.
- `package.json` ranges lie: `overrides`, `resolutions`, catalogs, and stale lockfiles all win, and `*` / `latest` / `>=5` resolve to 7.x today.
- Don't probe the API -- on TS7 `require("typescript")` exposes only `version` and `versionMajorMinor`, so a `ts.createProgram` check gives a false negative.

**Using it** -- same flags as 6.x:

```bash
tsc --noEmit                  # type-check
tsc -b                        # build mode / project references
tsc --checkers 1 --noEmit     # CI: pin the worker count
```

`--checkers` defaults to 4. Pin it in CI -- Microsoft warns that varying it can surface order-dependent results.

**Stay on 6.x when a tool embeds the compiler.** TS7.0 ships no stable programmatic API (7.1 targets a new one), so `typescript-eslint`, `ts-jest`, `ts-node`, `vue-tsc`, `svelte-check`, `@astrojs/check`, and `@angular/compiler-cli` all break -- at install or lint time, *not* at `tsc --noEmit`. A green type-check proves nothing here. Vite, Bun, `tsx`, Vitest, and Biome are unaffected. Run both rather than downgrading:

```json
{
  "devDependencies": {
    "@typescript/native": "npm:typescript@^7.0.2",
    "typescript": "npm:@typescript/typescript6@^6.0.2"
  }
}
```

Keep `typescript` pointed at the 6.0 package -- blocked tools import it by peer dependency. Where TS7 is absent, the floor is `typescript@6.0.3`, the bridge release; its readiness gate is a clean build with `"stableTypeOrdering": true` and no `ignoreDeprecations`.

**`tsconfig.json` rules TS7 enforces** -- `ignoreDeprecations` no longer silences any of them:

| Now rejected | Fix |
|---|---|
| `baseUrl` | project-root-relative `paths` |
| `outFile`, `downlevelIteration` | remove |
| `target: "es5"` | `"es2015"` or later |
| `module: "amd" \| "umd" \| "system" \| "none" \| "systemjs"` | `"esnext"`, `"preserve"`, or `"nodenext"` |
| `moduleResolution: "node" \| "node10" \| "classic"` | `"bundler"`, `"node16"`, or `"nodenext"` |
| `esModuleInterop` / `allowSyntheticDefaultImports` / `alwaysStrict` set to `false` | drop the override |
| `out`, `charset`, `keyofStringsOnly`, `importsNotUsedAsValues`, `preserveValueImports`, `suppressImplicitAnyIndexErrors`, `suppressExcessPropertyErrors`, `noStrictGenericChecks`, `noImplicitUseStrict` | gone -- `TS5023: Unknown compiler option` |

Two changed defaults cause most real-world breakage. Both arrived in 6.0 and carry forward, so they bite on either major -- verified identical on 6.0.3 and 7.0.2:

- **`types` defaults to `[]`** -- `process`, `Bun` and friends disappear (`TS2591`) *even with `@types/node` installed*. Set `"types": ["node"]` / `["bun"]` explicitly, naming only packages that are actually installed (a missing one is `TS2688`). `"types": ["*"]` restores the old catch-all on 6.x/7.x but is itself `TS2688` on 5.x.
- **`rootDir` defaults to `./`** -- with sources in `src/` and an `outDir`, emit fails `TS5011`. Set `"rootDir": "./src"`. `--noEmit` does *not* surface this, so type-check CI stays green while the build breaks.

`strict` and `stableTypeOrdering` are on by default; `stableTypeOrdering` cannot be turned off.

## Rules

- **No `any`** -- Use `unknown` + narrowing, generics, or specific types.
- **Default to `type`.** Use `interface` only when you need `extends` (object inheritance). `type` aliases have an implicit index signature, so they stay assignable to `Record<string, unknown>`; interfaces do not.
- **`as const`** for literal types and readonly tuples.
- **Never disable strict checks.** Hard-to-type code = design issue.

## Exhaustive Switch

```typescript
function getPerms(role: UserRole): string[] {
  switch (role) {
    case "admin": return ["read", "write", "delete"];
    case "member": return ["read", "write"];
    case "guest": return ["read"];
    default: { const _: never = role; throw new Error(`Unhandled: ${_}`); }
  }
}
```

Adding a new `UserRole` value causes a compile error at `never`, forcing handling.

## Discriminated Unions

Model states with different data as unions. Narrowing on the discriminant gives type-safe access.

```typescript
type AsyncState<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };
```

## `satisfies` Operator

Validate a value conforms to a type while keeping the *narrowest inferred type* per property, instead of widening every property to the target's value type (as an explicit annotation would). Against a union-typed target, the matching literal is preserved.

```typescript
const config = {
  mode: "production",
  level: 3,
} satisfies { mode: "development" | "production"; level: number };

// config.mode is the literal "production" (not widened to string),
// because the target property is a union of literals. A plain
// annotation `const config: {...}` would widen it to the full union.
```

Note: `satisfies` does not by itself narrow to literals against a _wide_ target -- e.g. `satisfies Record<string, string>` still infers `string` for each value, and `satisfies Record<string, { path: string }>` leaves each `path` as `string`. Combine with `as const` when you need literals preserved against a `string`-typed target.

## `const` Type Parameters

Infer literal types from arguments without requiring callers to write `as const`:

```typescript
function createConfig<const T extends readonly string[]>(names: T): Record<T[number], boolean> {
  return Object.fromEntries(names.map(n => [n, false])) as Record<T[number], boolean>;
}

// result type: Record<"debug" | "verbose", boolean> -- not Record<string, boolean>
const flags = createConfig(["debug", "verbose"]);
```

The `as Record<T[number], boolean>` above is the narrow exception to anti-pattern #1: `Object.fromEntries` is typed to return a wide `Record<string, boolean>`, so a localized cast _at a generic helper's return_ -- where the signature already proves the tighter type -- is acceptable. Reach for type guards everywhere else.

## Template Literal Types

Build precise string types from unions:

```typescript
type EventName = "click" | "focus" | "blur";
type Handler = `on${Capitalize<EventName>}`; // "onClick" | "onFocus" | "onBlur"

type Locale = "en" | "fr" | "ja";
type Currency = "USD" | "EUR" | "JPY";
type PriceKey = `price:${Locale}:${Currency}`; // 9 valid combinations
```

## Generic Constraints

```typescript
function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}
```

## Anti-Patterns

1. **`as` casts** -- Use type guards and narrowing instead.
2. **Non-null assertion `!`** -- Handle the null case explicitly.
3. **Enums** -- Prefer string literal unions. Enums generate runtime code with surprising behavior.
4. **`Object`, `Function`, `{}`** -- Use specific interfaces or `Record<string, unknown>`.
5. **`@ts-ignore`** -- Without an explanatory comment and tracking issue, the error will be forgotten.
