# Props Patterns

> Sources: [Props](https://docs.solidjs.com/concepts/components/props), [Props Tutorials](https://www.solidjs.com/tutorial/props_defaults) — SolidJS Docs

## The Cardinal Rule: Never Destructure Props

Props use **getters** internally for reactive tracking. Destructuring extracts the value once, severing the reactive connection permanently.

```typescript
// WRONG — breaks reactivity
const MyComponent = ({ name, count }) => {
  return <div>{name}: {count}</div>; // Never updates
};

// WRONG — same problem
const MyComponent = (props) => {
  const { name } = props; // Captured once, never reactive
  return <div>{name}</div>;
};

// CORRECT — preserves reactivity
const MyComponent = (props) => {
  return <div>{props.name}: {props.count}</div>;
};
```

## `mergeProps` for Defaults

Set default prop values without breaking reactivity:

```typescript
import { mergeProps } from "solid-js";

const Button = (props) => {
  const merged = mergeProps({ variant: "primary", size: "md" }, props);
  return <button class={`btn-${merged.variant} btn-${merged.size}`}>
    {merged.children}
  </button>;
};
```

`mergeProps` resolves properties in reverse order — later objects override earlier ones while preserving reactive tracking.

## `splitProps` for Prop Forwarding

Safely separate local props from props to forward to children:

```typescript
import { splitProps } from "solid-js";

const Input = (props) => {
  const [local, inputProps] = splitProps(props, ["label", "error"]);
  
  return (
    <div>
      <label>{local.label}</label>
      <input {...inputProps} />
      <Show when={local.error}>
        <span class="error">{local.error}</span>
      </Show>
    </div>
  );
};
```

You can split into multiple groups:

```typescript
const [style, events, rest] = splitProps(props, ["class", "style"], ["onClick", "onInput"]);
```

## `children` Helper

Accessing `props.children` multiple times can create duplicate elements. Use the `children` helper to resolve children once:

```typescript
import { children } from "solid-js";

const ColoredList = (props) => {
  const resolved = children(() => props.children);
  
  return <div class="colored">{resolved()}</div>;
};
```

The helper resolves any dynamic children into a flat array, memoized for safe repeated access.

## Call Signals Before Passing as Props

When passing a signal value to a child component, call the getter. Components shouldn't need to know whether a prop came from a signal or a static value.

```typescript
// CORRECT — child receives a plain value
<UserCard name={userName()} age={userAge()} />

// Also valid — passing a reactive getter for the child to track
<UserCard name={userName} />  // child would read props.name()
```

The first pattern is simpler and recommended for most cases. The second is useful when you want the child to participate in fine-grained tracking.
