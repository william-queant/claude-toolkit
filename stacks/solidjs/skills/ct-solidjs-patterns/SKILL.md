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

**CRITICAL: Never destructure props.** Destructuring breaks reactivity. (This overrides the general "use destructuring" guidance in `ct-code-style` — destructure plain data, never reactive `props`.)

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

## Performance

> _Verified against SolidJS 1.x (2026-06); 2.0 changes batching semantics._

Solid is fast by default: no VDOM, no re-render cycle. Wins come from list keying, splitting bundles, and keeping the reactive graph narrow.

### `<For>` vs `<Index>`

| Use | When | Keyed by |
|-----|------|----------|
| `<For>` | array of objects; add/remove/reorder matters | item reference |
| `<Index>` | primitives, or fixed slots where only the value changes (inputs, cells) | position |

```tsx
<For each={users()}>{(u) => <Row user={u} />}</For>        // identity matters
<Index each={scores()}>{(s, i) => <Cell value={s()} />}</Index> // s is a SIGNAL: s(), i is a number
```

Wrong choice tears down and rebuilds rows on every change. Note the swap: `<For>` gives `(item, index())`, `<Index>` gives `(item(), index)`.

### Code-split for cold-start

Split at route/screen boundaries so the first screen isn't blocked by the whole app (critical under Capacitor).

```tsx
const Settings = lazy(() => import("./screens/Settings"));
<Suspense fallback={<Spinner />}><Settings /></Suspense>  // createResource suspends here too
```

### Hot paths: `batch` + `untrack`

Only writes inside a reactive computation (effect/memo) auto-batch. Writes from event handlers, timers, async callbacks, and resolved promises do NOT — wrap multiple writes in `batch()` (Solid 1.x; 2.0 will auto-batch everything).

```tsx
const onSave = () => batch(() => { setX(1); setY(2); });  // event handler: NOT auto-batched -> batch()
setTimeout(() => batch(() => { setX(1); setY(2); }), 0);  // async/timer: one update, not two
createEffect(() => { log(a()); untrack(() => b()); });    // subscribe to a, read b without subscribing
```

### Keep state granular

```tsx
// Whole-object signal: every reader re-runs on ANY field change (new ref = notify)
const [user, setUser] = createSignal({ name, age });
// Store: path update notifies only that path's dependents
const [user, setUser] = createStore({ name, age });
setUser("age", 31); // name readers untouched
```

Keep signals local; lift only what's truly shared.

### Theme via attribute, not signal

Driving theme through a signal+context re-evaluates every consumer on toggle. Use a data-attribute + CSS vars — zero reactive work:

```tsx
document.documentElement.dataset.theme = "dark"; // CSS: [data-theme="dark"] { --bg: #111 }
```

## Anti-Patterns

1. **Destructuring props** -- Breaks reactivity. Always `props.x`.
2. **createEffect for derived values** -- Use `createMemo` instead.
3. **Treating it like React** -- No re-render cycle. Only reactive expressions update.
4. **Manual keys in For** -- `<For>` is keyed by reference automatically.
5. **Signals outside reactive context** -- `count()` at top level captures once. Wrap in JSX or effects.
6. **Forgetting to call signals** -- `count` is a getter, `count()` is the value.
7. **`<Index>` for object lists / `<For>` for primitives** -- Mismatched keying rebuilds rows. Objects→`<For>`, primitives/slots→`<Index>`.
8. **Theme/global toggles as signal+context** -- Re-evaluates all consumers. Use a `data-` attribute + CSS vars.
9. **One signal holding a whole object** -- Any field change re-runs every reader. Use `createStore` for path-granular updates.
10. **Eager-importing every screen** -- Blocks cold-start. `lazy()` + `<Suspense>` at route/screen boundaries.
11. **Assuming event handlers auto-batch** -- They don't (Solid 1.x). Multiple writes in a handler/timer/async callback run dependents per-write; wrap them in `batch()`.

## See Also

- `ct-vanilla-extract-patterns` — theme via `data-theme`/class swap (not signals); logical properties for RTL.
- `ct-i18n-typesafe` — defer locale loading behind a `createResource`-tracked `<Suspense>` (a bare `await` never trips Solid's boundary).
- `ct-capacitor-ui` — `lazy()` + `<Suspense>` screen splitting is the main lever for mobile cold-start.
