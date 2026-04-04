# Deriving vs Decoupling

> Source: [Deriving vs Decoupling: When NOT To Be A TypeScript Wizard](https://www.totaltypescript.com/deriving-vs-decoupling) — Matt Pocock

## The Distinction

- **Deriving** = creating a type that depends on another type's structure (`Pick`, `Omit`, `typeof`, mapped types)
- **Decoupling** = creating independent types with no dependency between them

The temptation to derive comes from TypeScript's powerful type manipulation. But cleverness isn't always correctness.

## When to Decouple

Decouple when types serve **different concerns** — different responsibilities with different reasons to change.

```typescript
// Database layer
type User = {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  passwordHash: string;
};

// UI layer — DON'T derive from User
type AvatarProps = {
  imageUrl: string;
  name: string;
};
```

Why not `Pick<User, "imageUrl" | "name">`? Because:
- `User` lives in database code; `AvatarProps` is UI logic
- They have different reasons to change
- If `User.imageUrl` is renamed to `User.avatarUrl`, should every UI component break? Probably not.
- The component should remain portable even if the data model moves

As Matt puts it: "It's smarter to do the simple thing."

## When to Derive

Derive when types share a **common concern** and are tightly coupled by design.

### From `as const` objects

```typescript
const albumTypes = {
  CD: "cd",
  VINYL: "vinyl",
  DIGITAL: "digital",
} as const;

type AlbumType = (typeof albumTypes)[keyof typeof albumTypes];
// "cd" | "vinyl" | "digital"
```

Maintaining a separate union and object would mean updating two places for every change — pure busywork.

### Related variants

```typescript
type User = {
  id: string;
  name: string;
  email: string;
};

type UserWithoutId = Omit<User, "id">;
```

These are directly related — a `UserWithoutId` is meaningless outside the context of `User`.

## Decision Framework

> "The decision to derive or decouple is all about reducing your future workload."

| Signal | Action |
|---|---|
| Changing one type should always change the other | **Derive** |
| Types serve different layers or concerns | **Decouple** |
| Derivation adds complexity for marginal DRY benefit | **Decouple** |
| Types share the same source of truth | **Derive** |
