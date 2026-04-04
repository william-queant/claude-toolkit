# Data Fetching

> Sources: [Fetching Data](https://docs.solidjs.com/guides/fetching-data), [createResource](https://docs.solidjs.com/reference/basic-reactivity/create-resource) — SolidJS Docs

## createResource

The primary tool for async data in SolidJS. Wraps an async operation into a reactive signal with built-in loading, error, and state tracking.

```typescript
const [user, { mutate, refetch }] = createResource(userId, async (id) => {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
});
```

- `userId` is the **source signal** — when it changes, the fetcher re-runs
- The fetcher receives the source value as its first argument
- Returns a resource signal with reactive properties

### Resource Properties

```typescript
user()          // The resolved data (or undefined)
user.loading    // Boolean — is a fetch in progress?
user.error      // Error object if the fetch failed
user.state      // "unresolved" | "pending" | "ready" | "refreshing" | "errored"
user.latest     // Most recent successful data (persists during refetch)
```

## Handling States in JSX

### With Control Flow

```typescript
<Show when={!user.loading} fallback={<Spinner />}>
  <Show when={!user.error} fallback={<Error message={user.error.message} />}>
    <UserCard user={user()} />
  </Show>
</Show>
```

### With Suspense + ErrorBoundary (recommended)

```typescript
<ErrorBoundary fallback={(err, reset) => (
  <div>
    <p>Failed: {err.message}</p>
    <button onClick={reset}>Retry</button>
  </div>
)}>
  <Suspense fallback={<Skeleton />}>
    <UserCard />  {/* reads createResource internally */}
  </Suspense>
</ErrorBoundary>
```

Suspense detects resource reads within its boundary and shows the fallback until all resolve. This is the idiomatic pattern.

## Optimistic Updates with `mutate`

Update the UI immediately, then let the server catch up:

```typescript
const [tasks, { mutate, refetch }] = createResource(fetchTasks);

function addTask(text: string) {
  // Optimistic: update UI immediately
  mutate(prev => [...(prev ?? []), { id: "temp", text, completed: false }]);
  
  // Then sync with server
  postTask(text).then(() => refetch());
}
```

`mutate` overwrites the resource value without calling the fetcher.

## Refetching

Force a refetch independent of the source signal:

```typescript
const [prices, { refetch }] = createResource(fetchPrices);

// Poll every 10 seconds
const interval = setInterval(refetch, 10_000);
onCleanup(() => clearInterval(interval));
```

## createAsync (SolidStart / Solid Router)

For SolidStart apps, `createAsync` is the recommended async primitive. It's a thin wrapper over `createResource` designed for router-integrated data loading:

```typescript
import { createAsync } from "@solidjs/router";

const user = createAsync(() => getUser());
```

`createAsync` is intended to become the standard async primitive in Solid 2.0.

## Don't Fetch in Effects

```typescript
// WRONG — no loading state, no error handling, race conditions
createEffect(async () => {
  const data = await fetch(`/api/${id()}`);
  setResult(await data.json());
});

// RIGHT — built-in state management, cancellation, reactivity
const [result] = createResource(id, fetchData);
```

Effects run after render, causing a flash of empty state. Resources integrate with Suspense and provide proper loading/error states.
