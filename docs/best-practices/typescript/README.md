# Matt Pocock's TypeScript Best Practices

> A curated collection of TypeScript best practices, opinions, and patterns from [Matt Pocock](https://www.mattpocock.com/) and [Total TypeScript](https://www.totaltypescript.com/).

Matt Pocock is one of the most influential TypeScript educators. These documents capture his opinionated, production-tested guidance — not generic advice, but specific stances backed by reasoning.

## Core Choices

Foundational decisions that shape every TypeScript project.

| Guide | Summary |
|---|---|
| [Type vs Interface](type-vs-interface.md) | Default to `type`. Use `interface` only for `extends`. |
| [Enums & Alternatives](enums-alternatives.md) | Avoid enums. Use `as const` objects with derived unions. |
| [any & unknown](any-and-unknown.md) | Ban `any` by default. Know the two legitimate exceptions. |
| [TSConfig Cheat Sheet](tsconfig-cheat-sheet.md) | Recommended compiler options for every project shape. |

## Patterns

Type-level patterns that make code safer and more expressive.

| Guide | Summary |
|---|---|
| [Discriminated Unions](discriminated-unions.md) | Model states as unions — make illegal states unrepresentable. |
| [Generics Patterns](generics-patterns.md) | Three patterns: types-to-types, types-to-functions, inference. |
| [The `satisfies` Operator](satisfies-operator.md) | Five practical uses for type validation without losing inference. |
| [Essential Patterns](essential-patterns.md) | Branded types, globals, assertion functions, classes. |

## Architecture

How to organize and connect types across a codebase.

| Guide | Summary |
|---|---|
| [Type Organization](type-organization.md) | Colocate, share at folder level, or extract to a package. |
| [Deriving vs Decoupling](deriving-vs-decoupling.md) | Derive when tightly coupled. Decouple across concerns. |
| [Runtime Validation](runtime-validation.md) | Use Zod at trust boundaries. Skip it for controlled inputs. |

## Micro-Opinions

Small but specific stances on everyday TypeScript choices.

| Guide | Summary |
|---|---|
| [Micro-Opinions](micro-opinions.md) | Return types, `const` vs `let`, `T[]` vs `Array<T>`, method shorthand, `Function` type. |
