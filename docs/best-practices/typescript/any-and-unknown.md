# `any` & `unknown`

> Source: [any Considered Harmful, Except For These Cases](https://www.totaltypescript.com/any-considered-harmful) — Matt Pocock

## The Rule

**Ban `any` from your codebase.** Enable the ESLint rule that prevents its use and avoid it wherever possible.

`any` disables TypeScript's core value proposition: type checking, autocomplete, and safety guarantees. It's a contagion — once `any` enters an expression, it spreads through assignments and return values.

## What to Use Instead

| Situation | Use |
|---|---|
| Type is genuinely unknown | `unknown` (then narrow before use) |
| Type varies but has a consistent shape | Generics with constraints |
| You know the data shape | The specific type |

```typescript
// Instead of any
function parse(input: unknown): User {
  if (typeof input === "object" && input !== null && "name" in input) {
    return input as User;
  }
  throw new Error("Invalid input");
}
```

## The Two Legitimate Exceptions

Matt identifies two advanced scenarios where `any` is the right choice.

### Exception 1: Type Argument Constraints in Generics

When building generic utility types, `unknown` in constraints can be too restrictive:

```typescript
// This is too restrictive — only works with specific function shapes
type ReturnType<T extends (...args: unknown[]) => unknown> = ...

// any[] constraint is correct — "we don't care what the function accepts"
type ReturnType<T extends (...args: any[]) => any> = ...
```

Using `any[]` here is intentional: you're declaring that the constraint should accept **any function**, not that you're bypassing safety.

### Exception 2: Conditional Types in Generic Functions

TypeScript's type narrowing sometimes can't verify that conditional type logic matches runtime behavior:

```typescript
function processValue<T extends string | number>(
  value: T
): T extends string ? string[] : number {
  if (typeof value === "string") {
    return value.split("") as any; // TypeScript can't narrow conditional return types
  }
  return (value as number) * 2 as any;
}
```

In these cases, Matt recommends using `as any` **and adding a unit test** to validate the function's behavior at runtime.

## The Pragmatic Approach

When you genuinely need `any`, use an `eslint-disable` comment to make it explicit and reviewable:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Callback = (...args: any[]) => void;
```

This creates a searchable record of every `any` in your codebase, making them easy to audit and justify in code review.
