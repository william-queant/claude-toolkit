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

## Runtime Validation with Zod / Valibot

Data entering your app from APIs, forms, or `localStorage` should be validated at runtime — TypeScript types don't exist at runtime. See [TypeScript Runtime Validation](../typescript/runtime-validation.md) for when to validate.

### Validating API Responses in `createResource`

Parse and type-narrow data inside the fetcher so the resource signal is guaranteed to hold valid data:

```typescript
import { z } from "zod";

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

type User = z.infer<typeof UserSchema>;

const [user] = createResource(userId, async (id): Promise<User> => {
  const res = await fetch(`/api/users/${id}`);
  const json = await res.json();
  return UserSchema.parse(json); // Throws on invalid shape
});
```

`z.infer<typeof Schema>` keeps your TypeScript types and runtime validation in sync — no duplication.

### A Reusable Typed Fetch Helper

```typescript
const fetchTyped = async <T extends z.ZodSchema>(
  url: string,
  schema: T,
): Promise<z.infer<T>> => {
  const res = await fetch(url);
  return schema.parse(await res.json());
};

// Usage with createResource
const [user] = createResource(userId, (id) =>
  fetchTyped(`/api/users/${id}`, UserSchema)
);
```

### Form Validation

[@modular-forms/solid](https://modularforms.dev/solid/guides/validate-your-fields) has built-in Zod integration via the `zodForm` adapter:

```typescript
import { createForm } from "@modular-forms/solid";
import { zodForm } from "@modular-forms/solid";

const LoginSchema = z.object({
  email: z.string().min(1, "Required").email("Invalid email"),
  password: z.string().min(8, "Min 8 characters"),
});

type LoginForm = z.infer<typeof LoginSchema>;

const [form, { Form, Field }] = createForm<LoginForm>({
  validate: zodForm(LoginSchema),
});
```

### Valibot as a Lighter Alternative

[Valibot](https://valibot.dev/) provides the same validation patterns with a tree-shakeable design — ~1.4kb vs Zod's ~13kb for a typical form schema. Ryan Carniato (SolidJS creator) has endorsed it, and `@modular-forms/solid` supports it natively via `valiForm`.

```typescript
import * as v from "valibot";

const UserSchema = v.object({
  id: v.string(),
  name: v.pipe(v.string(), v.nonEmpty()),
  email: v.pipe(v.string(), v.email()),
});

type User = v.InferInput<typeof UserSchema>;
```

**Choose based on your constraints:**

| Criteria        | Zod       | Valibot    |
| --------------- | --------- | ---------- |
| Bundle size     | ~13kb     | ~1.4kb     |
| Tree-shakeable  | No        | Yes        |
| Ecosystem       | Larger    | Growing    |
| API style       | Chaining  | Functional |
| Runtime speed   | Baseline  | ~2x faster |

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
