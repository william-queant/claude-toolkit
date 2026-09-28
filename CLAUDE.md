# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start Commands

```bash
# Development
bun install              # Install dependencies (prepare runs husky)
bun run typecheck        # Run TypeScript type checking
bun run lint:check       # Check code style (read-only)
bun run lint             # Format and fix code style
bun test                 # Run the test suite (tests/*.test.ts)
bun run check:pack       # Tarball guard: no install scripts, shell/env access or docs/ in the package
bun run check:smoke      # Pack, install into a temp consumer, run claude-toolkit refresh

# Generate or regenerate .claude/ configuration (in a consumer project)
bunx claude-toolkit              # Create config (if missing) + regenerate .claude/
bunx claude-toolkit --update     # Also pull newly-detected stacks into config
bunx claude-toolkit refresh      # Regenerate only if the toolkit version changed (for "prepare")
```

## Architecture Overview

**claude-toolkit** is a zero-config configuration generator for Claude Code. It auto-detects your project's tech stacks (SolidJS, Vite, Playwright, Cloudflare, etc.) and generates a `.claude/` directory with skills, hooks, commands, and agents that Claude Code automatically loads. This means:

1. No repeated explanations of project conventions—the config is persistent and team-wide
2. Stack drift detection: if your project evolves, the toolkit detects changes and suggests updates
3. Regeneration on toolkit upgrades without install scripts: consumers add `"prepare": "claude-toolkit refresh || exit 0"` to their own `package.json`, and `claude-toolkit refresh` rebuilds `.claude/` only when `.claude/.toolkit-version` differs from the installed toolkit version. The package itself ships no install-time scripts (enforced by `bun run check:pack`)

### Core Flow

1. **Detection** (`src/detect.ts`): Scans `package.json` dependencies, workspace structure, and config files (vite.config.ts, wrangler.toml, etc.) to identify which stacks are in use
2. **Configuration** (`src/types.ts`): User creates `claude-toolkit.config.ts` (scaffolded on first run with detected stacks pre-filled) that specifies stacks, package manager, hooks, and git config
3. **Generation** (`src/generator.ts`): Merges core skills + stack-specific skills, resolves hooks with package manager defaults, and writes the entire `.claude/` directory cleanly so removed stacks leave no orphaned files

### Directory Structure

- **`src/`** — Core logic
  - `index.ts`: Public API exports (primarily `defineConfig()` and `detectStacks()`)
  - `types.ts`: `ClaudeToolkitConfig`, `StackPack`, `StackName` type definitions and interfaces
  - `detect.ts`: Stack detection by scanning dependencies and config files; returns a list of detected stacks with reasons
  - `generator.ts`: Loads stack packs from `stacks/*/stack.json`, merges them with core assets, and writes `.claude/` and supporting config files (biome.json, tsconfig.json if scaffolding is enabled). Also owns the `.claude/.toolkit-version` marker (`readToolkitVersion()`, `readMarker()`) and validates `git.protectedBranches` before quoting them into the branch guard
  - `refresh-hint.ts`: Builds the "add a `prepare` script" hint printed by bare CLI runs (pure; per-package-manager wording, `postinstall` for Yarn 2+)
  - `utils.ts`: File I/O helpers (`readJson`, `writeFileEnsureDir`, `copyDir`, `exists`, `removePath`)

- **`bin/`** — CLI entry point
  - `cli.ts`: Main idempotent command (config creation, drift detection, generation) plus `refresh`, which regenerates `.claude/` only when the toolkit version changed and never writes committed files. Bare runs print the `prepare` hint until the consumer's `package.json` runs `claude-toolkit refresh`

- **`core/`** — Always-included assets (generated into `.claude/`)
  - `skills/`: Core skills (systematic-debugging, testing-patterns, typescript-conventions, verification-before-completion, code-style) — referenced by name in `generator.ts`
  - `hooks/`: `skill-eval.cjs` (the UserPromptSubmit skill-suggestion hook) and `skill-rules.schema.json`. The PostToolUse format/test/type-check hooks are not files here; `generator.ts` writes them inline into `settings.json`
  - `commands/`: CLI commands under the `ct:` namespace (code-quality, pr-review, onboard, ticket, etc.)
  - `agents/`: Agent definitions (code-reviewer, github-workflow)

- **`stacks/`** — Stack-specific implementations
  - Each stack folder (e.g., `stacks/solidjs/`, `stacks/cloudflare/`) contains:
    - `stack.json`: Metadata (name, description, file extensions, default directory mappings, hook overrides)
    - `skills/`: Stack-specific skills (e.g., SolidJS reactivity, Vite build config)
    - `agents/`: Stack-specific agents
    - `hooks/`: Stack-specific automation (e.g., custom test runners for Vitest)
  - Each stack's `stack.json` is parsed in `generator.ts` and merged into the resolved config

- **`templates/`** — Scaffold templates
  - `claude-toolkit.config.ts`: Template for user-facing config file; stacks detected on first run are injected here
  - `configs/`: Configuration templates for base projects (biome.json, tsconfig.json) — copied if scaffolding is enabled

