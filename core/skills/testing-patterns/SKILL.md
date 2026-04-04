---
name: Testing Patterns
description: Generic test-driven development practices and patterns applicable to any language or test framework.
---

# Testing Patterns

## TDD Cycle

1. **Red** -- Write a failing test for desired behavior. Confirm it fails for the right reason.
2. **Green** -- Minimal code to pass. No optimization yet.
3. **Refactor** -- Clean up while keeping tests green. Commit at each stage.

## Test Behavior, Not Implementation

Test *what* code does (public interface, observable outputs), not *how* (internal state, call counts). Implementation-coupled tests break on every refactor.

## Factory Pattern

```
function getMockUser(overrides = {}) {
  return { id: "user-1", email: "test@example.com", name: "Test User", role: "member", ...overrides };
}
const admin = getMockUser({ role: "admin" });
```

New required fields update the factory once, not every test.

## Organization

- Co-locate tests or mirror source structure. One test file per module (`module.test.ext`).
- Group with `describe`, name as sentences: `it("rejects expired tokens")`.

## Mocking Rules

- Prefer real dependencies (in-memory DB, local server) when feasible.
- Mock at boundaries only (external APIs, email, payments), not internal modules.
- Keep mocks minimal -- only methods your code calls. Reset between tests.
- Verify mocks match the real API. Update when APIs change.

## Test Pyramid

Many unit tests (fast, focused) > some integration tests (multi-component) > few E2E tests (full flow).

## Anti-Patterns

1. **Testing implementation** -- Asserting internal state or call counts breaks on refactors.
2. **Overmocking** -- If most of the test is mock setup, you're testing mocks.
3. **Copy-paste tests** -- Use factories and parameterized tests.
4. **No assertions** -- Worse than no test. False confidence.
5. **Ignoring flaky tests** -- Fix or delete; never skip indefinitely.
6. **Happy path only** -- Error cases and boundary conditions are where bugs live.
