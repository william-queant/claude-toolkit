# Testing Best Practices

> A curated collection of testing best practices for the rendezvous.nz stack, sourced from official documentation, framework maintainers, and the testing community as of 2026.

This project uses a **3-layer testing strategy** that maps to the classic testing pyramid. Each layer targets a different scope, runs in a different environment, and catches a different class of bugs.

```
          /  E2E  \           Playwright (real browsers)
         /----------\         Full user flows, cross-browser
        / Interaction \       Storybook (component sandbox)
       /----------------\     Component behavior, visual, a11y
      /      Unit        \    Vitest (Node/JSDOM)
     /--------------------\   Pure logic, signals, utilities
```

## The Three Layers

| Layer                                   | Tool             | Scope                                | Environment                            | Speed             |
| --------------------------------------- | ---------------- | ------------------------------------ | -------------------------------------- | ----------------- |
| [Unit](vitest-unit.md)                  | Vitest 4.x       | Functions, signals, hooks, utilities | Node / JSDOM                           | ~ms per test      |
| [Interaction](storybook-interaction.md) | Storybook 10.x   | Component rendering, behavior, a11y  | Real browser (via Vitest addon)        | ~100ms per story  |
| [E2E](playwright-e2e.md)                | Playwright 1.58+ | Full user flows, API integration     | Real browser (Chromium/Firefox/WebKit) | ~seconds per test |

## When to Use Which Layer

| Question                                                  | Layer                                  |
| --------------------------------------------------------- | -------------------------------------- |
| Does this logic need a DOM?                               | **Unit** if no, **Interaction** if yes |
| Does it involve multiple pages or navigation?             | **E2E**                                |
| Am I testing a single component's visual states?          | **Interaction**                        |
| Am I testing a reactive primitive (signal, memo, effect)? | **Unit**                               |
| Does it require authentication or real network?           | **E2E**                                |
| Am I testing component accessibility?                     | **Interaction** (axe-core addon)       |
| Am I testing cross-browser rendering?                     | **E2E** (multi-browser projects)       |
| Does it need the Cloudflare Worker running?               | **E2E**                                |

## Distribution Guideline

Aim for the pyramid shape -- many fast unit tests at the base, fewer interaction tests in the middle, and a focused set of E2E tests at the top.

| Layer       | Target Ratio | What to Cover                                                                |
| ----------- | ------------ | ---------------------------------------------------------------------------- |
| Unit        | ~70%         | Business logic, utilities, data transforms, reactive primitives, error paths |
| Interaction | ~20%         | Component variants, user interactions, accessibility, visual regression      |
| E2E         | ~10%         | Critical user journeys, authentication flows, cross-page workflows           |

## Shared Principles Across All Layers

1. **Test behavior, not implementation.** Assert what the user sees or what the API returns, not internal state.
2. **Prefer role-based queries.** Use `getByRole`, `getByLabel`, `getByText` over test IDs or CSS selectors.
3. **Never sleep.** Use framework-provided waiting mechanisms (`waitFor`, `findBy*`, web-first assertions).
4. **One assertion focus per test.** A test should verify one behavior. Multiple assertions are fine if they verify facets of the same behavior.
5. **Isolate tests.** No test should depend on another test's side effects. Reset state between tests.
6. **Mock at boundaries.** Mock network calls and external services, not internal modules.
7. **SolidJS reactivity rules apply in tests.** Never destructure props. Use `renderHook` or `createRoot` for signal testing.

## SolidJS-Specific Considerations

SolidJS components run once -- only reactive expressions re-execute. This affects testing:

- **`render()` takes a callback**: `render(() => <Component />)`, not `render(<Component />)`.
- **Effects are async**: Use `testEffect` from `@solidjs/testing-library` for effect assertions.
- **Storybook decorators need `createJSXDecorator`**: Standard decorators cause duplicate DOM elements with SolidJS.

## Technology Versions (as of April 2026)

| Tool                     | Version | Notes                                                |
| ------------------------ | ------- | ---------------------------------------------------- |
| Vitest                   | ^4.1.x  | V8 coverage, test tags, builder-pattern fixtures     |
| @solidjs/testing-library | ^0.8.x  | SolidJS-specific render, renderHook, testEffect      |
| Storybook                | ^10.3.x | ESM-only, `sb.mock`, testing widget                  |
| storybook-solidjs-vite   | ^10.0.x | Community-maintained SolidJS renderer                |
| @storybook/addon-vitest  | ^10.x   | Replaces old test-runner, uses Vitest browser mode   |
| Playwright               | ^1.58.x | Timeline view, Chrome for Testing, WebSocket mocking |
| @axe-core/playwright     | ^4.x    | WCAG 2.1 AA automated accessibility checks           |
| MSW                      | ^2.x    | Network mocking for both Storybook and Vitest        |

## Guides

| Guide                                                     | Summary                                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [Vitest Unit Testing](vitest-unit.md)                     | AAA pattern, signal testing, mocking, coverage, performance, anti-patterns.  |
| [Storybook Interaction Testing](storybook-interaction.md) | CSF 3, play functions, a11y, visual regression, MSW, portable stories.       |
| [Playwright E2E Testing](playwright-e2e.md)               | Page Objects, fixtures, auth, network mocking, CI/CD, flaky test prevention. |
