# Performance

> Sources: [lazy](https://docs.solidjs.com/reference/component-apis/lazy), [batch](https://docs.solidjs.com/reference/reactive-utilities/batch), [untrack](https://docs.solidjs.com/reference/reactive-utilities/untrack) — SolidJS Docs

## What Solid Optimizes For You

Before reaching for performance tools, understand what Solid already does:

- **No virtual DOM diffing** — updates go directly to the specific DOM nodes
- **Components run once** — no re-renders, no stale closures
- **Automatic batching in stores** — multiple `setState` calls in the same synchronous block are batched
- **Conditional dependency tracking** — branches not taken don't create subscriptions
- **Equality checks on signals** — redundant updates are ignored

Most performance problems in Solid come from **fighting the reactive model**, not from the framework itself.

## `batch` — Group Signal Updates

When updating multiple independent signals in one synchronous operation, `batch` prevents intermediate re-renders:

```typescript
import { batch } from "solid-js";

batch(() => {
  setFirstName("John");
  setLastName("Doe");
  setAge(30);
});
// All effects that depend on these signals run once, not three times
```

Without `batch`, each setter triggers its dependents immediately. With `batch`, all updates are applied, then dependents run once with the final state.

**Note:** Store `setState` calls are already batched automatically. `batch` is primarily useful for multiple `createSignal` setters.

## `untrack` — Read Without Subscribing

Read a reactive value without creating a dependency:

```typescript
import { untrack } from "solid-js";

createEffect(() => {
  // This effect re-runs when query() changes
  // But does NOT re-run when options() changes
  fetchData(query(), untrack(() => options()));
});
```

**Use for:**
- Static configuration that shouldn't trigger re-runs
- Initial values you read once
- Avoiding circular dependencies

## `lazy` — Code Splitting

Lazy-load components to reduce initial bundle size:

```typescript
import { lazy } from "solid-js";

const AdminPanel = lazy(() => import("./AdminPanel"));

// Renders like a normal component
// Loads the code on first render, triggers Suspense boundaries
<Suspense fallback={<Spinner />}>
  <AdminPanel />
</Suspense>
```

The component loads on first render, not on import. Combine with `<Suspense>` for loading states.

## `<Dynamic>` — Avoid Mounting All Variants

Instead of conditionally showing/hiding multiple heavy components, use `<Dynamic>` to mount only the active one:

```typescript
const panels = { settings: Settings, profile: Profile, billing: Billing };

<Dynamic component={panels[activePanel()]} />
```

## Performance Anti-Patterns

| Anti-Pattern | Why It's Slow | Fix |
|---|---|---|
| Recreating objects in signals | Triggers all subscribers on every set | Use stores for nested data |
| Using `.map()` instead of `<For>` | Recreates all DOM nodes on any change | Use `<For>` or `<Index>` |
| Effects that sync state | Creates cascading updates | Derive with `createMemo` |
| Reading signals at component top level | Captures once, never updates | Read in JSX or effects |
| Wrapping everything in effects | Unnecessary tracking overhead | Only for external side effects |

## When to Actually Worry

Solid's reactivity is already very fast. Optimize only when you observe actual performance issues:

1. **Lists with 1000+ items** — ensure you're using `<For>` not `.map()`
2. **Rapid signal updates** (e.g., mouse move) — consider `batch` or throttling
3. **Large initial bundle** — use `lazy` for routes and heavy components
4. **Deep store trees** — use path syntax updates, not object replacement
