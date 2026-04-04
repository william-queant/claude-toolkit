# Testing Patterns

> Generic test-driven development practices and patterns applicable to any language or test framework.

**Type:** Core Skill (always included)
**Source:** [`core/skills/testing-patterns/SKILL.md`](../core/skills/testing-patterns/SKILL.md)

## Overview

Principles and patterns for writing tests that catch bugs, enable refactoring, and serve as documentation. These are framework-agnostic -- adapt the syntax to your project's test runner.

## TDD Cycle: Red, Green, Refactor

1. **Red** -- Write a failing test that describes the desired behavior. Confirm it fails for the right reason.
2. **Green** -- Write the minimal code to make the test pass. Do not optimize yet.
3. **Refactor** -- Improve the code while keeping all tests green. Remove duplication, improve naming, simplify logic.

Commit at each stage. The cycle keeps scope small and provides a safety net for every change.

## Key Principles

### Test Behavior, Not Implementation

Tests should describe *what* the code does, not *how* it does it internally.

- **Good:** "returns the user's full name when first and last name are provided"
- **Bad:** "calls `String.prototype.concat` with first name and space and last name"

### Factory Pattern for Test Data

Create factory functions that produce valid test objects with sensible defaults. Accept overrides for the fields relevant to each test.

```
function getMockUser(overrides = {}) {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    role: "member",
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

// Usage: only specify what matters for this test
const admin = getMockUser({ role: "admin" });
```

### Test File Organization

- **Co-locate tests with source** or mirror the source directory structure
- **One test file per module** -- name it `module.test.ext` or `module.spec.ext`
- **Group related tests** using `describe` blocks
- **Use descriptive test names** that read as sentences

### Mocking Strategies

- **Prefer real dependencies** when feasible (in-memory database, local test server)
- **Mock at boundaries** -- external services only, not internal modules
- **Keep mocks minimal** -- only mock the methods your code actually calls
- **Verify mock contracts** -- ensure mocks match real API behavior
- **Reset mocks between tests** -- prevent shared state and order-dependent failures

## Test Categories

| Category | Scope | Speed | Quantity |
|---|---|---|---|
| **Unit tests** | Single function or class | Fast | Many |
| **Integration tests** | Multiple components together | Slower | Some |
| **End-to-end tests** | Full user flow | Slowest | Few |

The ratio should be roughly pyramid-shaped: many unit tests, some integration tests, few E2E tests.

## Anti-patterns

| Anti-pattern | Description |
|---|---|
| **Testing implementation details** | Asserting on internal state or private methods. Breaks on every refactor. |
| **Overmocking** | When most of the test is mock setup, you are testing mocks, not code. |
| **Copy-paste test cases** | Duplicated test code becomes a maintenance burden. Use factories and parameterized tests. |
| **No assertions** | A test that runs code but asserts nothing provides false confidence. |
| **Ignoring flaky tests** | A sometimes-failing test is either wrong or exposing a real bug. Fix or delete it. |
| **Testing only the happy path** | Error cases, edge cases, and boundary conditions are where bugs live. |

## Trigger Conditions

- **Keywords:** `test`, `spec`, `tdd`, `mock`, `factory`
- **File patterns:** `**/*.test.ts`, `**/*.spec.ts`
- **Excludes:** "e2e", "end-to-end"
