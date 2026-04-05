# Playwright E2E Testing

> Sources: [Playwright Release Notes](https://playwright.dev/docs/release-notes), [Playwright Best Practices](https://playwright.dev/docs/best-practices), [Playwright Docs](https://playwright.dev/docs/intro), [TestDino Guides](https://testdino.com/blog/playwright-best-practices/)

E2E tests sit at the top of the testing pyramid. They exercise full user journeys in real browsers -- navigation, authentication, API integration, and cross-browser rendering. Write fewer of them, but make each one count.

## Project Structure

```
e2e/
  fixtures/          # Custom Playwright fixtures
    index.ts         # Extended test with page objects
  pages/             # Page Object classes
    LoginPage.ts
    DashboardPage.ts
  components/        # Component Object classes (reusable fragments)
    Header.ts
    Modal.ts
  specs/             # Test files organized by feature
    auth.spec.ts
    dashboard.spec.ts
  helpers/           # Utilities (data factories, API helpers)
  .auth/             # storageState files (gitignored)
```

## Page Object Model + Fixtures

Combine Page Objects with Playwright's custom fixtures. Tests receive pre-built page objects without manual instantiation:

### Page Object

```typescript
// e2e/pages/LoginPage.ts
import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";

export class LoginPage {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByLabel("Password");
    this.submitButton = page.getByRole("button", { name: "Sign in" });
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectVisible() {
    await expect(this.emailInput).toBeVisible();
  }
}
```

### Custom Fixtures

```typescript
// e2e/fixtures/index.ts
import { test as base } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";

interface Fixtures {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
}

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
});

export { expect } from "@playwright/test";
```

### Using in Tests

```typescript
// e2e/specs/auth.spec.ts
import { test, expect } from "../fixtures";

test("should login successfully", async ({ loginPage, dashboardPage, page }) => {
  await loginPage.goto();
  await loginPage.login("user@example.com", "password");
  await expect(page).toHaveURL("/dashboard");
  await dashboardPage.expectWelcomeMessage("user@example.com");
});
```

Fixtures are **lazy** (only created when requested) and **composable** (can depend on each other).

## Authentication Handling

Use **project dependencies** with `storageState` to authenticate once and reuse across all tests:

### Setup File

```typescript
// e2e/auth.setup.ts
import { test as setup, expect } from "@playwright/test";

const authFile = "e2e/.auth/user.json";

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("test@example.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/dashboard");
  await page.context().storageState({ path: authFile });
});
```

### Config

```typescript
// playwright.config.ts (projects section)
projects: [
  { name: "setup", testMatch: /.*\.setup\.ts/ },
  {
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      storageState: "e2e/.auth/user.json",
    },
    dependencies: ["setup"],
  },
],
```

### Multi-Role Testing

Separate setup files for different roles:

```typescript
// e2e/admin.setup.ts -> e2e/.auth/admin.json
// e2e/user.setup.ts  -> e2e/.auth/user.json

projects: [
  { name: "admin-setup", testMatch: /admin\.setup\.ts/ },
  { name: "user-setup", testMatch: /user\.setup\.ts/ },
  {
    name: "admin-tests",
    use: { storageState: "e2e/.auth/admin.json" },
    dependencies: ["admin-setup"],
  },
  {
    name: "user-tests",
    use: { storageState: "e2e/.auth/user.json" },
    dependencies: ["user-setup"],
  },
],
```

Add `e2e/.auth/` to `.gitignore`. Session tokens expire -- the setup re-runs each CI pipeline.

## Network Mocking

### Route Interception

```typescript
// Mock API response
await page.route("**/api/users", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([{ name: "Alice" }]),
  });
});

// Modify a real response
await page.route("**/api/config", async (route) => {
  const response = await route.fetch();
  const body = await response.json();
  body.featureFlag = true;
  await route.fulfill({ response, body: JSON.stringify(body) });
});

// Block requests (analytics, tracking)
await page.route("**/analytics/**", (route) => route.abort());
```

### Protobuf Responses

Since this project uses Protobuf, fulfill with encoded buffers:

```typescript
import { UserResponse } from "../src/generated/proto";

await page.route("**/api/user", async (route) => {
  const encoded = UserResponse.encode({ name: "Alice" }).finish();
  await route.fulfill({
    status: 200,
    contentType: "application/octet-stream",
    body: Buffer.from(encoded),
  });
});
```

### HAR Recording/Playback

For deterministic replay of complex API interactions:

```typescript
// Record
await page.routeFromHAR("e2e/fixtures/api.har", { update: true });

// Playback
await page.routeFromHAR("e2e/fixtures/api.har");
```

### WebSocket Mocking (v1.53+)

```typescript
await page.routeWebSocket("wss://example.com/ws", (ws) => {
  ws.onMessage((message) => {
    ws.send("mocked response");
  });
});
```

### API Testing Without a Browser

```typescript
test("API health check", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
});
```

**Best practice:** Mock ~80% of API calls for speed; keep ~20% hitting real endpoints for integration confidence. Always call `route.continue()`, `route.fulfill()`, or `route.abort()` -- never leave a handler hanging. Use `page.unrouteAll()` in cleanup.

## Assertions

### Web-First Assertions (Always Prefer These)

Web-first assertions auto-retry until the condition is met or timeout:

```typescript
// GOOD -- auto-retrying
await expect(page.getByRole("alert")).toBeVisible();
await expect(page.getByRole("heading")).toHaveText("Dashboard");
await expect(page).toHaveURL("/dashboard");
await expect(page).toHaveTitle(/Dashboard/);
await expect(page.getByTestId("count")).toHaveText("5");

// BAD -- checks once, no retry
expect(await page.getByRole("alert").isVisible()).toBeTruthy();
```

### Key Web-First Assertions

| Assertion | Purpose |
|---|---|
| `toBeVisible()` / `toBeHidden()` | Element visibility |
| `toBeEnabled()` / `toBeDisabled()` | Form element state |
| `toHaveText()` / `toContainText()` | Text content |
| `toHaveURL()` / `toHaveTitle()` | Page navigation |
| `toHaveCount()` | List length |
| `toHaveScreenshot()` | Visual comparison |
| `toMatchAriaSnapshot()` | Accessibility structure |

### Soft Assertions

Continue test after failure, report all at end:

```typescript
await expect.soft(page.getByTestId("status")).toHaveText("Active");
await expect.soft(page.getByTestId("count")).toHaveText("5");
```

### Custom Timeout

```typescript
await expect(page.getByRole("alert")).toBeVisible({ timeout: 10_000 });
```

## Locator Priority

Use the most resilient locator available:

1. **`getByRole()`** -- accessibility semantics, survives refactors
2. **`getByLabel()`** -- form elements by associated label
3. **`getByPlaceholder()`** -- input hints
4. **`getByText()`** -- visible text content
5. **`getByTestId()`** -- explicit contract, stable but less semantic
6. **CSS/XPath** -- **avoid** unless no alternative

## Test Isolation and Parallelization

### Parallelism Levels

| Level | How | When |
|---|---|---|
| File-level (default) | Files run in parallel, tests within a file run sequentially | Start here |
| In-file | `test.describe.configure({ mode: "parallel" })` | Independent tests within a describe |
| Full | `fullyParallel: true` in config | All tests properly isolated |

Each worker gets its own browser instance and `BrowserContext` -- cookies, localStorage, and sessionStorage are isolated automatically.

### Worker Tuning

```typescript
workers: process.env.CI ? 4 : undefined, // undefined = half CPU cores locally
fullyParallel: true,
retries: process.env.CI ? 2 : 0,
```

Use `test.describe.configure({ mode: "serial" })` sparingly -- only for flows where one test depends on state from another.

## Visual Comparison Testing

Built-in, no plugins needed:

```typescript
// Full page
await expect(page).toHaveScreenshot("homepage.png");

// Element-level
await expect(page.getByTestId("sidebar")).toHaveScreenshot("sidebar.png");

// Mask dynamic content
await expect(page).toHaveScreenshot("dashboard.png", {
  mask: [page.getByTestId("timestamp"), page.getByTestId("avatar")],
});
```

### Best Practices

- Run visual tests in CI with a fixed Docker image (avoid font rendering differences)
- Use `--update-snapshots` only when UI changes are intentional
- Commit baseline images and review in PRs like code
- On failure, Playwright generates baseline, actual, and diff images

## Accessibility Testing

Integrate `@axe-core/playwright` for automated WCAG checks:

```typescript
import AxeBuilder from "@axe-core/playwright";

test("homepage meets WCAG 2.1 AA", async ({ page }) => {
  await page.goto("/");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
```

### Aria Snapshots (v1.52+)

Assert accessibility tree structure:

```typescript
await expect(page.getByRole("navigation")).toMatchAriaSnapshot(`
  - navigation:
    - link "Home" /url: "/"
    - link "About" /url: "/about"
`);
```

## Mobile and Responsive Testing

Use built-in device descriptors:

```typescript
projects: [
  { name: "Desktop Chrome", use: { ...devices["Desktop Chrome"] } },
  { name: "Mobile Chrome", use: { ...devices["Pixel 7"] } },
  { name: "Mobile Safari", use: { ...devices["iPhone 14"] } },
  { name: "Tablet", use: { ...devices["iPad Pro 11"] } },
],
```

Custom viewport for responsive breakpoints:

```typescript
{
  name: "Mobile",
  use: {
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  },
}
```

**Limitation:** Playwright emulates devices inside desktop browser engines. Sufficient for responsive layout testing but cannot catch real mobile browser rendering bugs.

## i18n Testing

Run tests against both locales using Playwright projects:

```typescript
projects: [
  {
    name: "en",
    use: { ...devices["Desktop Chrome"], locale: "en-NZ" },
  },
  {
    name: "fr",
    use: { ...devices["Desktop Chrome"], locale: "fr-FR" },
  },
],
```

Verify typesafe-i18n strings render correctly in both locales.

## Trace Viewer and Debugging

### Trace Config

```typescript
use: {
  trace: "on-first-retry", // Capture traces only on failure retries
},
```

### Viewing Traces

```bash
# Local CLI
bunx playwright show-trace test-results/test-name/trace.zip

# Browser-based (upload to trace.playwright.dev)
```

Traces contain: DOM snapshots at every step, film strip, network requests, console logs, action timings, source code mapping.

### Timeline View (v1.58)

The Speedboard tab in HTML reports shows where time is spent across tests -- identifies slow steps and bottlenecks.

### Local Debugging

- `--ui` flag for interactive UI Mode with time-travel debugging
- `--debug` flag for step-through with Playwright Inspector
- VS Code extension for running/debugging individual tests

## CI/CD Integration (GitHub Actions)

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    timeout-minutes: 30
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.58.0-noble
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - run: bun install --frozen-lockfile
      - run: bun run build

      - run: bunx playwright test
        env:
          BASE_URL: http://localhost:4173

      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-traces
          path: test-results/
          retention-days: 7
```

### Sharding for Large Suites

```yaml
strategy:
  fail-fast: false
  matrix:
    shard: [1/4, 2/4, 3/4, 4/4]
steps:
  - run: bunx playwright test --shard=${{ matrix.shard }}
```

Then merge reports with `bunx playwright merge-reports`.

### Best Practices

- Always use the official Playwright Docker image (has all required system libraries)
- Upload artifacts (reports + traces) unconditionally or on failure
- Run smoke tests on every commit; full suite as pre-merge gate
- Use `--shard` for suites exceeding 5 minutes

## Performance Measurement

Playwright is not a load testing tool, but it can measure client-side performance:

```typescript
test("page load performance", async ({ page }) => {
  await page.goto("/");

  const perfTiming = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return {
      ttfb: nav.responseStart - nav.requestStart,
      domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
      loadComplete: nav.loadEventEnd - nav.startTime,
    };
  });

  expect(perfTiming.ttfb).toBeLessThan(500);
  expect(perfTiming.domContentLoaded).toBeLessThan(2000);
});
```

For load testing at scale, pair with Artillery (`artillery-engine-playwright`).

## Test Generation

### Codegen

```bash
bunx playwright codegen http://localhost:5173
```

Records browser interactions and generates test code with role-based locators. As of v1.51, generates automatic `toBeVisible()` assertions.

**Always refactor raw codegen output into Page Objects before committing.**

### AI-Assisted (v1.56+)

Playwright Test Agents provide planner, generator, and healer loops for AI-assisted test authoring. Use as a starting point, then review and refine.

## Recommended Config

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/specs",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI
    ? [["blob"], ["github"]]
    : [["html", { open: "never" }]],

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"], storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"], storageState: "e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: "bun run build && bun run preview",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
```

