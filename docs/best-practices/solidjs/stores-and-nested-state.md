# Stores & Nested State

> Sources: [Stores](https://docs.solidjs.com/concepts/stores), [Complex State Management](https://docs.solidjs.com/guides/complex-state-management) — SolidJS Docs

## When to Use Stores

Use `createStore` when your state is a **complex, nested object** or an **array of objects** that receives granular updates. Stores provide fine-grained reactivity at the **property level** — updating a nested property only re-renders the parts of UI that depend on that specific property.

```typescript
import { createStore } from "solid-js/store";

const [state, setState] = createStore({
  user: { name: "Alice", settings: { theme: "dark" } },
  tasks: [
    { id: 1, text: "Learn Solid", completed: false },
  ],
});
```

**Reading:** Access properties directly (no function call needed):

```typescript
<span>{state.user.name}</span>
<span>{state.user.settings.theme}</span>
```

## Path Syntax Updates

Stores use a **path syntax** for targeted, efficient updates:

```typescript
// Update a nested property
setState("user", "settings", "theme", "light");

// Update a specific array item
setState("tasks", 0, "completed", true);

// Update with a function
setState("tasks", 0, "completed", prev => !prev);
```

### Array Operations

```typescript
// Append to array (targeted — doesn't recreate the array)
setState("tasks", state.tasks.length, {
  id: 2, text: "Ship it", completed: false,
});

// Update multiple indices
setState("tasks", [0, 2], "completed", true);

// Update by range
setState("tasks", { from: 0, to: 3 }, "completed", false);

// Update by predicate
setState("tasks", task => task.completed, "archived", true);
```

## `produce` for Imperative Updates

When you need to modify multiple properties at once, `produce` provides an imperative API:

```typescript
import { produce } from "solid-js/store";

setState("tasks", 0, produce(task => {
  task.completed = true;
  task.completedAt = Date.now();
}));

// Also works at the store root
setState(produce(state => {
  state.tasks.push({ id: 3, text: "New task", completed: false });
  state.user.name = "Bob";
}));
```

`produce` creates a draft, applies your mutations, then produces an immutable update. Only use it with objects and arrays (not Sets or Maps).

## `reconcile` for External Data

When you receive a whole new object (e.g., from an API response), `reconcile` diffs the old and new data, only triggering updates for properties that actually changed:

```typescript
import { reconcile } from "solid-js/store";

const newData = await fetchTasks();
setState("tasks", reconcile(newData));
```

This avoids re-rendering everything when most of the data hasn't changed.

## `unwrap` for Snapshots

Extract a plain JavaScript object from a store (strips the reactive proxy):

```typescript
import { unwrap } from "solid-js/store";

const snapshot = unwrap(state);
// Use snapshot for third-party libraries, logging, or serialization
```

## Best Practices

- **Use path syntax** for targeted updates — it's more efficient than replacing objects
- **Use `produce`** when modifying multiple properties in one operation
- **Use `reconcile`** when integrating API responses to avoid unnecessary updates
- **Don't mutate store properties directly** — always go through `setState`
- **Stores are batched automatically** — multiple `setState` calls in the same synchronous block are batched into one update
