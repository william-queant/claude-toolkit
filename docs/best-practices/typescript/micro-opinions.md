# Micro-Opinions

> Small but specific stances from Matt Pocock on everyday TypeScript choices.

## Declare Return Types for Top-Level Functions

> Source: [Should You Declare Return Types?](https://www.totaltypescript.com/should-you-declare-return-types)

Declare return types on module-level functions. This communicates intent and helps both humans and AI tools understand what a function is designed to return.

```typescript
// Do this for top-level functions
const fetchUser = async (id: string): Promise<User> => {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
};
```

**Exception:** Skip return types for components returning JSX — the return type is always obvious.

```typescript
// Skip for JSX-returning components
const Avatar = (props: AvatarProps) => {
  return <img alt={props.name} />;
};
```

## Prefer `const` Over `let`

> Source: [How let and const Work In TypeScript](https://www.totaltypescript.com/let-and-const)

`const` gives TypeScript narrower, literal type inference. `let` widens to the base type because the variable could be reassigned.

```typescript
const genre = "rock"; // type: "rock" (literal)
let genre = "rock";   // type: string (widened)
```

Prefer `const` to get stricter types. If you must use `let`, add an explicit type annotation.

## Prefer `T[]` Over `Array<T>`

> Source: [Array\<T\> vs T[]: Which is better?](https://www.totaltypescript.com/array-types-in-typescript)

Both are functionally identical. Matt prefers `T[]` because:
- TypeScript's compiler, hover info, and error messages always use `T[]` syntax
- It feels more natural and is used throughout the official docs

**Caveat:** `Array<keyof Person>` avoids the need for parentheses that `(keyof Person)[]` requires. Minor edge case.

**What matters most:** Pick one and enforce it with an ESLint rule. Consistency beats preference.

## Don't Use Method Shorthand Syntax

> Source: [Method Shorthand Syntax Considered Harmful](https://www.totaltypescript.com/method-shorthand-syntax-considered-harmful)

Method shorthand in interfaces/types is **bivariant** — it accepts parameter types both narrower and wider than specified, creating a type safety gap.

```typescript
// Bivariant (unsafe) — allows narrowing the parameter
interface Handler {
  handle(input: Animal): void;
}

// Properly covariant (safe)
interface Handler {
  handle: (input: Animal) => void;
}
```

With the shorthand, you can implement `handle` expecting `Dog` instead of `Animal`, then pass a `Cat` at runtime — TypeScript won't catch it.

**Enforcement:** Use the ESLint rule `@typescript-eslint/method-signature-style` with `"property"` option.

## Never Use the `Function` Type

> Source: [Don't use Function type in TypeScript](https://www.totaltypescript.com/dont-use-function-keyword-in-typescript)

`Function` represents *any* function with no type information. It kills inference, autocomplete, and safety.

| Instead of | Use |
|---|---|
| `Function` | `(...args: any[]) => any` (any function) |
| `Function` | `() => void` (no-arg callback) |
| `Function` | `(item: T) => number` (specific signature) |

Be as specific as possible. The more precise the function type, the more TypeScript can help you.
