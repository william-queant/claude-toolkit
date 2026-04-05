---
name: ct-solidjs-patterns
description: SolidJS reactivity, signals, effects, and component patterns
---

# SolidJS Patterns

Components run **once**. Only reactive expressions re-execute. This is not React.

## Primitives

```tsx
const [count, setCount] = createSignal(0);      // always call: count()
const doubled = createMemo(() => count() * 2);   // cached derived value
createEffect(() => console.log(count()));         // side effect on change
const [data] = createResource(userId, fetchUser); // async: data(), data.loading, data.error
```

## Control Flow

```tsx
<Show when={ok()} fallback={<Fallback />}><Content /></Show>
<For each={items()}>{(item, i) => <div>{item.name} at {i()}</div>}</For>
<Switch fallback={<Default />}>
  <Match when={state() === "loading"}><Spinner /></Match>
  <Match when={state() === "error"}><Error /></Match>
</Switch>
```

## Props

**CRITICAL: Never destructure props.** Destructuring breaks reactivity.

```tsx
// WRONG -- reads once, never updates
const Comp = ({ name }) => <div>{name}</div>;

// CORRECT
const Comp = (props) => <div>{props.name}</div>;
```

`mergeProps` for defaults, `splitProps` to separate groups:

```tsx
const merged = mergeProps({ color: "blue" }, props);
const [local, others] = splitProps(props, ["class", "style"]);
```

## Stores

`createStore` for deep nested state with path-based updates:

```tsx
const [state, setState] = createStore({ user: { settings: { theme: "dark" } } });
setState("user", "settings", "theme", "light");
setState("items", items => [...items, newItem]);
```

## Anti-Patterns

1. **Destructuring props** -- Breaks reactivity. Always `props.x`.
2. **createEffect for derived values** -- Use `createMemo` instead.
3. **Treating it like React** -- No re-render cycle. Only reactive expressions update.
4. **Manual keys in For** -- `<For>` is keyed by reference automatically.
5. **Signals outside reactive context** -- `count()` at top level captures once. Wrap in JSX or effects.
6. **Forgetting to call signals** -- `count` is a getter, `count()` is the value.
