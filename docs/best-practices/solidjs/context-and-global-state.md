# Context & Global State

> Sources: [Context](https://docs.solidjs.com/concepts/context), [Complex State Management](https://docs.solidjs.com/guides/complex-state-management) — SolidJS Docs

## When to Use Context

Context solves **prop drilling** — passing state through many component layers that don't use it themselves. Use it for:

- Theme / appearance settings
- Authentication state
- Feature flags
- Any state needed by many descendants

**When NOT to use context:**
- If only a few components need the data, pass props directly
- If you can restructure the component tree to avoid drilling
- For truly global singletons, a module-level signal may be simpler

## Basic Context Pattern

```typescript
import { createContext, useContext } from "solid-js";
import { createStore } from "solid-js/store";

// 1. Create context
const CounterContext = createContext<{
  count: number;
  increment: () => void;
}>();

// 2. Create provider component
function CounterProvider(props: ParentProps) {
  const [state, setState] = createStore({ count: 0 });
  const value = {
    get count() { return state.count; },
    increment() { setState("count", c => c + 1); },
  };

  return (
    <CounterContext.Provider value={value}>
      {props.children}
    </CounterContext.Provider>
  );
}

// 3. Consume with useContext
function Counter() {
  const ctx = useContext(CounterContext);
  return <button onClick={ctx.increment}>{ctx.count}</button>;
}
```

## Safe useContext with Error Throwing

`useContext` returns `undefined` when no provider exists above. Create a custom hook that throws a helpful error:

```typescript
function useCounter() {
  const ctx = useContext(CounterContext);
  if (!ctx) {
    throw new Error("useCounter must be used within a CounterProvider");
  }
  return ctx;
}
```

This also **narrows the TypeScript type** — no more `| undefined`.

## Context + Store Pattern (Recommended)

Combine `createStore` with context for scalable state. Stores give you fine-grained reactivity; context distributes it without prop drilling.

```typescript
function createTaskStore() {
  const [state, setState] = createStore({
    tasks: [] as Task[],
    filter: "all" as "all" | "active" | "completed",
  });

  return {
    get tasks() { return state.tasks; },
    get filter() { return state.filter; },
    addTask(text: string) {
      setState("tasks", state.tasks.length, {
        id: crypto.randomUUID(),
        text,
        completed: false,
      });
    },
    toggleTask(id: string) {
      setState("tasks", t => t.id === id, "completed", c => !c);
    },
    setFilter(filter: "all" | "active" | "completed") {
      setState("filter", filter);
    },
  };
}

const TaskContext = createContext<ReturnType<typeof createTaskStore>>();

function TaskProvider(props: ParentProps) {
  return (
    <TaskContext.Provider value={createTaskStore()}>
      {props.children}
    </TaskContext.Provider>
  );
}
```

**Why this works well in Solid:** Updating a signal at the top of the tree does NOT cause children to re-render. Only the specific reactive expressions that read the changed property update. There is no performance penalty for high-level state.

## HMR Consideration

To avoid recreating context during Hot Module Replacement, define `createContext` in its **own module** (separate file), not inline in a component file.

## Module-Level Signals vs Context

For truly global, app-wide singletons (e.g., a theme toggle), a module-level signal is simpler:

```typescript
// theme.ts
export const [theme, setTheme] = createSignal<"light" | "dark">("light");

// Any component can import directly
import { theme, setTheme } from "./theme";
```

Use context instead when:
- Different subtrees need different values (e.g., per-user state)
- You need testability (mock providers in tests)
- The state has complex dependencies
