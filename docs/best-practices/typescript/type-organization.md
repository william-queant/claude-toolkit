# Type Organization

> Source: [Where To Put Your Types in Application Code](https://www.totaltypescript.com/where-to-put-your-types-in-application-code) — Matt Pocock

## Three Rules

### Rule 1: Colocate Single-Use Types

When a type is used in only one place, put it in the same file where it's used.

```typescript
// components/Avatar.tsx
type AvatarProps = {
  imageUrl: string;
  name: string;
};

export function Avatar({ imageUrl, name }: AvatarProps) {
  // ...
}
```

Don't extract single-use types into separate files. It's low-cost to refactor later if the type grows in scope. Inlining is fine for truly single-use types.

### Rule 2: Share Types Across Modules

When a type serves multiple files, move it to a shared `*.types.ts` file at the appropriate level:

- **App-wide types** → `src/types.ts` or `src/shared.types.ts`
- **Folder-specific types** → `src/features/auth/auth.types.ts`

This mirrors how you'd handle shared functions — keep them at the narrowest scope that covers all consumers.

```
src/
├── types.ts                    # App-wide types
├── features/
│   ├── auth/
│   │   ├── auth.types.ts       # Shared within auth feature
│   │   ├── login.tsx
│   │   └── signup.tsx
│   └── billing/
│       ├── billing.types.ts
│       └── invoice.tsx
```

### Rule 3: Monorepo-Level Sharing

In a monorepo, types used across multiple packages go in a dedicated shared package:

```
packages/
├── types/                      # Shared types package
│   └── src/
│       └── index.ts
├── web-app/
│   └── src/
└── api/
    └── src/
```

## Core Principle

Share types across the **smallest number of modules** that require them. Don't pre-extract types "just in case" — colocate by default and widen scope only when a second consumer appears.
