---
name: ct-storybook-patterns
description: Storybook interaction testing, CSF 3 stories, play functions, a11y, and visual regression for SolidJS components
---

# Storybook Patterns

Storybook is the middle layer of the testing pyramid: component interaction testing, visual regression, and accessibility auditing in a real browser.

## SolidJS Integration

Uses community packages: `storybook-solidjs` (renderer) + `storybook-solidjs-vite` (builder).

**Critical:** Always use `createJSXDecorator` for JSX decorators. Standard decorators cause duplicate DOM elements with SolidJS.

```tsx
import { createJSXDecorator } from "storybook-solidjs";

const ThemeDecorator = createJSXDecorator((Story) => (
  <ThemeProvider><Story /></ThemeProvider>
));
```

## CSF 3 Stories

Use CSF 3 (not CSF Factories -- React-only as of Storybook 10.3).

```tsx
import type { Meta, StoryObj } from "storybook-solidjs";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: "primary", children: "Click me" },
};
```

### Coverage Checklist

Every component needs stories for: all visual states (default, hover, focus, active, disabled, loading, error, empty), viewport sizes where layout differs, theme variants, edge cases (long text, missing data).

## Interaction Testing

Import everything from `@storybook/test` (instrumented versions). Never import from `@testing-library/dom` directly.

```tsx
import { expect, fn, userEvent, within } from "@storybook/test";

export const SubmitForm: Story = {
  args: { onSubmit: fn() },
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement);
    await step("Fill form", async () => {
      await userEvent.type(canvas.getByLabelText("Email"), "user@example.com");
    });
    await step("Submit", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Sign in" }));
    });
    await expect(args.onSubmit).toHaveBeenCalledOnce();
  },
};
```

**Key rules:**
1. Always `await` expect calls (enables Interactions panel logging).
2. Use `step()` to organize complex interactions.
3. Use `fn()` for spying (auto-restored between stories).

## Running in CI (Vitest Addon)

Use `@storybook/addon-vitest` (replaces old test-runner). No running Storybook instance needed.

Required dependencies: `@storybook/addon-vitest`, `@vitest/browser`, `@vitest/browser-playwright`, `@vitest/coverage-v8`.

Add as an inline project in your main Vite config using `test.projects`:

```typescript
// vite.config.ts
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  plugins: [/* ...app plugins */],
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", environment: "jsdom", setupFiles: ["./tests/setup.ts"] },
      },
      {
        extends: true,
        plugins: [storybookTest({ configDir: ".storybook" })],
        test: {
          name: "storybook",
          browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: "chromium" }] },
          setupFiles: [".storybook/vitest.setup.ts"],
        },
      },
    ],
  },
});
```

## Accessibility

Built on axe-core. Set globally in `.storybook/preview.ts`:

```typescript
export default {
  parameters: { a11y: { test: "error" } }, // "error" | "todo" | "off"
  tags: ["a11y-test"],
};
```

## MSW for API Components

```typescript
// .storybook/preview.ts
import { initialize, mswLoader } from "msw-storybook-addon";
initialize();
export default { loaders: [mswLoader] };
```

Per-story handlers via `parameters.msw.handlers`. Keep success handlers in shared `mocks/handlers.ts`, override with error/edge-case at story level.

## Module Mocking (Storybook 10)

`sb.mock` for internal module replacement. Register in `.storybook/preview.ts` only:

```typescript
import { sb } from "@storybook/test";
sb.mock("../src/api/client", () => ({ fetchUser: async () => ({ name: "Mock" }) }));
```

MSW for network-level; `sb.mock` for internal modules.

## Portable Stories

Reuse stories in Vitest with `composeStories`:

```tsx
import { composeStories } from "storybook-solidjs";
import * as stories from "./Button.stories";
const { Primary } = composeStories(stories);

test("renders primary", () => {
  const { getByRole } = render(() => <Primary />);
  expect(getByRole("button")).toBeInTheDocument();
});
```

## Performance

> _Verified against Storybook 8/9/10 + Vitest browser mode (2026-06)._

Browser-mode story tests are the slowest part of CI. Optimize for parallelism, lazy work, and caching.

