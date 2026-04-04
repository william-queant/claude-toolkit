# SolidJS Best Practices

> A curated collection of SolidJS best practices, patterns, and guidance sourced from the [official SolidJS documentation](https://docs.solidjs.com/), [Ryan Carniato](https://dev.to/ryansolid) (SolidJS creator), and the SolidJS community.

SolidJS uses **fine-grained reactivity** with no virtual DOM. Components run once; only reactive expressions re-execute when dependencies change. This is fundamentally different from virtual DOM frameworks — and most best practices stem from this core difference.

## Reactivity

Understanding reactivity is the foundation of everything in Solid.

| Guide | Summary |
|---|---|
| [Reactivity Model](reactivity-model.md) | How fine-grained reactivity works — signals, tracking, subscriptions. |
| [Signals & State](signals-and-state.md) | `createSignal`, `createMemo`, derived values, and when to use what. |
| [Stores & Nested State](stores-and-nested-state.md) | `createStore`, path syntax, `produce`, `reconcile` for complex state. |
| [Effects & Lifecycle](effects-and-lifecycle.md) | `createEffect`, `onMount`, `onCleanup` — and when NOT to use effects. |

## Components

Patterns for building and composing components.

| Guide | Summary |
|---|---|
| [Props Patterns](props-patterns.md) | Never destructure. Use `mergeProps`, `splitProps`, `children` helper. |
| [Component Patterns](component-patterns.md) | Composition, typed components, generic components, refs. |
| [Control Flow](control-flow.md) | `<Show>`, `<For>`, `<Switch>`/`<Match>`, `<ErrorBoundary>`, `<Suspense>`. |

## Architecture

Scaling patterns for real applications.

| Guide | Summary |
|---|---|
| [Data Fetching](data-fetching.md) | `createResource`, `createAsync`, Suspense, error handling, optimistic updates. |
| [Context & Global State](context-and-global-state.md) | Context + stores pattern, provider factories, avoiding prop drilling. |
| [TypeScript Integration](typescript-integration.md) | Component types, typed signals/stores/context, event handling, TSConfig. |

## Performance & Pitfalls

| Guide | Summary |
|---|---|
| [Performance](performance.md) | `lazy`, `batch`, `untrack`, code splitting, and what Solid optimizes for you. |
| [Anti-Patterns](anti-patterns.md) | The most common mistakes and how to avoid them. |
