# TSConfig Cheat Sheet

> Source: [The TSConfig Cheat Sheet](https://www.totaltypescript.com/tsconfig-cheat-sheet) — Matt Pocock

## Base Options (Every Project)

These belong in every `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    // Smooth over CJS/ESM interop differences
    "esModuleInterop": true,

    // Skip type-checking node_modules .d.ts files for performance
    "skipLibCheck": true,

    // Stable target — prefer over "esnext"
    "target": "es2022",

    // Allow importing .js and .json files
    "allowJs": true,
    "resolveJsonModule": true,

    // Treat all files as modules (avoids redeclaration errors)
    "moduleDetection": "force",

    // Prevent unsafe TS features that break per-file transpilation
    "isolatedModules": true,

    // Enforce import type / export type syntax
    "verbatimModuleSyntax": true
  }
}
```

## Strictness

Enable all strict checks, plus two extras Matt considers essential:

```jsonc
{
  "compilerOptions": {
    // All strict type-checking options
    "strict": true,

    // Force checking array/object index access (prevents undefined bugs)
    "noUncheckedIndexedAccess": true,

    // Make the override keyword functional in classes
    "noImplicitOverride": true
  }
}
```

Matt **deliberately excludes** noisier options like `noImplicitReturns`, `noUnusedLocals`, and `noUnusedParameters`. Add them only if your team wants them — they create friction during development.

## When TypeScript Transpiles (tsc emits JS)

```jsonc
{
  "compilerOptions": {
    "module": "NodeNext",
    "outDir": "dist"
  }
}
```

### For Published Libraries

Add `.d.ts` generation so consumers get autocomplete:

```jsonc
{
  "compilerOptions": {
    "declaration": true
  }
}
```

### For Monorepo Packages

```jsonc
{
  "compilerOptions": {
    "composite": true,
    "sourceMap": true,
    "declarationMap": true
  }
}
```

## When TypeScript Does NOT Transpile (Linting Mode)

When a bundler (Vite, esbuild, etc.) handles transpilation:

```jsonc
{
  "compilerOptions": {
    // Mimic bundler module resolution
    "module": "preserve",

    // Don't emit JS files
    "noEmit": true
  }
}
```

## Environment-Specific `lib`

**DOM environments** (browsers, SSR with DOM APIs):

```jsonc
{
  "compilerOptions": {
    "lib": ["es2022", "dom", "dom.iterable"]
  }
}
```

**Non-DOM environments** (Node.js CLIs, serverless, workers):

```jsonc
{
  "compilerOptions": {
    "lib": ["es2022"]
  }
}
```

## TypeScript 7 Delta

> Not from the source cheat sheet — added for TypeScript 7 (GA 2026-07-08, `typescript@7.0.2`). See [ct-typescript-conventions](../../skills/typescript-conventions.md#tsconfigjson-under-ts7) for the full compiler-selection guidance.

Everything above is TS7-compatible as written, with **two additions** required when the native compiler is in use:

```jsonc
{
  "compilerOptions": {
    // `types` defaults to [] from 6.0 onward. Without this, ambient
    // globals (`process`, Bun's APIs) fail TS2591 even when
    // @types/node IS installed. Name only packages you actually have —
    // a missing one is TS2688.
    "types": ["node"],

    // `rootDir` defaults to "./" from 6.0 onward. With sources in src/
    // AND an outDir set, emit fails TS5011 — and `--noEmit` will not
    // warn you. Without an outDir it does not fire.
    "rootDir": "./src"
  }
}
```

Both defaults changed in **6.0**, not 7.0 — verified identical on `typescript@6.0.3` and `7.0.2`. `rootDir` matters only when the project emits to an `outDir`; `types` matters always.

`"types": ["*"]` restores the pre-6.0 catch-all behaviour on 6.x and 7.x, but is `TS2688` on 5.x — so it is not a safe value for a config shared across majors.

TS7 also rejects options this sheet never recommends — `baseUrl`, `outFile`, `downlevelIteration`, `target: "es5"`, `module: "amd" | "umd" | "system"`, and `moduleResolution: "node" | "node10" | "classic"`. `ignoreDeprecations` does not silence them.

The TypeScript website's [tsconfig reference](https://www.typescriptlang.org/tsconfig/) has not been updated for TS7 and still documents removed options.