### Shard the Vitest run across CI jobs

```bash
# CI matrix: 4 jobs, each runs 1/4 of the story FILES (sharding is file-level)
vitest run --project=storybook --shard=1/4 --reporter=blob   # job 1
vitest run --project=storybook --shard=2/4 --reporter=blob   # job 2 ... etc.
# final job merges results + coverage from all shards:
vitest --merge-reports --reporter=junit --coverage
```

- `--project=storybook` skips the jsdom `unit` project when you only need stories.
- Browser tests already run files in parallel (`fileParallelism` defaults on). Don't disable it.
- `--reporter=blob` per shard + `--merge-reports` is required, or coverage is per-shard and incomplete.

### Don't confuse `instances` with parallelism

`browser.instances` runs the **same** test files across different browsers/setups -- each extra instance re-runs the whole suite. It is not a way to add CPU parallelism.

```typescript
browser: { enabled: true, headless: true, provider: playwright(),
  instances: [{ browser: "chromium" }] },  // keep ONE for speed
// Add instances only to cover more browsers (each re-runs everything).
// Scale CPU via fileParallelism (within a job) + --shard (across CI jobs).
```

### Dev startup is already lazy

On-demand story loading is automatic in modern Storybook (Vite builder, code-split: a story's code loads only when rendered). There is no flag to enable -- it's simply the default in Storybook 8/9/10 (the old `storyStoreV7` flag is gone).

- Webpack's `lazyCompilation`/`fsCache` do **not** apply to the Vite builder; ignore that advice for this stack.
- Don't defeat code-splitting with eager glob imports of all stories in custom config.

### Keep stories cheap

- Scope expensive setup **per-story**, not in `preview.ts` globals -- global decorators/loaders run for *every* story x every interaction test.
- `mswLoader` and theme providers as globals are fine if light; move heavy data setup to `parameters` on the stories that need it.
- Gate axe-core with `parameters.a11y.test` (`"error" | "todo" | "off"`), settable project -> component -> story (most specific wins). `test: "error"` globally runs the full ruleset on every story; downgrade or `"off"` where not needed, or run a11y in its own shard. (`tags` only include/exclude stories from a run -- they don't toggle a11y.)

### Cache the Vite dep-prebundle between CI runs

```yaml
# Cache node_modules/.vite (Vite's default cacheDir), keyed on the lockfile.
# This is the esbuild dependency pre-bundling cache used by dev / the browser-test run.
# Note: it does NOT speed up `storybook build` (vite build ignores it).
```

## Anti-Patterns

1. **Destructuring SolidJS props in stories** -- Pass props via `args`; use `createJSXDecorator` for decorators.
2. **Importing from `@testing-library/dom`** -- Use `@storybook/test` for instrumented versions.
3. **Not awaiting `expect()` in play functions** -- Always `await expect(...)`.
4. **Skipping error/edge-case stories** -- Always include loading, error, empty, boundary states.
5. **Using `@storybook/test-runner`** -- Use `@storybook/addon-vitest` instead.
6. **Registering `sb.mock` in story files** -- Register in `.storybook/preview.ts` only.
7. **Running the full story suite in one CI job** -- Use `vitest --shard=N/M` across matrix jobs (with `--reporter=blob` + `--merge-reports`).
8. **Duplicating same-browser `instances` to "go faster"** -- Each instance re-runs the whole suite. Scale via `fileParallelism` + `--shard`; add instances only for more browsers.
9. **Heavy decorators/loaders in `preview.ts`** -- Global setup runs per-story; scope expensive providers/data per-story.
10. **`a11y: { test: "error" }` globally with no scoping** -- Axe runs the full ruleset per story; downgrade per story via `parameters.a11y.test` or use a dedicated a11y shard.
11. **Discarding the Vite cache between CI runs** -- Persist `node_modules/.vite` keyed on the lockfile (dev / browser-test speedup; not `storybook build`).

## See Also

- `ct-testing-patterns` — the canonical cross-runner test-speed rule (file-level `--shard` + blob/merge-reports, parallelism).
- `ct-vite-vitest-patterns` — owns the deep Vitest sharding/`--project`/cache config the browser-mode run inherits.
