# SolidJS Patterns

> SolidJS reactivity, signals, effects, and component patterns.

**Type:** Stack Skill (requires `solidjs` stack)
**Source:** [`stacks/solidjs/skills/ct-solidjs-patterns/SKILL.md`](../stacks/solidjs/skills/ct-solidjs-patterns/SKILL.md)
**Directory Mappings:** `src/components/`, `src/hooks/`, `src/pages/`
**File Extensions:** `.tsx`, `.jsx`

## Overview

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
// data(), data.loading, data.error
```

## Component Patterns

| Component | Purpose | Example |
|---|---|---|
| `<Show>` | Conditional rendering | `<Show when={isLoggedIn()} fallback={<Login />}>` |
| `<For>` | List rendering (keyed by reference) | `<For each={items()}>{(item) => ...}</For>` |
| `<Switch>/<Match>` | Multi-branch conditional | `<Match when={state() === "loading"}>` |
| `<ErrorBoundary>` | Error catching | `<ErrorBoundary fallback={(err) => ...}>` |
| `<Suspense>` | Async loading states | `<Suspense fallback={<Loading />}>` |

## Props Handling

**CRITICAL: Never destructure props.** Destructuring breaks reactivity.

```tsx
// WRONG -- kills reactivity
const MyComponent = ({ name, count }) => { ... };

// CORRECT -- preserves reactivity
const MyComponent = (props) => {
  return <div>{props.name}: {props.count}</div>;
};
```

- Use `mergeProps` for defaults: `const merged = mergeProps({ color: "blue" }, props)`
- Use `splitProps` to separate prop groups: `const [local, others] = splitProps(props, ["class", "style"])`

## Store Patterns

`createStore` provides deep reactivity for complex nested state with path-based updates:

```tsx
const [state, setState] = createStore({
  user: { name: "Alice", settings: { theme: "dark" } }
});

// Granular updates
setState("user", "settings", "theme", "light");
```

## Anti-patterns

| Anti-pattern | Why it's wrong |
|---|---|
| **Destructuring props** | Breaks reactivity. Always use `props.x`. |
| **Unnecessary createEffect** | If you just need a derived value, use `createMemo`. |
| **Treating it like React** | Components do NOT re-run. Only reactive expressions update. |
| **Array index as key in For** | `<For>` is keyed by reference automatically. |
| **Reading signals outside reactive context** | Captures the value once at component top level. |
| **Forgetting to call signals** | `count` is a getter function, `count()` is the value. |

## Best Practices Reference

For deeper guidance on SolidJS patterns (sourced from official docs and Ryan Carniato):

| Topic | Guide |
|---|---|
| How fine-grained reactivity works internally | [Reactivity Model](../best-practices/solidjs/reactivity-model.md) |
| Signal vs memo, derived values, when to use what | [Signals & State](../best-practices/solidjs/signals-and-state.md) |
| `produce`, `reconcile`, path syntax for nested state | [Stores & Nested State](../best-practices/solidjs/stores-and-nested-state.md) |
| `mergeProps`, `splitProps`, `children` helper | [Props Patterns](../best-practices/solidjs/props-patterns.md) |
| When NOT to use effects, `onMount`, `onCleanup` | [Effects & Lifecycle](../best-practices/solidjs/effects-and-lifecycle.md) |
| `Show`, `For`, `Switch`/`Match`, `Suspense` details | [Control Flow](../best-practices/solidjs/control-flow.md) |
| `createResource`, `createAsync`, optimistic updates | [Data Fetching](../best-practices/solidjs/data-fetching.md) |
| Full catalog of common SolidJS mistakes | [Anti-Patterns](../best-practices/solidjs/anti-patterns.md) |

See the full collection: [SolidJS Best Practices](../best-practices/solidjs/README.md)
