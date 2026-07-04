---
name: ct-typescript-conventions
description: Strict TypeScript patterns for type safety, readability, and maintainable codebases. Use when writing or reviewing TypeScript, adding or tightening types, or deciding between type and interface
---

# TypeScript Conventions

Strict mode enabled. Catch errors at compile time, not runtime.

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
