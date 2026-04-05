# Vite + Vitest Patterns

> Vite build tooling and Vitest unit/integration testing patterns.

**Type:** Stack Skill (requires `vite` stack)
**Source:** [`stacks/vite/skills/ct-vite-vitest-patterns/SKILL.md`](../../stacks/vite/skills/ct-vite-vitest-patterns/SKILL.md)
**Directory Mappings:** `vite.config.ts`, `vitest.config.ts`, `src/**/*.test.ts`, `tests/`
**File Extensions:** `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`

## Overview

Vite is the build tool; Vitest is its native test runner. They share a unified config -- aliases, plugins, and `define` values work identically in both. This is the primary advantage over separate build/test toolchains.

## Vite Configuration

### Config Structure

```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  plugins: [],
  envPrefix: 'VITE_',

  resolve: {
    alias: { '@': '/src' },
    conditions: [],
  },

  css: {
    transformer: 'postcss',         // or 'lightningcss'
    modules: {},
    preprocessorOptions: {},
  },

  oxc: {},                           // Oxc transformer (replaces esbuild in Vite 8)

  server: {
    port: 5173,
    proxy: {},
    warmup: { clientFiles: [] },     // pre-transform hot files for faster cold starts
  },

  build: {
    target: 'baseline-widely-available',
    outDir: 'dist',
    sourcemap: false,
    minify: 'oxc',                   // 'oxc' (default) | 'terser' | false
    rolldownOptions: {},             // Rolldown bundler config (replaces rollupOptions in Vite 8)
  },

  ssr: {
    target: 'node',
    noExternal: [],
    external: [],
  },
})
```

### Conditional Config

```typescript
export default defineConfig(({ command, mode, isSsrBuild }) => {
  if (command === 'serve') return { /* dev-specific */ }
  return { /* build-specific */ }
})
```

### Environment Variables

Loading order (later overrides earlier): `.env` > `.env.local` > `.env.[mode]` > `.env.[mode].local`.

Built-in `import.meta.env`: `MODE`, `BASE_URL`, `PROD`, `DEV`, `SSR`.

**Security:** Never put secrets in `VITE_*` variables -- they are embedded in client bundles.

TypeScript declarations (`src/vite-env.d.ts`):

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

### Plugin System

```typescript
export default defineConfig({
  plugins: [
    solidPlugin(),
    process.env.ANALYZE && visualizer(),  // conditional (falsy ignored)
    { ...myPlugin(), enforce: 'pre' },    // before Vite core transforms
    { ...myPlugin(), apply: 'build' },    // build only
  ],
})
```

Key hooks (execution order): `config` > `configResolved` > `configureServer` > `transformIndexHtml` > `resolveId` > `load` > `transform` > `handleHotUpdate`.

### Library Mode

```typescript
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'lib/main.ts'),
      name: 'MyLib',
      fileName: 'my-lib',
      formats: ['es', 'cjs'],
    },
    rolldownOptions: {
      external: ['solid-js', 'solid-js/web'],  // always externalize peer deps
    },
  },
})
```

### SSR

```json
{
  "build:client": "vite build --outDir dist/client",
  "build:server": "vite build --outDir dist/server --ssr src/entry-server.ts"
}
```

Use `middlewareMode: true` + `appType: 'custom'` for framework SSR integration.

### Build Performance

1. **Avoid barrel files** -- import directly from source modules, not re-export `index.ts`
2. **Use explicit extensions** -- `import './Component.tsx'` not `import './Component'`
3. **Warm up hot files** -- `server.warmup.clientFiles: ['./src/main.tsx']`
4. **Prefer native CSS** -- CSS nesting is supported natively; avoid Sass when possible
5. **Narrow resolve.extensions** -- remove extensions you don't use

## Vitest Configuration

