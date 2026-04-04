---
name: ct-typescript-conventions
description: Strict TypeScript patterns for type safety, readability, and maintainable codebases.
---

# TypeScript Conventions

Strict mode enabled. Catch errors at compile time, not runtime.

## Rules

- **No `any`** -- Use `unknown` + narrowing, generics, or specific types.
- **`interface` for objects**, `type` for unions/intersections/utilities.
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
