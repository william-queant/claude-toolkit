# TypeScript Conventions

> Strict TypeScript patterns for type safety, readability, and maintainable codebases. Use when writing or reviewing TypeScript, adding or tightening types, or deciding between type and interface

**Type:** Core Skill (always included)
**Source:** [`core/skills/ct-typescript-conventions/SKILL.md`](../core/skills/ct-typescript-conventions/SKILL.md)

## Overview

Rules for writing TypeScript that leverages the type system fully. These assume strict mode is enabled and prioritize catching errors at compile time over runtime.

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
