# Storybook Patterns

> Storybook interaction testing, CSF 3 stories, play functions, a11y, and visual regression for SolidJS components.

**Type:** Stack Skill (requires `storybook` stack)
**Source:** [`stacks/storybook/skills/ct-storybook-patterns/SKILL.md`](../../stacks/storybook/skills/ct-storybook-patterns/SKILL.md)
**Directory Mappings:** `.storybook/`, `src/**/*.stories.tsx`
**File Extensions:** `.stories.tsx`, `.stories.ts`

## Overview

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

## Anti-Patterns

1. **Destructuring SolidJS props in stories** -- Pass props via `args`; use `createJSXDecorator` for decorators.
2. **Importing from `@testing-library/dom`** -- Use `@storybook/test` for instrumented versions.
3. **Not awaiting `expect()` in play functions** -- Always `await expect(...)`.
4. **Skipping error/edge-case stories** -- Always include loading, error, empty, boundary states.
5. **Using `@storybook/test-runner`** -- Use `@storybook/addon-vitest` instead.
6. **Registering `sb.mock` in story files** -- Register in `.storybook/preview.ts` only.

## See Also

- [ct-testing-patterns](../skills/testing-patterns.md) -- Framework-agnostic TDD practices
- [Storybook Interaction Best Practices](../best-practices/testing/storybook-interaction.md) -- SolidJS-specific Storybook patterns
- [ct-vite-vitest-patterns](vite-vitest-patterns.md) -- Unit testing layer
- [ct-playwright-patterns](playwright-patterns.md) -- E2E testing layer
