---
name: solidjs-patterns
description: SolidJS reactivity, signals, effects, and component patterns
---

# SolidJS Patterns

## Reactivity Model

SolidJS uses **fine-grained reactivity** with no virtual DOM. Components run once; only the reactive expressions inside them re-execute when dependencies change. This is fundamentally different from React.

## Core Primitives

### createSignal
```tsx
const [count, setCount] = createSignal(0);
// Read: count() -- always call as function
// Write: setCount(1) or setCount(prev => prev + 1)
```

### createEffect
Runs side effects when tracked dependencies change. Automatically tracks any signal read inside it.
```tsx
createEffect(() => {
  console.log("Count changed:", count());
});
```

### createMemo
Derived computation that caches its result. Only recalculates when dependencies change.
```tsx
const doubled = createMemo(() => count() * 2);
```

### createResource
Async data fetching tied to a signal source. Returns a resource with loading/error states.
```tsx
const [data] = createResource(userId, fetchUser);
// data() — the resolved value
// data.loading — boolean
// data.error — error if rejected
```

## Component Patterns

### Show — conditional rendering
```tsx
<Show when={isLoggedIn()} fallback={<Login />}>
  <Dashboard />
</Show>
```

### For — list rendering (keyed by reference)
```tsx
<For each={items()}>{(item, index) =>
  <div>{item.name} at {index()}</div>
}</For>
```

### Switch/Match — multi-branch conditional
```tsx
<Switch fallback={<DefaultView />}>
  <Match when={state() === "loading"}><Spinner /></Match>
  <Match when={state() === "error"}><Error /></Match>
  <Match when={state() === "ready"}><Content /></Match>
</Switch>
```

### ErrorBoundary
```tsx
<ErrorBoundary fallback={(err) => <div>Error: {err.message}</div>}>
  <RiskyComponent />
</ErrorBoundary>
```

### Suspense
```tsx
<Suspense fallback={<Loading />}>
  <AsyncComponent />
</Suspense>
```

## Props Handling

**CRITICAL: Never destructure props.** Destructuring breaks reactivity because it reads the value once at call time.

```tsx
// WRONG -- kills reactivity
const MyComponent = ({ name, count }) => {
  return <div>{name}: {count}</div>;
};

// CORRECT -- preserves reactivity
const MyComponent = (props) => {
  return <div>{props.name}: {props.count}</div>;
};
```

Use `mergeProps` for defaults:
```tsx
const merged = mergeProps({ color: "blue" }, props);
```

Use `splitProps` to separate prop groups:
```tsx
const [local, others] = splitProps(props, ["class", "style"]);
```

## Store Patterns

`createStore` provides deep reactivity for complex nested state.
```tsx
const [state, setState] = createStore({
  user: { name: "Alice", settings: { theme: "dark" } }
});

// Granular updates with path syntax
setState("user", "settings", "theme", "light");

// Array mutations
setState("items", items => [...items, newItem]);
setState("items", idx, "done", true);
```

## Anti-Patterns

1. **Destructuring props** -- Breaks reactivity. Always use `props.x`.
2. **Unnecessary createEffect** -- If you just need a derived value, use `createMemo` instead.
3. **Treating it like React** -- Components do NOT re-run. There is no re-render cycle. Only reactive expressions update.
4. **Using array index as key in For** -- `<For>` is keyed by reference automatically; do not add manual key props.
5. **Reading signals outside reactive context** -- Reading `count()` at component top level captures the value once. Wrap in JSX expressions or effects to stay reactive.
6. **Forgetting to call signals** -- `count` is a getter function, `count()` is the value. Always call it.
