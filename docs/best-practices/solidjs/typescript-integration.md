# TypeScript Integration

> Source: [TypeScript](https://docs.solidjs.com/configuration/typescript) — SolidJS Docs

## TSConfig for SolidJS

Required settings for Solid's JSX transformation:

```jsonc
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true
  }
}
```

`"jsx": "preserve"` is required — Solid's JSX transformation is incompatible with TypeScript's built-in JSX handling.

## Typing Signals

```typescript
// Type is inferred from the initial value
const [count, setCount] = createSignal(0); // Signal<number>

// Explicit type when initial value doesn't capture the full type
const [user, setUser] = createSignal<User | null>(null);

// Without a default, type includes undefined
const [data, setData] = createSignal<string>(); // Accessor<string | undefined>
```

## Typing Stores

```typescript
type AppState = {
  user: User;
  tasks: Task[];
  settings: { theme: "light" | "dark" };
};

const [state, setState] = createStore<AppState>({
  user: { id: "1", name: "Alice" },
  tasks: [],
  settings: { theme: "dark" },
});
```

## Typing Context

Provide a type parameter to `createContext`:

```typescript
type AuthContext = {
  user: User | null;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContext>();
```

**Factory pattern** — derive the type from the factory function:

```typescript
function createAuthStore() { /* ... */ }

const AuthContext = createContext<ReturnType<typeof createAuthStore>>();
```

## Component Types

```typescript
import type { Component, ParentComponent, VoidComponent, FlowComponent } from "solid-js";

// Standard component
const App: Component = () => <div>Hello</div>;

// Accepts children
const Card: ParentComponent<{ title: string }> = (props) => (
  <div>
    <h2>{props.title}</h2>
    {props.children}
  </div>
);

// No children allowed
const Icon: VoidComponent<{ name: string }> = (props) => (
  <svg class={`icon-${props.name}`} />
);
```

### Generic Components

`Component` types don't support generics. Use function declarations:

```typescript
function Select<T>(props: {
  options: T[];
  value: T;
  onChange: (value: T) => void;
  label: (item: T) => string;
}): JSX.Element {
  return (
    <For each={props.options}>
      {(option) => (
        <button
          classList={{ active: option === props.value }}
          onClick={() => props.onChange(option)}
        >
          {props.label(option)}
        </button>
      )}
    </For>
  );
}
```

## Event Handlers

Inline handlers are auto-typed. For extracted handlers:

```typescript
const handleInput: JSX.EventHandler<HTMLInputElement, InputEvent> = (e) => {
  // e.currentTarget is typed as HTMLInputElement
  setValue(e.currentTarget.value);
};
```

## Control Flow Type Narrowing

TypeScript can't narrow types through accessors. Use the callback form of `<Show>`:

```typescript
// WRONG — TypeScript doesn't know user() is non-null inside Show
<Show when={user()}>
  <span>{user()!.name}</span>  {/* Forced to use ! */}
</Show>

// RIGHT — callback provides narrowed accessor
<Show when={user()}>
  {(u) => <span>{u().name}</span>}
</Show>
```

## Extending JSX Types

### Custom Events

```typescript
declare module "solid-js" {
  namespace JSX {
    interface CustomEvents {
      myEvent: CustomEvent<{ detail: string }>;
    }
  }
}
```

### Custom Directives

```typescript
declare module "solid-js" {
  namespace JSX {
    interface Directives {
      tooltip: string;
      clickOutside: () => void;
    }
  }
}
```

### Explicit Properties/Attributes

```typescript
declare module "solid-js" {
  namespace JSX {
    interface ExplicitProperties { /* prop:___ */ }
    interface ExplicitAttributes { /* attr:___ */ }
    interface ExplicitBoolAttributes { /* bool:___ */ }
  }
}
```