- **`scripts/`** — Dev-only release checks (not in `package.json` `files`, never shipped)
  - `check-pack.ts`: `bun run check:pack` — fails if `npm pack` would ship an install script, `child_process`/`process.env`/`Bun.spawn`/`Bun.$`/`execSync`/`execFile`/`eval(` in a code file, or anything under `docs/`; `--publish` also rejects `prepare`
  - `check-smoke.ts`: `bun run check:smoke` — packs the tarball, installs it into a temp consumer, and checks that `claude-toolkit refresh` generates `.claude/` and then takes the fast path

- **`.github/workflows/`**
  - `ci.yml`: typecheck, lint, tests, `check:pack` and `check:smoke` on every push and pull request
  - `publish.yml`: npm trusted publishing (OIDC) when a GitHub Release is published; prerelease versions go to the `next` dist-tag

- **`docs/`** — User-facing documentation (kept in the repo, not published to npm; the README links to it on GitHub)
  - `best-practices/`: TypeScript, SolidJS, and language-specific guides
  - `skills/`, `commands/`, `agents/`: Full reference docs for generated assets
  - `stacks/`: Stack-specific deep dives (e.g., protobuf-contracts.md)

### Key Concepts

**StackPack**: Each enabled stack contributes a `StackPack` (loaded from `stack.json`). A pack contains:

- Skill names to include in `.claude/skills/`
- Directory → skill mappings (e.g., `src/components/` → `ct-solidjs-component-patterns`)
- Hook overrides (e.g., a stack can override the default test runner)
- File extensions (e.g., `.tsx` for SolidJS)

**Idempotent generation**: The CLI is idempotent — running it twice with the same config produces identical output. This is critical for `claude-toolkit refresh`, which runs from consumers' `prepare` scripts and must not modify committed files. Specifically:

- `.claude/` is always **regenerated cleanly** (old entries removed, new ones written)
- `claude-toolkit.config.ts` is **only created on first run**; later runs never edit it
- `biome.json` and `tsconfig.json` are **only scaffolded by bare runs, never overwritten** (`refresh` passes `scaffold: false`)
- the CLI **never edits the consumer's `package.json`**; it only prints the `prepare` hint

**Drift detection**: On every run, the toolkit compares configured stacks against detected stacks:

- If new stacks are detected but not in the config: suggest `--update`
- If config contains stacks no longer detected: warn but don't change config (user removes them manually)
- `--update` merges detected stacks into the config and regenerates in one step

**Nothing runs at install time**: shipped code (`bin/ src/ core/ stacks/ templates/`) must not use `child_process`, `process.env`, `Bun.spawn`, `Bun.$`, `execSync`, `execFile` or `eval(`, and `package.json` must not define `preinstall`/`install`/`postinstall`. `bun run check:pack` enforces both in CI and before every publish. Dev-only code that needs a shell lives in `scripts/` and `tests/`.

### Common Development Patterns

1. **Adding a new stack**:
   - Create `stacks/your-stack/` with `stack.json`, `skills/`, `hooks/`, `agents/`
   - Add the stack name to `src/types.ts` (`StackName` type)
   - Create a stack detector in `src/detect.ts` (check for a marker file or dependency)
   - Document in README.md and `docs/stacks/`

2. **Modifying core skills or hooks**:
   - Edit files in `core/skills/`, `core/hooks/`, `core/commands/`, or `core/agents/`
   - Run `bunx claude-toolkit` to regenerate `.claude/` and verify changes
   - Changes to core assets apply to all projects using the toolkit (on their next generation)

3. **Testing stack detection**:
   - The `detectStacks(projectDir)` function is exported from `src/index.ts`
   - Create a temporary project directory with the stack's marker files and test detection locally

4. **Versioning**:
   - Commit messages follow Conventional Commits (`feat:` → minor, `fix:`/`perf:` → patch, `feat!:` → major, capped to minor pre-1.0)
   - The bump lives inline in `.husky/post-commit` (a `node -e` script; there is no separate `.mjs`): it bumps `package.json`, prepends a `CHANGELOG.md` entry and amends the commit. It never bumps a prerelease version (`X.Y.Z-rc.N`)
   - Set exact versions (re-baselines, `X.Y.Z-rc.N`, finals) by hand and commit with `SKIP_POST_COMMIT=1`
   - Publishing: a GitHub **pre-release** publishes `X.Y.Z-rc.N` to the `next` dist-tag; a normal GitHub Release publishes to `latest` (`.github/workflows/publish.yml`, npm trusted publishing — no token secret)

### Configuration and Files to Track

- **Tracked** (in git):
  - `claude-toolkit.config.ts`: User's project-specific configuration
  - `CLAUDE.md`: This file — project-specific guidance for Claude Code
  - `src/`, `bin/`, `core/`, `stacks/`, `templates/`, `docs/`, `scripts/`, `tests/`, `.github/`
  - `package.json`, `tsconfig.json`, `biome.json`

- **Generated** (in `.gitignore`, not tracked):
  - `.claude/`: Generated configuration and skills (regenerated cleanly on every run)
  - `CLAUDE.local.md`: Local overrides of CLAUDE.md (user-specific)
  - `.planning/`: Planning and audit artifacts
