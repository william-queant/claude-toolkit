# Discriminated Unions

> Source: [TypeScript Discriminated Unions for Frontend Developers](https://www.totaltypescript.com/discriminated-unions-are-a-devs-best-friend) — Matt Pocock

## The Problem: Bag of Optionals

The naive approach to modeling state uses optional properties in a single type:

```typescript
// Don't do this
type State = {
  status: "loading" | "success" | "error";
  data?: { id: string };
  error?: Error;
};
```

This allows **impossible states**: you can have `status: "success"` with no `data`, or `status: "loading"` with an `error`. TypeScript can't help you because every property is independently optional.

## The Solution: Discriminated Unions

Model each state as a distinct member of a union, with only the properties relevant to that state:

```typescript
type State =
  | { status: "loading" }
  | { status: "success"; data: { id: string } }
  | { status: "error"; error: Error };
```

Now `data` only exists when `status` is `"success"`, and `error` only exists when `status` is `"error"`. Impossible states are unrepresentable.

## Type Narrowing

You must check the discriminator before accessing state-specific properties. This strictness is a feature:

```typescript
function handleState(state: State) {
  if (state.status === "success") {
    // TypeScript knows state.data exists here
    console.log(state.data.id);
  }

  if (state.status === "error") {
    // TypeScript knows state.error exists here
    console.log(state.error.message);
  }
}
```

## Component Props Pattern

Apply discriminated unions to component APIs with conditional properties:

```typescript
type ModalProps =
  | {
      variant: "with-description";
      title: string;
      description: string;
      buttonText: string;
    }
  | {
      variant: "base";
      title: string;
    };
```

This prevents consumers from passing `description` without `buttonText`, or using the wrong combination of props.

## Why This Matters

As Matt puts it: "Instead of a big optional bag of data, you'll start understanding the connections between data and UI."

Discriminated unions force you to think about which data belongs together in which state — and the compiler enforces those relationships for you.
