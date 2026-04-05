---
name: ct-playwright-patterns
description: Playwright E2E testing patterns -- Page Objects, fixtures, auth, network mocking, and CI/CD
---

# Playwright E2E Patterns

E2E tests sit at the top of the testing pyramid. They exercise full user journeys in real browsers. Write fewer, make each one count.

## Project Structure

```
e2e/
  fixtures/          # Custom Playwright fixtures
    index.ts         # Extended test with page objects
  pages/             # Page Object classes
  components/        # Component Object classes (reusable fragments)
  specs/             # Test files organized by feature
  helpers/           # Utilities (data factories, API helpers)
  .auth/             # storageState files (gitignored)
```

## Page Object Model + Fixtures

Combine Page Objects with custom fixtures. Tests receive pre-built page objects:

```typescript
// e2e/pages/LoginPage.ts
export class LoginPage {
  private readonly emailInput: Locator;
  private readonly submitButton: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByLabel("Email");
    this.submitButton = page.getByRole("button", { name: "Sign in" });
  }

  async goto() { await this.page.goto("/login"); }
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.submitButton.click();
  }
}

// e2e/fixtures/index.ts
export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); },
});
```

Fixtures are lazy (created on demand) and composable (can depend on each other).

## Authentication

Use project dependencies with `storageState` to authenticate once and reuse:

```typescript
// e2e/auth.setup.ts
setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("test@example.com");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
```

Config: `dependencies: ["setup"]` + `storageState: "e2e/.auth/user.json"`. Add `e2e/.auth/` to `.gitignore`.

For multi-role testing, create separate setup files per role.

## Locator Priority

1. `getByRole()` -- accessibility semantics, survives refactors
2. `getByLabel()` -- form elements
3. `getByPlaceholder()` -- input hints
4. `getByText()` -- visible text
5. `getByTestId()` -- stable but less semantic
6. CSS/XPath -- **avoid**

## Web-First Assertions

Always use auto-retrying assertions:

```typescript
// GOOD
await expect(page.getByRole("alert")).toBeVisible();
await expect(page).toHaveURL("/dashboard");

// BAD -- checks once, no retry
expect(await page.getByRole("alert").isVisible()).toBeTruthy();
```

Key assertions: `toBeVisible()`, `toBeEnabled()`, `toHaveText()`, `toHaveURL()`, `toHaveCount()`, `toHaveScreenshot()`, `toMatchAriaSnapshot()`.

## Network Mocking

```typescript
// Mock API
await page.route("**/api/users", async (route) => {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ name: "Alice" }]) });
});

// Block analytics
await page.route("**/analytics/**", (route) => route.abort());
```

Mock ~80% of API calls for speed; keep ~20% hitting real endpoints. Always call `route.continue()`, `route.fulfill()`, or `route.abort()`. Use `page.unrouteAll()` in cleanup.

## WebSocket Mocking (v1.53+)

```typescript
await page.routeWebSocket("wss://example.com/ws", (ws) => {
  ws.onMessage((message) => { ws.send("mocked response"); });
});
```

## Accessibility Testing

```typescript
import AxeBuilder from "@axe-core/playwright";

test("WCAG 2.1 AA", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
});
```

Aria snapshots (v1.52+): `await expect(nav).toMatchAriaSnapshot(...)`.

## Parallelization

- File-level parallel (default) -- start here
- In-file: `test.describe.configure({ mode: "parallel" })`
- Full: `fullyParallel: true` in config

Each worker gets its own `BrowserContext` (isolated cookies/storage). Use `mode: "serial"` sparingly.

## CI/CD

- Use official Playwright Docker image (`mcr.microsoft.com/playwright:v1.58.0-noble`)
- Upload reports + traces as artifacts
- Use `--shard` for suites exceeding 5 minutes
- `retries: process.env.CI ? 2 : 0`
- Traces: `trace: "on-first-retry"`

## Flaky Test Prevention

| Cause | Fix |
|---|---|
| `waitForTimeout()` | Web-first assertions or `waitForResponse` |
| Brittle selectors | `getByRole`, `getByLabel`, `getByTestId` |
| Shared state | Fresh `BrowserContext` per test |
| External API flakiness | Mock with `page.route()` |
| Animation timing | `--force-prefers-reduced-motion` |
| Missing `await` | #1 source of false-passing tests. Lint for it. |

## Anti-Patterns

1. **Using `waitForTimeout()`** -- Use web-first assertions or explicit wait conditions.
2. **Fragile CSS/XPath selectors** -- Use role-based and semantic locators.
3. **Using `{ force: true }`** -- Masks real actionability problems.
4. **Missing `await` on assertions** -- #1 source of false-passing tests.
5. **Tests without assertions** -- A test that clicks without asserting is just a script.
6. **Using Playwright for unit tests** -- Use Vitest for pure logic.
7. **Committing raw codegen output** -- Always refactor into Page Objects.
8. **Not cleaning up route handlers** -- Use `page.unrouteAll()`.
