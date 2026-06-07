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

## WebSocket Mocking (v1.48+)

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

Aria snapshots (v1.49+): `await expect(nav).toMatchAriaSnapshot(...)`.

## Parallelization

- File-level parallel (default) -- start here
- In-file: `test.describe.configure({ mode: "parallel" })`
- Full: `fullyParallel: true` in config

Each worker gets its own `BrowserContext` (isolated cookies/storage). Use `mode: "serial"` sparingly.

## Test Speed

> _Verified against Playwright 1.5x (2026-06)._

E2E wall-clock is dominated by browser launches and UI setup. Three levers: maximize parallelism, seed state over HTTP, fan out across CI.

```typescript
// playwright.config.ts
export default defineConfig({
  fullyParallel: true,                          // parallelize within files, not just across them
  workers: process.env.CI ? "50%" : undefined,  // track the runner's real vCPUs; undefined = 50% cores locally
  webServer: {
    command: "npm run preview",                 // prebuilt/preview server, not a dev build
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,       // reuse on local reruns; CI always boots fresh
    timeout: 120_000,
  },
});
```

> Don't hardcode `workers` to a number larger than the runner. GitHub standard runners are 2 vCPU (private) / 4 (public); oversubscribing thrashes. `"50%"` (or a count you've matched to the runner) is portable.

**Seed state over HTTP, not the UI.** Driving the browser to create fixtures/auth is the costliest per-test work. Do it once in the `setup` project via the `request` fixture (no browser, no UI clicks), then reuse `storageState` — same project-dependency pattern this stack already uses for UI login:

```typescript
// e2e/auth.setup.ts  (consumed via dependencies: ["setup"] + storageState in config)
import { test as setup } from "@playwright/test";

setup("authenticate via API", async ({ request }) => {
  await request.post("/api/login", {
    data: { email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD },
  });
  await request.storageState({ path: "e2e/.auth/user.json" });
});
```

The `request` fixture is a full HTTP client (it wraps `apiRequest.newContext()` under the hood) and carries cookies set by the response — no manual context to dispose. Keep credentials in env/secrets, never literals, and keep `e2e/.auth/` gitignored (it holds live session tokens).

**Shard across CI runners** (blob reporter + `merge-reports`, v1.37+):

```yaml
strategy:
  matrix: { shard: [1, 2, 3, 4] }
steps:
  - run: npx playwright test --shard=${{ matrix.shard }}/4
# reporter: process.env.CI ? "blob" : "html"  in config
# upload blob-report/, then a dependent job:
  - run: npx playwright merge-reports --reporter=html ./all-blob-reports
```

Shards stay balanced only when `fullyParallel: true` lets Playwright split at the test level; otherwise file-level granularity leaves wall-clock gated by the slowest shard.

| Lever | Effect |
|---|---|
| `fullyParallel: true` + `workers` | Near-linear speedup up to vCPU count |
| `request` fixture seeding | Cuts per-test setup from seconds to ms |
| `--shard=i/n` across runners | ~total/n with `fullyParallel`; uneven (gated by slowest shard) without it |
| `trace: "on-first-retry"` | No trace cost on the passing path |

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
9. **Logging in / seeding data through the UI per test** -- Use the `request` fixture (or `context.request`) to seed state over HTTP, save it to `storageState`, reuse via project `dependencies`.
10. **Hardcoding `workers` above the runner's vCPUs on CI** -- Defaults to 50% of *logical* cores; throttled/oversubscribed runners thrash. Use `"50%"` or pin to the runner's real vCPU count.
11. **`--shard` without the blob reporter + `merge-reports`** -- Produces fragmented/duplicate reports instead of one merged HTML.
12. **Booting a dev server (HMR/rebuild) as the `webServer` target** -- Point CI at a prebuilt preview build.

## See Also

- `ct-testing-patterns` — the canonical cross-runner test-speed rule (parallelism sized to the runner, file-level `--shard` + blob/merge-reports).
- `ct-vite-vitest-patterns` — shares the CI sharding/worker budget; don't oversubscribe a runner running both.
