# Control Flow

> Sources: [Show](https://docs.solidjs.com/reference/components/show), [For](https://docs.solidjs.com/reference/components/for), [SolidJS Tutorials](https://www.solidjs.com/tutorial) — SolidJS Docs

## Why Control Flow Components?

In Solid, **avoid JavaScript-native conditionals and `.map()` in JSX**. Solid's control flow components provide explicit boundaries that the compiler can optimize — they track dependencies and minimize DOM operations.

## `<Show>` — Conditional Rendering

Renders children when `when` is truthy. Optionally provides a `fallback`.

```typescript
<Show when={user()} fallback={<LoginPrompt />}>
  <Dashboard />
</Show>
```

### Callback Form for Type Narrowing

The callback form provides a non-null accessor — essential for TypeScript:

```typescript
<Show when={user()}>
  {(nonNullUser) => <span>{nonNullUser().name}</span>}
</Show>
```

TypeScript cannot narrow accessor types through control flow, so the callback form is the idiomatic way to access narrowed values.

## `<For>` — List Rendering

Renders a list, keyed by **reference** (not index). Only re-renders items that actually change.

```typescript
<For each={items()}>
  {(item, index) => (
    <li>{index()}: {item.name}</li>
  )}
</For>
```

- `item` is the value (not reactive for primitives)
- `index()` is a signal — call it as a function
- Items are tracked by reference — avoid recreating objects

### `<Index>` — Keyed by Index

For primitive arrays where values change but positions are stable:

```typescript
<Index each={names()}>
  {(name, i) => <li>{i}: {name()}</li>}
</Index>
```

- `name` is a signal (reactive)
- `i` is a plain number (not reactive)

**Rule of thumb:** Use `<For>` for arrays of objects, `<Index>` for arrays of primitives.

## `<Switch>` / `<Match>` — Multi-Branch Conditional

```typescript
<Switch fallback={<p>Unknown state</p>}>
  <Match when={state() === "loading"}>
    <Spinner />
  </Match>
  <Match when={state() === "error"}>
    <ErrorDisplay />
  </Match>
  <Match when={state() === "ready"}>
    <Content />
  </Match>
</Switch>
```

First matching `<Match>` wins. Use `fallback` on `<Switch>` for the default case.

## `<ErrorBoundary>` — Error Catching

Catches errors thrown in child components and renders a fallback:

```typescript
<ErrorBoundary fallback={(err, reset) => (
  <div>
    <p>Error: {err.message}</p>
    <button onClick={reset}>Retry</button>
  </div>
)}>
  <RiskyComponent />
</ErrorBoundary>
```

The `reset` function re-renders the children, giving the component a fresh chance.

## `<Suspense>` — Async Loading States

Displays a fallback while waiting for async resources to resolve:

```typescript
<Suspense fallback={<Skeleton />}>
  <UserProfile />  {/* Uses createResource internally */}
</Suspense>
```

Suspense detects any `createResource` read within its boundary and holds rendering until all resolve. Nested Suspense boundaries allow granular loading states.

## `<Dynamic>` — Dynamic Component

Render a component determined at runtime:

```typescript
<Dynamic component={isAdmin() ? AdminPanel : UserPanel} user={user()} />
```

## Don't Use

| Instead of | Use |
|---|---|
| `{condition && <Component />}` | `<Show when={condition}>` |
| `{condition ? <A /> : <B />}` | `<Show when={condition} fallback={<B />}>` |
| `{items.map(i => ...)}` | `<For each={items()}>` |
| Nested ternaries | `<Switch>` / `<Match>` |
