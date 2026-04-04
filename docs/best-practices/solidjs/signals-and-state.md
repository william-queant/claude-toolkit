# Signals & State

> Sources: [Signals](https://docs.solidjs.com/concepts/signals), [Derived Signals](https://docs.solidjs.com/concepts/derived-values/derived-signals) — SolidJS Docs

## createSignal

The primary state primitive. Returns a getter function and a setter function.

```typescript
const [count, setCount] = createSignal(0);

// Read: always call as a function
console.log(count()); // 0

// Write: direct value or updater function
setCount(5);
setCount(prev => prev + 1);
```

**Key mental model:** The getter is a function, not a value. You must call `count()` to read it. Forgetting the parentheses is the most common Solid mistake.

## Derived Values

### Inline Derivations

For simple computations, a plain function is sufficient:

```typescript
const doubled = () => count() * 2;
```

This re-evaluates every time it's called in a reactive context. No caching.

### createMemo

For expensive computations or values read in multiple places, use `createMemo` to cache the result:

```typescript
const sorted = createMemo(() => {
  console.log("Sorting..."); // Only runs when items() changes
  return items().slice().sort((a, b) => a.localeCompare(b));
});
```

**When to use `createMemo` vs inline derivation:**

| Scenario | Use |
|---|---|
| Simple, cheap computation | Inline function `() => ...` |
| Expensive computation (sort, filter, map) | `createMemo` |
| Value read in multiple reactive contexts | `createMemo` |
| Value used once in JSX | Inline function |

## Signals for Functions

If you need to store a function as a signal value, use the callback form of the setter to avoid Solid treating it as an updater:

```typescript
const [handler, setHandler] = createSignal<() => void>(() => {});

// WRONG — Solid calls this as an updater
setHandler(myFunction);

// RIGHT — wrap in callback
setHandler(() => myFunction);
```

## When to Use Signals vs Stores

| Data shape | Use |
|---|---|
| Single primitive value | `createSignal` |
| Simple object (few properties, flat) | `createSignal` |
| Complex nested object | `createStore` |
| Array of objects with updates | `createStore` |
| Shared state across components | `createStore` + context |

See [Stores & Nested State](stores-and-nested-state.md) for store patterns.
