---
name: TypeScript Conventions
description: Strict TypeScript patterns for type safety, readability, and maintainable codebases.
---

# TypeScript Conventions

Rules for writing TypeScript that leverages the type system fully. These assume strict mode is enabled and prioritize catching errors at compile time over runtime.

## Strict Mode

Enable all strict checks in `tsconfig.json`. At minimum:

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

Never disable strict checks for convenience. If the types are hard to write, that is a signal the code design needs improvement.

## No `any`

Never use `any`. It disables type checking and defeats the purpose of TypeScript.

- **Use `unknown`** when the type is genuinely not known. Then narrow it before use.
- **Use generics** when the type varies but has a consistent shape.
- **Use specific types** when you know what the data looks like. If you receive JSON from an API, define an interface for the response.

```typescript
// Bad
function parse(data: any) { return data.name; }

// Good
function parse(data: unknown): string {
  if (typeof data === "object" && data !== null && "name" in data) {
    return String((data as { name: unknown }).name);
  }
  throw new Error("Invalid data");
}
```

## Interface vs Type

- **Prefer `interface`** for object shapes. Interfaces are extendable, produce clearer error messages, and are the idiomatic choice for object types.
- **Use `type`** for unions, intersections, mapped types, and utility types -- things interfaces cannot express.

```typescript
// Object shape: use interface
interface User {
  id: string;
  email: string;
  role: UserRole;
}

// Union: use type
type UserRole = "admin" | "member" | "guest";

// Intersection or utility: use type
type UserWithPosts = User & { posts: Post[] };
```

## `as const` for Literal Types

Use `as const` to narrow literal values and create readonly tuples. This eliminates magic strings and enables exhaustive checking.

```typescript
const ROLES = ["admin", "member", "guest"] as const;
type Role = (typeof ROLES)[number]; // "admin" | "member" | "guest"

const CONFIG = {
  maxRetries: 3,
  timeout: 5000,
} as const;
```

## Exhaustive Switch with `never`

When switching on a discriminated union or string literal type, handle every case and use `never` to catch missing branches at compile time.

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

Adding a new value to `UserRole` will cause a compile error at the `never` assignment, forcing you to handle it.

## Discriminated Unions for State Modeling

Model states that have different associated data as discriminated unions. This makes illegal states unrepresentable.

```typescript
interface LoadingState {
  status: "loading";
}

interface SuccessState<T> {
  status: "success";
  data: T;
}

interface ErrorState {
  status: "error";
  error: Error;
}

type AsyncState<T> = LoadingState | SuccessState<T> | ErrorState;
```

Narrowing on the discriminant (`status`) gives type-safe access to the associated data without any casts.

## Generic Constraints

Use `extends` to constrain generics. This documents expectations and catches misuse at call sites.

```typescript
// Constrain to objects with an id
function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find((item) => item.id === id);
}

// Constrain to known keys
function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    result[key] = obj[key];
  }
  return result;
}
```

## Anti-patterns

- **Type assertions (`as`).** Avoid `as` casts. They tell the compiler "trust me" -- and you might be wrong. Use type guards and narrowing instead.
- **Non-null assertion (`!`).** `value!` suppresses null checks. If a value might be null, handle the null case explicitly. The `!` operator hides bugs.
- **Enum overuse.** Prefer string literal unions over enums. Enums generate runtime code, have surprising behavior with reverse mappings, and are harder to tree-shake.
- **`Object`, `Function`, `{}` types.** These are almost never what you want. Use specific interfaces, function signatures, or `Record<string, unknown>`.
- **Ignoring type errors.** Suppressing errors with `@ts-ignore` or `@ts-expect-error` without an explanatory comment and a tracking issue means the error will be forgotten.
