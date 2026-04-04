# Generics Patterns

> Sources: [TypeScript Generics in 3 Easy Patterns](https://www.totaltypescript.com/typescript-generics-in-three-easy-patterns), [There Is No Such Thing As A Generic](https://www.totaltypescript.com/no-such-thing-as-a-generic) — Matt Pocock

## Mental Model

Matt argues that "generics" is a misleading name. What people call generics is actually **three distinct patterns** for passing type arguments around.

## Pattern 1: Passing Types to Types

Create reusable type definitions that accept type parameters — like function arguments, but for types.

```typescript
type ApiResponse<TData> = {
  data: TData;
  error?: { message: string };
};

type UserResponse = ApiResponse<{
  id: string;
  name: string;
}>;

type OrderResponse = ApiResponse<{
  orderId: string;
  total: number;
}>;
```

This eliminates repetitive wrapper types while keeping each response strongly typed.

## Pattern 2: Passing Types to Functions

Explicitly specify type arguments when calling a function:

```typescript
const createSet = <T>() => {
  return new Set<T>();
};

const stringSet = createSet<string>();
const numberSet = createSet<number>();
```

Use this when TypeScript has no value to infer from — the function takes no arguments of type `T`.

## Pattern 3: Inferring Types from Arguments

The most common and powerful pattern. TypeScript deduces type parameters from the values you pass:

```typescript
const createSet = <T>(initial: T) => {
  return new Set<T>([initial]);
};

const stringSet = createSet("matt"); // Set<string>
const numberSet = createSet(123);    // Set<number>
```

A practical example with constraints:

```typescript
const objKeys = <T extends object>(obj: T): Array<keyof T> => {
  return Object.keys(obj) as Array<keyof T>;
};

const keys = objKeys({ a: 1, b: 2 });
// ("a" | "b")[]
```

The `extends object` constraint ensures only objects are accepted, while `keyof T` preserves the specific key types.

## When to Use Generics vs Unions

From Matt's tip "Know when to use generics":

**Use generics** when the output type depends on the input type — the caller's choice flows through the function.

```typescript
// Generic: return type depends on input
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}
```

**Use unions** when the function handles a fixed set of types internally.

```typescript
// Union: function handles all cases itself
function format(value: string | number): string {
  return String(value);
}
```

## Constraining Generics

Use `extends` to document expectations and catch misuse at the call site:

```typescript
function merge<T extends object, U extends object>(a: T, b: U): T & U {
  return { ...a, ...b };
}
```

Without the constraint, callers could pass primitives and get confusing errors deep inside the implementation.
