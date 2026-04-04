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
