---
name: Testing Patterns
description: Generic test-driven development practices and patterns applicable to any language or test framework.
---

# Testing Patterns

Principles and patterns for writing tests that catch bugs, enable refactoring, and serve as documentation. These are framework-agnostic -- adapt the syntax to your project's test runner.

## TDD Cycle: Red, Green, Refactor

1. **Red.** Write a failing test that describes the desired behavior. Run it. Confirm it fails for the right reason.
2. **Green.** Write the minimal code to make the test pass. Do not optimize or clean up yet.
3. **Refactor.** Improve the code (production and test) while keeping all tests green. Remove duplication, improve naming, simplify logic.

Commit at each stage. The cycle keeps scope small and provides a safety net for every change.

## Test Behavior, Not Implementation

Tests should describe *what* the code does, not *how* it does it internally.

- **Good:** "returns the user's full name when first and last name are provided"
- **Bad:** "calls `String.prototype.concat` with first name and space and last name"

When tests are coupled to implementation, every refactor breaks tests without any actual bug. Test the public interface and observable outputs.

## Factory Pattern for Test Data

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

Benefits:
- Tests clearly show which fields matter for the scenario.
- Adding a new required field to the type only requires updating the factory, not every test.
- Reduces noise -- readers focus on the relevant data.

## Test File Organization

- **Co-locate tests with source** or mirror the source directory structure under a `tests/` directory. Either convention works; be consistent.
- **One test file per module.** Name it `module.test.ext` or `module.spec.ext`.
- **Group related tests** using `describe` blocks (or your framework's equivalent). Group by method, feature, or scenario.
- **Use descriptive test names** that read as sentences: `it("rejects expired tokens")` not `it("test3")`.

## Mocking Strategies

Mocks are a tool of last resort. Overuse makes tests brittle and less trustworthy.

- **Prefer real dependencies** when feasible. Use an in-memory database, a local test server, or the actual module.
- **Mock at boundaries.** Mock external services (HTTP APIs, email providers, payment gateways), not internal modules.
- **Keep mocks minimal.** Only mock the methods your code actually calls. Do not replicate the full interface.
- **Verify mock contracts.** When mocking an external API, ensure your mock matches the real API's behavior. Update mocks when the API changes.
- **Reset mocks between tests.** Shared mock state causes flaky tests and order-dependent failures.

## Test Categories

- **Unit tests.** Test a single function or class in isolation. Fast, focused, many of these.
- **Integration tests.** Test multiple components working together (e.g., API route to database). Slower, fewer of these.
- **End-to-end tests.** Test the full user flow through the real system. Slowest, fewest of these.

The ratio should be roughly pyramid-shaped: many unit tests, some integration tests, few E2E tests.

## Anti-patterns

- **Testing implementation details.** Asserting on internal state, private methods, or the number of times a function was called. These break on every refactor.
- **Overmocking.** When most of the test is mock setup, you are testing your mocks, not your code.
- **Copy-paste test cases.** Duplicated test code becomes a maintenance burden. Use factories, helper functions, and parameterized tests.
- **No assertions.** A test that runs code but asserts nothing is worse than no test -- it provides false confidence.
- **Ignoring flaky tests.** A test that sometimes fails is either wrong or exposing a real bug. Fix or delete it; never skip indefinitely.
- **Testing only the happy path.** Error cases, edge cases, and boundary conditions are where bugs live. Test them explicitly.
