# Anti-Patterns

> Common SolidJS mistakes sourced from the [SolidJS documentation](https://docs.solidjs.com/), community guides, and [Ryan Carniato's articles](https://dev.to/ryansolid).

## 1. Destructuring Props

The single most common Solid mistake. Props use getters for reactivity — destructuring extracts the value once.

```typescript
// BROKEN
const Card = ({ title, count }) => <div>{title}: {count}</div>;

// FIXED
const Card = (props) => <div>{props.title}: {props.count}</div>;
```

If you need to separate props, use `splitProps`. If you need defaults, use `mergeProps`.

## 2. Forgetting to Call Signals

Signals are getter functions. Forgetting `()` passes the function itself, not the value.

```typescript
// BROKEN — passes the function, not the value
<span>{count}</span>

// FIXED
<span>{count()}</span>
```

## 3. Reading Signals Outside Reactive Context

The component body runs once. Reading a signal at the top level captures the initial value — it never updates.

```typescript
// BROKEN — layout is assigned once, never reactive
const MyComponent = (props) => {
  const layout = props.wide ? "grid" : "list"; // Evaluated once
  return <div class={layout}>...</div>;
};

// FIXED — read in JSX (reactive context)
const MyComponent = (props) => {
  return <div class={props.wide ? "grid" : "list"}>...</div>;
};

// Also fixed — wrap in a function
const MyComponent = (props) => {
  const layout = () => props.wide ? "grid" : "list";
  return <div class={layout()}>...</div>;
};
```

## 4. Using Effects to Sync State

Effects that set state from other state create ordering problems and glitchy intermediate renders.

```typescript
// BROKEN — effect-based synchronization
const [count, setCount] = createSignal(0);
const [doubled, setDoubled] = createSignal(0);
createEffect(() => setDoubled(count() * 2));

// FIXED — derivation
const doubled = createMemo(() => count() * 2);
// or: const doubled = () => count() * 2;
```

**Rule:** If a value can be computed from reactive sources, derive it.

## 5. Using Effects for Data Fetching

Effects run after render, have no built-in loading/error states, and create race conditions on dependency changes.

```typescript
// BROKEN
createEffect(async () => {
  const res = await fetch(`/api/${id()}`);
  setData(await res.json());
});

// FIXED
const [data] = createResource(id, fetchData);
```

`createResource` integrates with Suspense, handles loading/error, and manages race conditions.

## 6. Using `.map()` Instead of `<For>`

JavaScript `.map()` recreates all DOM nodes whenever the array signal changes. `<For>` tracks items by reference and only updates what changed.

```typescript
// INEFFICIENT — full DOM rebuild on any array change
<ul>{items().map(item => <li>{item.name}</li>)}</ul>

// CORRECT — granular updates
<ul><For each={items()}>{(item) => <li>{item.name}</li>}</For></ul>
```

## 7. Using `&&` for Conditional Rendering

JavaScript short-circuit evaluation doesn't give Solid the boundaries it needs to optimize.

```typescript
// SUBOPTIMAL — no Solid optimization
{isVisible() && <Modal />}

// CORRECT — Solid can optimize the boundary
<Show when={isVisible()}><Modal /></Show>
```

## 8. Mutating Store State Directly

Stores use proxies. Direct mutation bypasses the reactive system.

```typescript
// BROKEN — Solid doesn't see this change
state.tasks[0].completed = true;

// FIXED — go through setState
setState("tasks", 0, "completed", true);
```

## 9. Creating Unnecessary Reactivity

Not everything needs to be a signal. Static configuration, constants, and values that never change don't benefit from reactivity.

```typescript
// UNNECESSARY
const [apiUrl] = createSignal("https://api.example.com");

// JUST USE A CONSTANT
const API_URL = "https://api.example.com";
```

## 10. Missing `onCleanup`

Effects that create subscriptions, timers, or event listeners without cleanup cause memory leaks.

```typescript
// LEAKS — interval is never cleared
createEffect(() => {
  setInterval(() => tick(), 1000);
});

// FIXED
createEffect(() => {
  const id = setInterval(() => tick(), 1000);
  onCleanup(() => clearInterval(id));
});
```

## Quick Reference

| Mistake | Fix |
|---|---|
| Destructure props | Use `props.x` directly |
| `count` without `()` | Always call signal getters |
| Signal read at top level | Read in JSX or wrap in `() =>` |
| Effect sets state from state | Use `createMemo` |
| Effect fetches data | Use `createResource` |
| `.map()` for lists | Use `<For>` |
| `&&` for conditionals | Use `<Show>` |
| Direct store mutation | Use `setState()` |
| Signal for constants | Use a plain variable |
| No `onCleanup` | Always clean up side effects |
