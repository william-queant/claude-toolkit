# Type vs Interface

> Source: [Type vs Interface: Which Should You Use?](https://www.totaltypescript.com/type-vs-interface-which-should-you-use) — Matt Pocock

## The Verdict

**Default to `type`. Use `interface` only when you need `extends`.**

This contradicts the official TypeScript team guidance (which defaults to `interface`), but Matt argues the tradeoffs favor `type` for most codebases.

## Why Default to `type`

### 1. Flexibility

Type aliases can express unions, mapped types, and conditional types. Interfaces cannot.

```typescript
// Only possible with type
type Result = Success | Failure;
type Mapped = { [K in keyof T]: boolean };
type Conditional = T extends string ? "yes" : "no";
```

### 2. Declaration Merging is Dangerous

If you accidentally declare the same interface name twice in the same scope, TypeScript silently merges them — no error, no warning. You end up with a type that has extra properties you never intended.

```typescript
interface User {
  name: string;
}

interface User {
  age: number;
}

// User is now { name: string; age: number } — silently merged
```

With `type`, a duplicate name throws a compile error immediately.

### 3. Implicit Index Signature

Type aliases have an implicit index signature, making them assignable to `Record<PropertyKey, unknown>`. Interfaces do not, which causes unexpected errors when passing interface-typed objects to functions expecting `Record` types.

## When to Use `interface`

Use `interface` specifically for **object inheritance** with `extends`:

```typescript
interface Animal {
  name: string;
}

interface Dog extends Animal {
  breed: string;
}
```

**Why?** `extends` makes TypeScript's type checker run slightly faster than `&` intersections. TypeScript caches interface relationships in an internal registry, optimizing repeated type checks.

```typescript
// Prefer this (faster)
interface Dog extends Animal {
  breed: string;
}

// Over this (slower)
type Dog = Animal & {
  breed: string;
};
```

## Summary

| Scenario | Use |
|---|---|
| Object shapes (no inheritance) | `type` |
| Unions, mapped types, conditionals | `type` |
| Object inheritance | `interface` with `extends` |
