# The `satisfies` Operator

> Source: [5 Ways to Use Satisfies in TypeScript](https://www.totaltypescript.com/how-to-use-satisfies-operator) — Matt Pocock

## What It Does

`satisfies` validates that a value conforms to a type **without widening the inferred type**. You get compile-time validation and narrow inference at the same time.

## 5 Practical Uses

### 1. Strongly Typed URL Search Parameters

`URLSearchParams` normally accepts loose `Record<string, string>`. Use `satisfies` to catch missing required fields:

```typescript
type GHIssueURLParams = {
  title: string;
  body: string;
};

const params = new URLSearchParams({
  title: "New Issue",
} satisfies GHIssueURLParams);
// Error: Property 'body' is missing
```

### 2. Strongly Typed POST Request Bodies

`JSON.stringify` erases type information. Validate the body shape before serialization:

```typescript
type Post = {
  title: string;
  content: string;
};

fetch("/api/posts", {
  method: "POST",
  body: JSON.stringify({
    title: "New Post",
    content: "Lorem ipsum.",
  } satisfies Post),
});
```

### 3. Inferring Tuples Without `as const`

Get tuple behavior with index bounds checking:

```typescript
type MoreThanOneMember = [any, ...any[]];

const tuple = [1, 2, 3] satisfies MoreThanOneMember;
const doesNotExist = tuple[3]; // Error: index out of bounds
```

### 4. Enforcing `as const` Object Shapes

Combine `as const` with `satisfies` to get immutable objects that must conform to a shape:

```typescript
type RouteConfig = Record<
  string,
  { url: string; searchParams: Record<string, string> }
>;

const routes = {
  home: { url: "/", searchParams: {} },
  about: { url: "/about", searchParams: {} },
} as const satisfies RouteConfig;

// routes.home.url is narrowed to "/" (not string)
// AND the shape is validated against RouteConfig
```

### 5. Enforcing `as const` Array Shapes

Validate recursive structures while preserving literal types:

```typescript
type NavElement = {
  title: string;
  url?: string;
  children?: readonly NavElement[];
};

const nav = [
  { title: "Home", url: "/" },
  {
    title: "About",
    children: [{ title: "Team", url: "/about/team" }],
  },
] as const satisfies readonly NavElement[];
```

**Important:** Array properties in the type must be marked `readonly` to align with `as const`'s immutability.

## When to Reach for `satisfies`

Use it when you need **both** validation against a type **and** narrow inference of the actual value. If you only need one or the other, a regular type annotation or `as const` alone is sufficient.
