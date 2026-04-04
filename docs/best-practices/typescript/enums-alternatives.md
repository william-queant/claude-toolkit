# Enums & Alternatives

> Source: [Why I Don't Like Enums](https://www.totaltypescript.com/why-i-dont-like-typescript-enums) — Matt Pocock

## The Verdict

**Avoid enums. Use `as const` objects with derived union types instead.**

## Why Enums Are Problematic

### 1. Numeric Enums Accept Raw Numbers

Numeric enums allow passing any raw number where an enum value is expected — completely defeating the purpose of type safety.

```typescript
enum Direction {
  Up,    // 0
  Down,  // 1
  Left,  // 2
  Right, // 3
}

function move(dir: Direction) {}

move(99); // No error! TypeScript allows this.
```

### 2. Inconsistent Behavior

Numeric and string enums behave differently:
- Numeric enums generate **bidirectional** mappings (value-to-key and key-to-value), doubling the runtime keys
- String enums enforce stricter type-checking but don't generate reverse mappings
- You can mix numeric and string values in a single enum (don't)

### 3. Nominal Typing

Enums use nominal typing — two enums with identical values are not interchangeable. This breaks from JavaScript's structural approach and creates surprising incompatibilities.

### 4. Implementation Bugs

The TypeScript repository has 71 open enum-related bug issues. The TS team has indicated many are architecturally unfixable.

## The Alternative: `as const` Objects

```typescript
const Direction = {
  Up: "up",
  Down: "down",
  Left: "left",
  Right: "right",
} as const;

type Direction = (typeof Direction)[keyof typeof Direction];
// "up" | "down" | "left" | "right"
```

This gives you:
- A runtime object for lookups (`Direction.Up`)
- A union type for type safety (`Direction`)
- No surprising behavior
- Standard JavaScript semantics

## If You Must Use Enums

Use **string enums only**. They behave more predictably, resemble the transpiled output more closely, and don't allow raw value assignment.

```typescript
enum Status {
  Active = "active",
  Inactive = "inactive",
}
```
