# Effects & Lifecycle

> Sources: [Effects](https://docs.solidjs.com/concepts/effects), [onMount](https://docs.solidjs.com/reference/lifecycle/on-mount), [onCleanup](https://docs.solidjs.com/reference/lifecycle/on-cleanup) — SolidJS Docs

## createEffect

Runs a side effect whenever its tracked dependencies change. Dependencies are automatically detected.

```typescript
createEffect(() => {
  document.title = `${count()} items`;
});
```

### When to Use Effects

Effects are for **interacting with the outside world** — the DOM, third-party libraries, logging, WebSockets.

**Use effects for:**
- DOM manipulation not covered by JSX
- Third-party library integration
- WebSocket connections
- Logging / analytics

**Don't use effects for:**
- Derived values → use `createMemo` or inline derivation
- State synchronization → derive instead of sync
- Data fetching → use `createResource`

### The #1 Anti-Pattern: Syncing State

```typescript
// WRONG — creates glitchy intermediate states
createEffect(() => {
  setDoubled(count() * 2);
});

// RIGHT — derive the value
const doubled = createMemo(() => count() * 2);
```

When you use effects to sync state, the reactive graph must choose an execution order, which can produce inconsistent intermediate states that flash in the UI.

## `on` — Explicit Dependencies

When you need to control which signals trigger an effect:

```typescript
import { on } from "solid-js";

createEffect(on(userId, (id) => {
  // Only runs when userId changes, not when other signals read inside change
  fetchUserData(id);
}));
```

`on` also provides the previous value:

```typescript
createEffect(on(count, (current, previous) => {
  console.log(`Changed from ${previous} to ${current}`);
}));
```

## onMount

Runs once after the component's initial render, when DOM elements are available. Non-reactive — it doesn't track signals.

```typescript
onMount(() => {
  // DOM is ready, refs are populated
  inputRef?.focus();
  
  // Good for one-time setup
  const chart = new Chart(canvasRef);
});
```

**Use for:** ref access, one-time DOM setup, measurements, API calls that should only happen once.

## onCleanup

Runs when the enclosing reactive scope is disposed or re-executed. Essential for preventing memory leaks.

```typescript
// In a component — runs when component unmounts
onCleanup(() => {
  chart.destroy();
});

// In an effect — runs before each re-execution and on dispose
createEffect(() => {
  const id = setInterval(() => tick(), props.interval);
  onCleanup(() => clearInterval(id));
});
```

**Always clean up:**
- Event listeners
- Timers (`setInterval`, `setTimeout`)
- WebSocket connections
- Third-party library instances
- Subscriptions

## Lifecycle Order

1. Component function runs (synchronous)
2. Reactive expressions are set up (signals, memos, effects registered)
3. DOM is created and mounted
4. `onMount` callbacks fire
5. Effects run (in dependency order)
6. On signal change: effects re-run, `onCleanup` fires before each re-run
7. On unmount: all `onCleanup` callbacks fire