## Flaky Test Prevention

| Cause | Fix |
|---|---|
| `waitForTimeout()` / `page.waitForTimeout(5000)` | Replace with web-first assertions or `waitForResponse` |
| Brittle selectors (`div > span:nth-child(3)`) | Use `getByRole`, `getByLabel`, `getByTestId` |
| Shared state between tests | Isolate with fresh `BrowserContext` per test |
| External API flakiness | Mock network calls with `page.route()` |
| Animation timing | Use `--force-prefers-reduced-motion` or `* { animation: none !important }` |
| Race conditions | Use `waitForResponse()`, `waitForURL()`, or `waitForLoadState()` before asserting |
| Missing `await` | The #1 source of false-passing tests. Lint for it. |

## Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| Using `waitForTimeout()` | Use web-first assertions or explicit wait conditions |
| Fragile CSS/XPath selectors | Use role-based and semantic locators |
| Creating new browser instances per test | Let Playwright manage `BrowserContext` isolation |
| Using `{ force: true }` | Masks real actionability problems (covered, disabled, invisible) |
| Missing `await` on assertions | The #1 source of false-passing tests |
| Tests without assertions | A test that clicks through without asserting is just a script |
| Redundant `page.reload()` calls | Playwright auto-waits; reload only when testing refresh behavior |
| Using Playwright for unit tests | Use Vitest for pure logic; Playwright is for browser-dependent behavior |
| Committing raw codegen output | Always refactor into Page Objects before committing |
| Not cleaning up route handlers | Use `page.unrouteAll()` to prevent mock leakage |
| Ignoring test isolation | Shared cookies/localStorage between tests causes cascading failures |
