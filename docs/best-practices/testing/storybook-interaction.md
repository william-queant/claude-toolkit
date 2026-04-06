# Storybook Interaction Testing

> Sources: [Storybook 10 Blog](https://storybook.js.org/blog/storybook-10/), [Storybook 9.0 Release](https://storybook.js.org/releases/9.0), [Interaction Testing Docs](https://storybook.js.org/docs/writing-tests/interaction-testing), [storybook-solidjs-vite](https://www.npmjs.com/package/storybook-solidjs-vite), [Vitest Addon Docs](https://storybook.js.org/docs/writing-tests/integrations/vitest-addon)

Storybook serves as the middle layer of the testing pyramid: component-level interaction testing, visual regression, and accessibility auditing -- all in a real browser environment.

## SolidJS Integration

The integration is community-maintained via two packages:

- **`storybook-solidjs`** -- the renderer
- **`storybook-solidjs-vite`** -- Vite builder integration (v10.0.x)

### Critical: Decorator Reactivity

SolidJS components run once; Storybook re-executes decorators on every args/globals change. Standard decorators cause **duplicate DOM elements** with SolidJS.

Always use `createJSXDecorator` for JSX-returning decorators:

```typescript
import { createJSXDecorator } from "storybook-solidjs";

// CORRECT -- prevents double-rendering
const ThemeDecorator = createJSXDecorator((Story, context) => (
  <ThemeProvider>
    <Story />
  </ThemeProvider>
));

export default {
  decorators: [ThemeDecorator],
};
```

### CSF Format

Use **CSF 3** for SolidJS. CSF Factories (Storybook 10's new format) are React-only as of 10.3.

## Writing Stories (CSF 3)

```typescript
// Button.stories.tsx
import type { Meta, StoryObj } from "storybook-solidjs";
import { Button } from "./Button";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost"],
    },
    size: {
      control: "radio",
      options: ["sm", "md", "lg"],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: "primary",
    children: "Click me",
  },
};

export const Loading: Story = {
  args: {
    variant: "primary",
    loading: true,
    children: "Submitting...",
  },
};

export const Disabled: Story = {
  args: {
    variant: "primary",
    disabled: true,
    children: "Unavailable",
  },
};
```

### Story Coverage Checklist

Every component should have stories covering:

- All visual states (default, hover, focus, active, disabled, loading, error, empty, success)
- Viewport sizes (mobile, tablet, desktop) where layout differs
- Theme variants (light/dark) if applicable
- Edge cases (long text, missing data, boundary values)

## Interaction Testing with Play Functions

Play functions turn stories into executable tests. Import everything from `@storybook/test` (instrumented versions of Testing Library + Vitest utilities):

```typescript
import { expect, fn, userEvent, within, waitFor } from "@storybook/test";

export const SubmitForm: Story = {
  args: {
    onSubmit: fn(), // Storybook-instrumented spy
  },
  play: async ({ canvasElement, args, step }) => {
    const canvas = within(canvasElement);

    await step("Fill in the form", async () => {
      await userEvent.type(canvas.getByLabelText("Email"), "user@example.com");
      await userEvent.type(canvas.getByLabelText("Password"), "secret123");
    });

    await step("Submit the form", async () => {
      await userEvent.click(canvas.getByRole("button", { name: "Sign in" }));
    });

    await step("Verify submission", async () => {
      await expect(args.onSubmit).toHaveBeenCalledOnce();
      await expect(args.onSubmit).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "secret123",
      });
    });
  },
};
```

### Key Rules

1. **Always `await` expect calls.** This enables proper logging in the Interactions panel.
2. **Use `step()` to organize** complex interactions into labeled groups.
3. **Use `fn()` for spying.** Storybook auto-restores mocks between stories.
4. **Never import from `@testing-library/dom` directly.** Use `@storybook/test` for instrumented versions.

## Running Stories as Tests in CI

The **Vitest addon** (`@storybook/addon-vitest`) replaces the old `@storybook/test-runner`. It transforms stories into real Vitest tests via a plugin, running in browser mode with Playwright.

### Advantages Over the Old Test Runner

- Does not need a running Storybook instance
- Uses Vitest browser mode (real Chromium) for accurate rendering
- Results appear alongside your Vitest unit tests
- Faster execution, simpler architecture

### Configuration (Vitest 4.x)

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

```json
{
  "scripts": {
    "test:storybook": "vitest --project storybook"
  }
}
```

## Accessibility Testing

Storybook's a11y integration (built on axe-core) catches ~57% of WCAG issues automatically.

### Global Configuration

```typescript
// .storybook/preview.ts
export default {
  parameters: {
    a11y: {
      test: "error", // "off" | "todo" | "error"
    },
  },
  tags: ["a11y-test"],
};
```

- **`"error"`**: Fail in CI on any violation.
- **`"todo"`**: Log violations without failing (for gradual adoption).
- **`"off"`**: Disable for specific stories.

### Per-Story Overrides

```typescript
export const CustomA11y: Story = {
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: "color-contrast", enabled: true },
        ],
      },
    },
  },
};
```

## Visual Regression Testing

### Chromatic (by Storybook Team)

- Cloud service that captures screenshots of every story
- Pixel-perfect diffing across Chrome, Firefox, Safari, Edge
- Manages baselines across branches and team members
- Free tier available; paid for scale

### Integration

```bash
bunx chromatic --project-token=<token>
```

Add to CI as a quality gate after `test:storybook` passes.

## MSW for API-Dependent Components

### Global Setup

```typescript
// .storybook/preview.ts
import { initialize, mswLoader } from "msw-storybook-addon";

initialize();

export default {
  loaders: [mswLoader],
};
```

### Per-Story Handlers

```typescript
import { http, HttpResponse } from "msw";

export const WithUserData: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/user", () =>
          HttpResponse.json({ name: "Alice", email: "alice@example.com" })
        ),
      ],
    },
  },
};

export const WithError: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/user", () =>
          new HttpResponse(null, { status: 500 })
        ),
      ],
    },
  },
};
```

### Best Practices

- Keep "success" handlers in a shared `mocks/handlers.ts` module
- Override with error/edge-case handlers at the story level
- Configure MSW to error on unhandled requests

### Module Mocking (Storybook 10)

Storybook 10 introduced `sb.mock` for module-level mocking (services, utilities). Register in `.storybook/preview.ts` only:

```typescript
// .storybook/preview.ts
import { sb } from "@storybook/test";

sb.mock("../src/api/client", () => ({
  fetchUser: async () => ({ name: "Mock User" }),
}));
```

MSW remains the right tool for network-level mocking; `sb.mock` is for internal module replacement.

## Portable Stories

Reuse Storybook stories in your existing Vitest tests with `composeStories`:

```typescript
// Button.test.tsx
import { composeStories } from "storybook-solidjs";
import * as stories from "./Button.stories";
import { render } from "@solidjs/testing-library";

const { Primary, Loading, Disabled } = composeStories(stories);

test("renders primary button", () => {
  const { getByRole } = render(() => <Primary />);
  expect(getByRole("button")).toBeInTheDocument();
});

test("can override args in test", () => {
  const { getByRole } = render(() => <Primary children="Override" />);
  expect(getByRole("button")).toHaveTextContent("Override");
});
```

This preserves all story annotations (args, decorators, loaders, play functions) in unit tests.

## vanilla-extract Integration

**Zero additional configuration needed.** Storybook uses your `vite.config.ts`, which already includes `@vanilla-extract/vite-plugin`. Styles compile automatically.

### Theme Decorator

```typescript
// .storybook/preview.ts
import { createJSXDecorator } from "storybook-solidjs";
import "../src/styles/global.css";

const withTheme = createJSXDecorator((Story) => (
  <div class={themeClass}>
    <Story />
  </div>
));

export default {
  decorators: [withTheme],
};
```

## Organization at Scale

### File Structure

Organize by feature/domain, not by component type:

```
src/
  features/
    auth/
      LoginForm.tsx
      LoginForm.css.ts
      LoginForm.stories.tsx     # Co-located
      LoginForm.test.tsx        # Unit tests alongside
  components/
    Button/
      Button.tsx
      Button.css.ts
      Button.stories.tsx
```

### Tags for Filtering

Use tags to control which stories run in different contexts:

```typescript
const meta = {
  tags: ["autodocs", "a11y-test", "interaction-test"],
  // ...
} satisfies Meta<typeof Component>;
```

### Storybook Main Config

```typescript
// .storybook/main.ts
import type { StorybookConfig } from "storybook-solidjs-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  framework: "storybook-solidjs-vite",
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
  ],
};

export default config;
```

## Component Documentation

### Autodocs

Enable globally or per-component:

```typescript
const meta = {
  tags: ["autodocs"],
  // ...
} satisfies Meta<typeof Button>;
```

Generates prop tables from TypeScript interfaces. Add JSDoc comments on props interfaces for richer docs.

### MDX for Custom Docs

```mdx
{/* Button.mdx */}
import { Meta, Canvas, Controls } from "@storybook/blocks";
import * as ButtonStories from "./Button.stories";

<Meta of={ButtonStories} />

# Button

Our primary interaction element.

<Canvas of={ButtonStories.Primary} />
<Controls of={ButtonStories.Primary} />
```

## Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| Destructuring SolidJS props in stories | Pass props via `args`; use `createJSXDecorator` for decorators |
| Importing from `@testing-library/dom` directly | Import from `@storybook/test` for instrumented versions |
| Not awaiting `expect()` in play functions | Always `await expect(...)` |
| Hardcoding test data in stories | Use `args` and story composition |
| Giant monolithic story files | One story file per component |
| Skipping error/edge-case stories | Always include loading, error, empty, boundary states |
| Using `@storybook/test-runner` with Vite | Use `@storybook/addon-vitest` instead |
| Not resolving unhandled MSW requests | Configure MSW to error on unhandled requests |
| Using inline styles in stories | Use theme tokens and `.css.ts` files |
| Registering `sb.mock` in story files | Register in `.storybook/preview.ts` only |
