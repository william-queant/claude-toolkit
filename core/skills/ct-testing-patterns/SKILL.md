---
name: ct-testing-patterns
description: Generic test-driven development practices and patterns applicable to any language or test framework.
---

# Testing Patterns

## TDD Cycle

1. **Red** -- Write a failing test for desired behavior. Confirm it fails for the right reason.
2. **Green** -- Minimal code to pass. No optimization yet.
3. **Refactor** -- Clean up while keeping tests green. Commit at each stage.

## 3-Layer Testing Strategy

```
          /  E2E  \           Real browsers, full user flows
         /----------\
        / Interaction \       Component sandbox, behavior, a11y
       /----------------\
      /      Unit        \    Pure logic, signals, utilities
     /--------------------\
```

| Layer       | Target Ratio | What to Cover                                                                |
| ----------- | ------------ | ---------------------------------------------------------------------------- |
| Unit        | ~70%         | Business logic, utilities, data transforms, reactive primitives, error paths |
| Interaction | ~20%         | Component variants, user interactions, accessibility, visual regression      |
| E2E         | ~10%         | Critical user journeys, authentication flows, cross-page workflows           |

### When to Use Which Layer

| Question                                          | Layer                                  |
| ------------------------------------------------- | -------------------------------------- |
| Does this logic need a DOM?                        | **Unit** if no, **Interaction** if yes |
| Does it involve multiple pages or navigation?      | **E2E**                                |
| Am I testing a single component's visual states?   | **Interaction**                        |
| Am I testing a reactive primitive (signal, memo)?  | **Unit**                               |
| Does it require authentication or real network?    | **E2E**                                |
| Am I testing component accessibility?              | **Interaction** (axe-core)             |
| Does it need the full server running?              | **E2E**                                |

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

## Shared Principles

- **Prefer role-based queries.** Use `getByRole`, `getByLabel`, `getByText` over test IDs or CSS selectors.
- **Never sleep.** Use framework-provided waiting mechanisms (`waitFor`, `findBy*`, web-first assertions).
- **One assertion focus per test.** Multiple assertions are fine if they verify facets of the same behavior.
- **Isolate tests.** No test should depend on another test's side effects. Reset state between tests.

## Mocking Rules

- Prefer real dependencies (in-memory DB, local server) when feasible.
- Mock at boundaries only (external APIs, email, payments), not internal modules.
- Keep mocks minimal -- only methods your code calls. Reset between tests.
- Verify mocks match the real API. Update when APIs change.

## Property-Based Testing

When a function has a contract ("for all valid inputs X, property Y holds"), use property-based tests to verify it across generated inputs instead of hand-picked examples:

```
// Instead of testing 3-4 specific inputs:
test("sort is idempotent", () => {
  fc.assert(fc.property(fc.array(fc.integer()), (arr) => {
    const sorted = mySort(arr);
    expect(mySort(sorted)).toEqual(sorted);
  }));
});
```

Good candidates: serialization round-trips, math properties, parsers, encoding/decoding, sorting invariants.

## Bun Test Runner

Bun includes a built-in test runner. Use `bun test` for projects on the Bun runtime:

```
bun test                    # run all *.test.ts files
bun test --watch            # re-run on changes
bun test --coverage         # with code coverage
bun test path/to/file.test.ts  # single file
```

Bun supports `describe`, `it`/`test`, `expect`, lifecycle hooks, and snapshot testing out of the box with no additional dependencies.

## Test Pyramid

See 3-Layer Testing Strategy above. Many unit tests (fast, focused) > some interaction tests (component sandbox) > few E2E tests (full flow). Aim for 70/20/10 distribution.

## Test Speed

Three levers recur across every runner (Vitest, Playwright, Storybook browser mode). Stated once here; each stack skill carries the framework-specific syntax.

- **Parallelism sized to the runner.** Enable file-level parallelism (Vitest `fileParallelism`, Playwright `fullyParallel`), but cap workers to the runner's *real* vCPUs (`"50%"` or a measured count). GitHub standard runners are 2 vCPU (private) / 4 (public); oversubscribing thrashes.
- **Shard across CI jobs, then merge the blob reports.** Sharding splits at the *file* level (`--shard=i/n`), so wall-clock is gated by the slowest shard -- balance file sizes. Always emit a blob report per shard (`--reporter=blob`) and merge it (`merge-reports` / `--merge-reports`) in a dependent job, or results and coverage are fragmented and incomplete.
- **Skip isolation where state is clean.** Per-file environment isolation is the safe default but the biggest run-speed cost. Disable it (Vitest `isolate: false`, `pool: 'threads'`) only for side-effect-free logic suites; keep it where tests mutate globals/env/timers.

Profile before tuning, and never `sleep` to mask timing -- use the framework's auto-waiting (see Shared Principles).

Per-runner config: `ct-vite-vitest-patterns`, `ct-playwright-patterns`, `ct-storybook-patterns`.

## Anti-Patterns

1. **Testing implementation** -- Asserting internal state or call counts breaks on refactors.
2. **Overmocking** -- If most of the test is mock setup, you're testing mocks.
3. **Copy-paste tests** -- Use factories and parameterized tests.
4. **No assertions** -- Worse than no test. False confidence.
5. **Ignoring flaky tests** -- Fix or delete; never skip indefinitely.
6. **Happy path only** -- Error cases and boundary conditions are where bugs live.
