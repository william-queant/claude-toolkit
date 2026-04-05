# Vitest Unit Testing

> Sources: [Vitest 4.0 Announcement](https://voidzero.dev/posts/announcing-vitest-4), [Vitest 4.1 Blog](https://main.vitest.dev/blog/vitest-4-1), [Vitest Docs](https://vitest.dev/), [SolidJS Testing Docs](https://docs.solidjs.com/guides/testing), [@solidjs/testing-library](https://github.com/solidjs/solid-testing-library)

Unit tests form the base of the testing pyramid. They are fast, isolated, and cover pure logic, reactive primitives, and component behavior in a JSDOM environment.

## AAA Pattern

Every test follows **Arrange-Act-Assert**. Keep each phase visually distinct:

```typescript
it("should format currency correctly", () => {
  // Arrange
  const amount = 1234.5;

  // Act
  const result = formatCurrency(amount, "NZD");

  // Assert
  expect(result).toBe("$1,234.50");
});
```

For simple tests, the phases can be implicit. For complex tests, add blank lines between them.

## Naming Conventions

- **Files**: `*.test.ts` / `*.test.tsx`, co-located with source or in `tests/`
- **Describe blocks**: Name the unit under test (`describe("formatCurrency", ...)`)
- **It blocks**: Describe behavior, not implementation ("should return loading state when resource is pending", not "should set isLoading to true")

## Testing SolidJS Components

### render() Takes a Callback

This is different from React Testing Library. SolidJS needs the callback form to establish a reactive root:

```tsx
import { render, screen } from "@solidjs/testing-library";
import { Button } from "../src/components/Button";

it("should render button text", () => {
  render(() => <Button label="Click me" />);
  expect(screen.getByRole("button")).toHaveTextContent("Click me");
});
```

### Testing Signals with renderHook

For hooks/composables that return reactive state:

```typescript
import { renderHook } from "@solidjs/testing-library";
import { useCounter } from "../src/hooks/useCounter";

it("should increment counter", () => {
  const { result } = renderHook(useCounter);
  expect(result.count).toBe(0);
  result.increment();
  expect(result.count).toBe(1);
});
```

### Testing Signals with createRoot

For primitives that don't need component context, `createRoot` is sufficient and faster:

```typescript
import { createRoot, createSignal, createMemo } from "solid-js";

it("should compute derived value", () => {
  createRoot((dispose) => {
    const [count, setCount] = createSignal(0);
    const doubled = createMemo(() => count() * 2);

    expect(doubled()).toBe(0);
    setCount(5);
    expect(doubled()).toBe(10);

    dispose();
  });
});
```

### Testing Effects with testEffect

Effects are async in SolidJS. The `testEffect` utility provides a `done` callback for async assertion:

```typescript
import { testEffect } from "@solidjs/testing-library";
import { createSignal, createEffect } from "solid-js";

it("should react to signal changes", () => {
  const [value, setValue] = createSignal(0);

  return testEffect((done) =>
    createEffect((run: number = 0) => {
      if (run === 0) {
        expect(value()).toBe(0);
        setValue(1);
      } else if (run === 1) {
        expect(value()).toBe(1);
        done();
      }
      return run + 1;
    })
  );
});
```

### Testing Resources (createResource)

Resources trigger Suspense. Wrap in `<Suspense>` and assert loading/data/error states:

```tsx
import { render, screen } from "@solidjs/testing-library";
import { Suspense } from "solid-js";

it("should show loading then data", async () => {
  render(() => (
    <Suspense fallback={<div>Loading...</div>}>
      <MyResourceComponent />
    </Suspense>
  ));

  expect(screen.getByText("Loading...")).toBeInTheDocument();
  expect(await screen.findByText("Data loaded")).toBeInTheDocument();
});
```

## Mocking Strategies

### Decision Framework

| Scenario | Tool |
|---|---|
| Replace entire module | `vi.mock("module")` |
| Spy on a specific method | `vi.spyOn(obj, "method")` |
| Network requests | MSW (`msw/node`) |
| Vary mock per test | `vi.hoisted` + `mockReturnValue` |
| Non-hoisted dynamic mock | `vi.doMock` |

### vi.mock with vi.hoisted (Recommended Pattern)

`vi.hoisted` lets you declare mock references that are accessible inside `vi.mock` (which is hoisted to the top of the file):

```typescript
const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.mock("../src/api/client", () => ({
  fetchData: mockFetch,
}));

it("should handle API error", () => {
  mockFetch.mockRejectedValue(new Error("Network error"));
  // ... test
});
```

### vi.spyOn for Partial Mocking

When you only need to intercept one method while keeping the rest real:

```typescript
import * as utils from "../src/utils";

it("should call logger", () => {
  const spy = vi.spyOn(utils, "log");
  doSomething();
  expect(spy).toHaveBeenCalledWith("action completed");
  spy.mockRestore();
});
```

### MSW for Network Mocking

Mock Service Worker intercepts at the network level, giving realistic integration tests:

```typescript
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer(
  http.get("/api/user", () => HttpResponse.json({ name: "Alice" }))
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it("should display user name", async () => {
  render(() => <UserProfile />);
  expect(await screen.findByText("Alice")).toBeInTheDocument();
});
```

### mockThrow / mockThrowOnce (Vitest 4.1+)

Concise error path testing without wrapping in functions:

```typescript
mockFn.mockThrow(new Error("failed"));
mockFn.mockThrowOnce(new Error("first call fails"));
```

### Type-Safe Mocks

Use `vi.mocked()` for typed access to mocked functions:

```typescript
import { fetchUser } from "../src/api";
vi.mock("../src/api");

const mockedFetchUser = vi.mocked(fetchUser);
mockedFetchUser.mockResolvedValue({ name: "Alice" });
```

## Snapshot Testing

### When to Use

- Serialized objects, API response shapes, configuration objects
- Small component output (buttons, cards, form fields)

### When NOT to Use

- Large pages or complex component trees
- Frequently changing UI
- Dynamic content (timestamps, IDs, random values)

### Prefer Inline Snapshots

Keeps expected output visible in the test file:

```typescript
expect(formatUser(user)).toMatchInlineSnapshot(`
  {
    "name": "Alice",
    "role": "admin",
  }
`);
```

### Handle Dynamic Values

```typescript
expect(result).toMatchObject({
  id: expect.any(String),
  createdAt: expect.any(Date),
  name: "Alice",
});
```

### Snapshot Hygiene

- Review snapshot diffs as carefully as code diffs in PRs
- Run `vitest --update` only intentionally, never blindly
- CI should fail on obsolete snapshots

## Type Testing

Vitest has built-in type testing (since 2.1). Verify your types work correctly alongside runtime:

```typescript
import { expectTypeOf } from "vitest";

it("should return correct type", () => {
  const result = parseConfig(rawConfig);
  expectTypeOf(result).toEqualTypeOf<AppConfig>();
  expectTypeOf(result.port).toBeNumber();
});
```

## Coverage

### Use V8 Provider

Since Vitest 3.2, V8 coverage uses AST-based remapping that matches Istanbul accuracy with ~10% overhead vs Istanbul's ~300%. Always use V8:

```typescript
// vite.config.ts
test: {
  coverage: {
    provider: "v8",
    include: ["src/**/*.{ts,tsx}"],
    exclude: [
      "src/**/*.css.ts",      // vanilla-extract style files
      "src/**/index.ts",       // barrel exports
      "src/**/*.d.ts",         // type declarations
      "src/locales/**",        // i18n generated files
    ],
    reporter: ["text", "html", "lcov"],
    thresholds: {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
}
```

### Coverage Recommendations

- Start with moderate thresholds (70-80%) and ratchet up as coverage grows
- Focus on **branch coverage** -- it catches more real bugs than line coverage
- Use per-glob overrides for critical paths (e.g., `src/utils/**` at 95%)
- Use `/* v8 ignore start */` / `/* v8 ignore stop */` for intentionally uncovered code

## Vitest 4.x Features

### Test Tags

Define tags with per-tag configuration. Useful for separating fast/slow tests:

```typescript
// vite.config.ts
test: {
  tags: {
    slow: { timeout: 30_000 },
    flaky: { retry: 3 },
  },
}
```

```typescript
it.tags(["slow"])("should process large dataset", async () => {
  // ...
});
```

### Builder-Pattern Fixtures

The idiomatic way to share setup in Vitest 4.x. TypeScript infers fixture types automatically:

```typescript
const myTest = test
  .extend({ config: { timeout: 5000 } })
  .extend({
    server: async ({ config }, { onCleanup }) => {
      const srv = await startServer(config);
      onCleanup(() => srv.close());
      return srv;
    },
  });

myTest("should connect to server", ({ server }) => {
  expect(server.isRunning()).toBe(true);
});
```

### Detect Async Leaks

Reports leaked async resources with source locations. Enable while debugging:

```typescript
test: {
  detectAsyncLeaks: true, // Disable in CI (adds overhead)
}
```

## Performance

### Pool Configuration

| Pool | Best For |
|---|---|
| `threads` (default) | General use, SolidJS + JSDOM tests |
| `forks` | Better isolation, more overhead |
| `vmThreads` | VM contexts with worker parallelism |

### Sharding for CI

Split tests across CI machines:

```bash
# Machine 1
vitest run --shard=1/3 --reporter=blob

# Machine 2
vitest run --shard=2/3 --reporter=blob

# Machine 3
vitest run --shard=3/3 --reporter=blob

# Merge
vitest merge-reports
```

### Other Tips

- Use `test.concurrent` for independent async tests
- Keep test files small and focused (Vitest parallelizes at the file level)
- Avoid heavy setup in `beforeAll` that could be lazy-loaded
- Use `--no-isolate` only for pure function test files, never for component tests

## Recommended Config

```typescript
// vite.config.ts (test section)
test: {
  environment: "jsdom",
  globals: true,
  setupFiles: ["./tests/setup.ts"],
  include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
  restoreMocks: true,
  coverage: {
    provider: "v8",
    include: ["src/**/*.{ts,tsx}"],
    exclude: [
      "src/**/*.css.ts",
      "src/**/index.ts",
      "src/**/*.d.ts",
      "src/locales/**",
    ],
    reporter: ["text", "html", "lcov"],
    thresholds: {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
}
```

```typescript
// tests/setup.ts
import "@testing-library/jest-dom/vitest";

afterEach(() => {
  vi.clearAllTimers();
});
```

## Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| Testing implementation details (internal state, private methods) | Test behavior and public API only |
| Large snapshots (100+ lines) | Break into small focused snapshots or use explicit assertions |
| Blind `--update` on snapshot failures | Review each diff individually |
| `vi.mock` without cleanup | Enable `restoreMocks: true` in config |
| Shared mutable state across tests | Reset state in `beforeEach` or use fixtures |
| Testing framework code (that SolidJS reactivity works) | Test your logic, not the framework |
| `setTimeout` in tests for async waits | Use `waitFor`, `findBy*`, or `vi.advanceTimersByTime` |
| Over-mocking (mocking everything) | Mock only external boundaries (network, timers, platform APIs) |
| Destructuring SolidJS props in tests | Same rule as production -- never destructure props |
| Using `as any` in test code | If you need it, the API under test is wrong |
