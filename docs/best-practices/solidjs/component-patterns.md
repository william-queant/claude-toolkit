# Component Patterns

> Sources: [TypeScript](https://docs.solidjs.com/configuration/typescript), [Props](https://docs.solidjs.com/concepts/components/props) — SolidJS Docs

## Component Type Hierarchy

SolidJS provides four component types for TypeScript:

```typescript
import type { Component, ParentComponent, FlowComponent, VoidComponent } from "solid-js";
```

| Type | Children | Use Case |
|---|---|---|
| `Component<P>` | No opinion | Base type, generic components |
| `ParentComponent<P>` | Optional `JSX.Element` | Components that accept children |
| `FlowComponent<P, C>` | Required, typed | Control flow (`Show`, `For`-like) |
| `VoidComponent<P>` | Forbidden | Leaf components (icons, inputs) |

```typescript
const Card: ParentComponent<{ title: string }> = (props) => {
  return (
    <div class="card">
      <h2>{props.title}</h2>
      {props.children}
    </div>
  );
};

const Icon: VoidComponent<{ name: string }> = (props) => {
  return <svg class={`icon-${props.name}`} />;
};
```

## Generic Components

The `Component` types cannot be used for generic components. Use function declarations instead:

```typescript
function List<T>(props: { items: T[]; render: (item: T) => JSX.Element }): JSX.Element {
  return <For each={props.items}>{props.render}</For>;
}

// Usage — T is inferred
<List items={users()} render={(user) => <span>{user.name}</span>} />
```

## Refs

Refs may be `undefined` before mount. Always account for this:

```typescript
const MyComponent: VoidComponent = () => {
  let inputRef: HTMLInputElement | undefined;

  onMount(() => {
    inputRef?.focus(); // Safe access after mount
  });

  return <input ref={inputRef} />;
};
```

Alternatively, use the definite assignment assertion in JSX: `ref={inputRef!}`.

## Composition Over Inheritance

Solid components are plain functions — compose them by passing components as props or using children:

```typescript
const Layout: ParentComponent<{ sidebar: JSX.Element }> = (props) => {
  return (
    <div class="layout">
      <aside>{props.sidebar}</aside>
      <main>{props.children}</main>
    </div>
  );
};

<Layout sidebar={<Navigation />}>
  <PageContent />
</Layout>
```

## Event Handling

Inline event handlers get automatic type inference. For extracted handlers, use `JSX.EventHandler`:

```typescript
const onInput: JSX.EventHandler<HTMLInputElement, InputEvent> = (event) => {
  // event.currentTarget is HTMLInputElement
  // event.target may be any element within
  console.log(event.currentTarget.value);
};
```

### Custom Events

Extend the JSX namespace:

```typescript
declare module "solid-js" {
  namespace JSX {
    interface CustomEvents {
      customClick: CustomEvent<{ id: string }>;
    }
  }
}
```

## Custom Directives

Register with `use:` prefix. Declare via the JSX namespace:

```typescript
declare module "solid-js" {
  namespace JSX {
    interface Directives {
      tooltip: string;
    }
  }
}

function tooltip(el: HTMLElement, accessor: () => string) {
  // Set up tooltip on el using accessor()
  onCleanup(() => { /* teardown */ });
}

// Usage
<div use:tooltip={"Hello!"} />
```