### Standalone Config

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.{test,spec}.{ts,tsx}'],
    environment: 'node',              // 'node' | 'jsdom' | 'happy-dom'
    globals: false,
    setupFiles: [],
    testTimeout: 5000,
    pool: 'forks',                    // 'forks' | 'threads' | 'vmThreads'

    restoreMocks: true,               // auto vi.restoreAllMocks() after each test
    clearMocks: true,

    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.*', '**/*.d.ts', 'src/types/**'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },

    snapshotSerializers: [],
  },
})
```

### Integrated with Vite Config

```typescript
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: { alias: { '@': '/src' } },  // shared: works in both app and tests
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
})
```

Vite's `resolve.alias`, `plugins`, and `define` are automatically inherited by Vitest. Never duplicate them.

### Merging Separate Configs

```typescript
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: { environment: 'jsdom' },
}))
```

### Workspace / Projects (Vitest 3+)

Use `test.projects` for monorepos or mixed environments:

```typescript
export default defineConfig({
  test: {
    projects: [
      'packages/*',
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'components',
          include: ['src/**/*.test.tsx'],
          environment: 'jsdom',
        },
      },
    ],
  },
})
```

## Mocking

### Mock Functions

```typescript
const fn = vi.fn()
fn.mockReturnValue(42)
fn.mockResolvedValue({ data: [] })
fn.mockImplementation((x) => x * 2)

expect(fn).toHaveBeenCalledWith('arg')
expect(fn).toHaveBeenCalledTimes(1)
```

### Module Mocking

`vi.mock` is hoisted above imports automatically:

```typescript
vi.mock('./api', () => ({
  fetchUser: vi.fn().mockResolvedValue({ id: 1, name: 'Test' }),
}))

// Access original implementation inside mock
vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>()
  return { ...actual, format: vi.fn() }
})
```

**Hoisting caveat:** Variables defined before `vi.mock()` are not accessible inside the factory. Use `vi.hoisted()` for shared variables:

```typescript
const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}))

vi.mock('./api', () => ({ fetch: mockFetch }))
```

### Spying

```typescript
const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
expect(spy).toHaveBeenCalledWith('expected warning')
spy.mockRestore()
```

### Timer Mocking

```typescript
vi.useFakeTimers()
vi.setSystemTime(new Date('2026-01-01'))

setTimeout(callback, 1000)
vi.advanceTimersByTime(1000)
expect(callback).toHaveBeenCalled()

vi.useRealTimers()
```

### Environment Stubs

```typescript
vi.stubGlobal('__VERSION__', '1.0.0')
vi.stubEnv('VITE_API_URL', 'http://test.example.com')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
```

## Snapshot Testing

```typescript
// File snapshots (stored in __snapshots__/)
expect(result).toMatchSnapshot()

// Inline snapshots (written into test file by vitest --update)
expect(result).toMatchInlineSnapshot(`{ "id": 1 }`)

// Custom file path
expect(htmlOutput).toMatchFileSnapshot('./fixtures/expected.html')
```

Keep inline snapshots under 10-15 lines. Use file snapshots for complex output. Snapshots catch regressions but don't verify correctness -- combine with explicit assertions on critical values.

## In-Source Testing

```typescript
// src/utils/math.ts
export function add(...args: number[]) {
  return args.reduce((a, b) => a + b, 0)
}

if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest
  it('adds numbers', () => {
    expect(add(1, 2, 3)).toBe(6)
  })
}
```

Config:

```typescript
export default defineConfig({
  test: { includeSource: ['src/**/*.ts'] },
  define: { 'import.meta.vitest': 'undefined' },  // tree-shake from production
})
```

Best for small utility functions. Use separate test files for components and integration tests.

## Browser Mode (Vitest 4+, Stable)

```typescript
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      headless: true,
    },
  },
})
```

Providers: `@vitest/browser-playwright` (recommended), `@vitest/browser-webdriverio`.

Quick setup: `npx vitest init browser`

### Visual Regression

```typescript
import { page } from 'vitest/browser'

