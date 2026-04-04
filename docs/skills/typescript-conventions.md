# TypeScript Conventions

> Strict TypeScript patterns for type safety, readability, and maintainable codebases.

**Type:** Core Skill (always included)
**Source:** [`core/skills/typescript-conventions/SKILL.md`](../core/skills/typescript-conventions/SKILL.md)

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

### Interface vs Type

- **Prefer `interface`** for object shapes -- extendable, clearer error messages
- **Use `type`** for unions, intersections, mapped types, and utility types

```typescript
// Object shape: use interface
interface User {
  id: string;
  email: string;
  role: UserRole;
}

// Union: use type
type UserRole = "admin" | "member" | "guest";
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

## Trigger Conditions

- **Keywords:** `typescript`, `type`, `interface`, `generic`
- **File patterns:** `**/*.d.ts`, `**/types/**`
- **Intent patterns:** "define/create type/interface"
