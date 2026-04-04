# Reactivity Model

> Sources: [Fine-Grained Reactivity](https://docs.solidjs.com/advanced-concepts/fine-grained-reactivity), [Intro to Reactivity](https://docs.solidjs.com/concepts/intro-to-reactivity) — SolidJS Docs

## The Core Difference

SolidJS uses **fine-grained reactivity**. Updates target specific DOM elements that depend on changed data — not entire component trees. Components run **once**; only the reactive expressions inside them re-execute.

This means:
- No virtual DOM diffing
- No component re-renders
- No stale closure bugs
- Updates are surgical and automatic

## How It Works

### Signals, Effects, and the Subscription Model

The reactive system has two key elements: **signals** (data sources) and **observers** (effects, memos, JSX expressions).

1. A global `currentSubscriber` variable tracks the active observer
2. When an observer runs, it sets itself as the current subscriber
3. Any signal read during that execution registers the subscriber
4. When a signal's value changes, all registered subscribers re-execute
5. The subscriber reference is cleared after execution

```typescript
const [count, setCount] = createSignal(0);

// This effect becomes a subscriber of `count`
createEffect(() => {
  console.log(count()); // Reading count() registers the dependency
});

setCount(1); // Notifies the effect, which re-runs
```

### Equality Checks

Signals only notify subscribers when the value **actually changes**. Redundant updates (setting the same value) are ignored.

```typescript
setCount(0); // If count is already 0, no effects fire
```

## The Synchronous Contract

Reactivity in Solid is **synchronous**. The system registers a subscriber, runs the function, and unregisters — all in one synchronous pass.

This means **async operations break tracking**:

```typescript
// BROKEN — fetch happens after tracking ends
createEffect(async () => {
  const data = await fetch(url());  // url() is tracked
  setResult(data);                   // but this runs after tracking ends
});

// CORRECT — use createResource for async
const [data] = createResource(url, fetchData);
```

## Dependency Tracking is Automatic

You don't declare dependencies. Solid tracks them by observing which signals are read during execution:

```typescript
createEffect(() => {
  // Solid automatically knows this depends on firstName() and lastName()
  console.log(`${firstName()} ${lastName()}`);
});
```

### Conditional Tracking

If a branch isn't taken, signals in that branch aren't tracked:

```typescript
const display = createMemo(() => {
  if (!showDetails()) return "Hidden";
  // name() and age() are only tracked when showDetails() is true
  return `${name()}, age ${age()}`;
});
```

## Derive, Don't Sync

The golden rule of Solid reactivity:

**If a value can be computed from other reactive values, derive it — don't synchronize it with an effect.**

```typescript
// WRONG — synchronizing state
createEffect(() => {
  setDoubled(count() * 2);
});

// RIGHT — deriving state
const doubled = createMemo(() => count() * 2);
// or simply:
const doubled = () => count() * 2;
```

Derived values integrate naturally with the reactive graph. Effects that synchronize state create ordering problems and glitchy intermediate states.