it('matches visual baseline', async () => {
  await page.goto('/component-demo')
  await expect(page.getByRole('button')).toMatchScreenshot()
})
```

### Playwright Traces

```typescript
browser: {
  provider: playwright({ trace: 'on-first-retry' }),
  // 'off' | 'on' | 'on-first-retry' | 'on-all-retries' | 'retain-on-failure'
}
```

### Browser Mode Limitations

- Cannot `vi.spyOn` module exports -- use `vi.mock('./module', { spy: true })` instead
- Thread-blocking APIs (`alert`, `confirm`, `prompt`) are auto-mocked
- Uses testing-library selectors: `getByRole`, `getByText`, `getByLabelText`

## Coverage

Install: `@vitest/coverage-v8` (default, fastest) or `@vitest/coverage-istanbul` (universal).

Run: `vitest --coverage`

Ignore comments:

- V8: `/* v8 ignore next */`
- Istanbul: `/* istanbul ignore next -- @preserve */`

Include `@preserve` to prevent Oxc minifier from stripping comments.

## Custom Matchers

```typescript
import { expect } from 'vitest'

expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling
    return {
      pass,
      message: () => `expected ${received} to be within [${floor}, ${ceiling}]`,
    }
  },
})
```

TypeScript (`vitest.d.ts`):

```typescript
import 'vitest'

declare module 'vitest' {
  interface Matchers<T = any> {
    toBeWithinRange(floor: number, ceiling: number): T
  }
}
```

### Schema Validation (Vitest 4+)

```typescript
import { z } from 'zod'

const UserSchema = z.object({ id: z.number(), name: z.string() })
expect(response.data).toSatisfy(expect.schemaMatching(UserSchema))
```

Works with any Standard Schema v1 library (Zod, Valibot, ArkType).

## Vite 8 Migration

| Old (Vite 7-)                | New (Vite 8)                 | Status                          |
| ---------------------------- | ---------------------------- | ------------------------------- |
| `build.rollupOptions`        | `build.rolldownOptions`      | Deprecated, compat layer exists |
| `optimizeDeps.esbuildOptions` | `optimizeDeps.rolldownOptions` | Deprecated                     |
| `esbuild` config             | `oxc` config                 | Deprecated                      |
| `build.minify: 'esbuild'`   | `build.minify: 'oxc'`       | New default                     |

The compat layer auto-converts old keys. New code should use the new keys.

## Anti-Patterns

### Vite

1. **Barrel file sprawl** -- Re-exporting through `index.ts` forces transforming all modules. Import directly from source.
2. **Secrets in VITE_ variables** -- Embedded in client bundles. Use server-only env vars, proxy through API routes.
3. **Duplicating resolve config for tests** -- Vitest inherits Vite's aliases and plugins. Don't redeclare.
4. **Using `rollupOptions` in Vite 8** -- Works via compat but generates warnings. Use `rolldownOptions`.
5. **Not externalizing peer deps in library mode** -- Bundling framework deps causes duplicate instances.

### Vitest

1. **Over-mocking internal modules** -- Mock at boundaries (HTTP, filesystem, external APIs), not internal functions.
2. **Forgetting vi.mock is hoisted** -- Variables before `vi.mock()` aren't accessible in the factory. Use `vi.hoisted()`.
3. **Not restoring mocks** -- Set `restoreMocks: true` in config. Leaked mocks cause cascading failures.
4. **Using jsdom when node suffices** -- jsdom adds overhead. Use workspace projects to split: `node` for logic, `jsdom` for components.
5. **Large inline snapshots** -- Over 10-15 lines reduces readability. Use `toMatchFileSnapshot`.
6. **Snapshot-only testing** -- Snapshots catch regressions but don't verify correctness. Add explicit assertions.
7. **Global jsdom environment** -- Use `test.projects` to run DOM tests in jsdom and logic tests in node.
8. **Using `vi.spyOn` in browser mode** -- Use `vi.mock('./module', { spy: true })` instead.

## See Also

- [ct-testing-patterns](../skills/testing-patterns.md) -- Framework-agnostic TDD practices
- [Vitest Unit Testing Best Practices](../best-practices/testing/vitest-unit.md) -- SolidJS-specific Vitest patterns
- [ct-storybook-patterns](storybook-patterns.md) -- Interaction testing layer
- [ct-playwright-patterns](playwright-patterns.md) -- E2E testing layer
