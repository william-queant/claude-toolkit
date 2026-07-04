# claude-toolkit

**claude-toolkit is a toolbox that Claude Code picks up and uses on its own — no prompting required, saving tokens and ensuring consistent behavior across your team.**

The toolkit auto-detects your tech stacks (SolidJS, Vite, Playwright, Cloudflare, etc.) and generates a `.claude/` directory that Claude Code automatically loads. Instead of every team member re-explaining project conventions, tooling, and patterns each session (burning tokens every time), Claude already knows — the knowledge is baked into the generated config. As your project evolves, the toolkit detects stack drift and suggests config updates to stay in sync.

This means any developer on your team gets the same Claude behavior for a given project, regardless of how they prompt. The toolkit is project-specific but team-consistent: Claude follows the same debugging methodology, the same testing patterns, and the same code quality standards for everyone.

Whether you're starting a new project from scratch or consolidating an existing one, the toolkit gives Claude immediate context about your stack and conventions — so it produces code that fits from day one, or aligns with what's already in place.

## Quick Start

```bash
# Install as a dev dependency
bun add -d claude-toolkit

# Generate .claude/ — creates the config from detection on the first run
bunx claude-toolkit
```

## How It Works

1. Run `bunx claude-toolkit` — on the first run it creates a `claude-toolkit.config.ts` at your project root, pre-filled with the stacks it detects
2. It generates a `.claude/` directory with skills, hooks, commands, and agents — regenerated cleanly each run, so stacks you remove leave no stale skills behind
3. Claude Code picks up the generated config automatically
4. `.claude/` regenerates automatically on install whenever the toolkit version changes, so upgrades land without running anything

```ts
import { defineConfig } from "claude-toolkit";

export default defineConfig({
  stacks: ["solidjs", "rust-wasm", "cloudflare", "protobuf"],
  packageManager: "bun",
  hooks: {
    formatter: "bun run prettier --write",
    testRunner: "bun run vitest run",
    typeCheck: "bun run tsc --noEmit",
    extraChecks: ["cargo check --target wasm32-unknown-unknown"],
  },
  git: {
    branchPrefix: "feat",
    protectedBranches: ["main"],
  },
});
```

## CLI Commands

| Command                        | Description                                                             |
| ------------------------------ | ----------------------------------------------------------------------- |
| `bunx claude-toolkit`          | Create the config if missing, then (re)generate `.claude/`. Idempotent. |
| `bunx claude-toolkit --update` | Same, and also add newly-detected stacks to your config                 |
| `bunx claude-toolkit help`     | Show available commands                                                 |

Aliases (back-compat): `init` is a friendly name for the bare command, `update` equals `--update`, and `sync` is deprecated — use the bare command. `.claude/` also regenerates automatically on install when the toolkit version changes.

## Stack Auto-Detection

The toolkit detects which stacks your project uses by scanning `package.json` dependencies, config files, and project structure.

**First run** (no config yet) — detected stacks are pre-filled into a new config:

```text
Detected stacks:
  solidjs    — found solid-js in dependencies
  vite       — found vite.config.ts
  cloudflare — found wrangler.toml

Created claude-toolkit.config.ts
Generated .claude/ with 3 stack(s) and 4 core skills
```

**Later runs** (config exists) — `bunx claude-toolkit` regenerates `.claude/` and reports drift between your config and what it detects, but never edits the config:

```text
Stack drift detected:
  + playwright — found @playwright/test in dependencies (detected, not in config)
  - rust-wasm  — in config, not detected

Run "bunx claude-toolkit --update" to add detected stacks to your config.
```

**Pulling in new stacks** — `bunx claude-toolkit --update` adds any newly-detected stacks to your config and regenerates in one step (use it when you add a stack, e.g. Capacitor):

```text
Adding newly detected stacks to config:
  + capacitor — found @capacitor/core in dependencies
Updated claude-toolkit.config.ts
Generated .claude/ with 4 stack(s) and 4 core skills
```

Stacks in your config that are no longer detected are reported but left unchanged (remove them manually if intended).

**Automatic regeneration** — when the installed toolkit version changes, `.claude/` is regenerated on install automatically (via a `postinstall` hook), so a toolkit upgrade ships its updated skills without you running anything. This only refreshes the generated `.claude/` — it never creates or edits committed files.

## Available Stacks

| Stack             | Skills Added                                                       |
| ----------------- | ------------------------------------------------------------------ |
| `solidjs`         | SolidJS reactivity, signals, components                            |
| `vite`            | Vite build config, plugins, Vitest testing, coverage, browser mode |
| `vanilla-extract` | Type-safe CSS, sprinkles, recipes, themes                          |
| `rust-wasm`       | Rust WASM for Cloudflare Workers                                   |
| `protobuf`        | Protocol Buffers, code generation, contracts                       |
| `cloudflare`      | D1 database, KV cache, Wrangler                                    |
| `i18n-typesafe`   | typesafe-i18n internationalization                                 |
| `playwright`      | Playwright E2E testing, Page Objects, fixtures, CI/CD              |
| `storybook`       | Storybook interaction testing, CSF 3, visual regression            |
| `capacitor`       | Capacitor 8 runtime, Capgo OTA, channels; webview UI & native feel |
| `esnext`          | Modern ECMAScript idioms — Temporal, iterator helpers, `using`, structuredClone |

## Core Features (always included)

- **Skill Evaluation Engine** — Analyzes prompts and suggests relevant skills
- **Main Branch Protection** — Prevents accidental edits on protected branches
- **Auto-formatting** — Formats files after edits
- **Auto-testing** — Runs related tests when test files change
- **Type checking** — Checks TypeScript types on save

### Core Skills

- `ct-systematic-debugging` — Four-phase debugging methodology
- `ct-testing-patterns` — TDD workflow and patterns
- `ct-typescript-conventions` — TypeScript strict mode best practices
- `ct-verification-before-completion` — Evidence-based completion claims
- `ct-code-style` — Code structure & style: guard clauses, lookup tables, no magic values

### Core Commands

- `/ct:code-quality` — Run lint, typecheck, format checks
- `/ct:pr-review` — Review a PR using project standards
- `/ct:pr-summary` — Generate PR summary from branch
- `/ct:onboard` — Onboard yourself to a codebase area
- `/ct:ticket` — Work end-to-end on a ticket
- `/ct:proto-check` — Validate protobuf definitions

### Core Agents

- `ct-code-reviewer` — Senior code reviewer (Opus)
- `ct-github-workflow` — Git workflow assistant (Sonnet)

## Project Setup

Add `.claude/` to your `.gitignore` (it's generated, not tracked):

```gitignore
# Claude Code (generated by claude-toolkit)
.claude/
CLAUDE.local.md
```

Track the config file and CLAUDE.md:

```
claude-toolkit.config.ts  # tracked — your project's Claude config
CLAUDE.md                 # tracked — project-specific documentation
```

## Documentation

Full reference documentation for all skills, commands, and agents is available in the [`docs/`](docs/README.md) directory.

## Versioning

Version bumps are derived from your commit messages (Conventional Commits) by a post-commit hook, and `CHANGELOG.md` is updated automatically:

- `feat:` → minor · `fix:` / `perf:` → patch · `feat!:` / `BREAKING CHANGE` → major (capped to minor while pre-1.0)
- `docs:` / `chore:` / `refactor:` / `style:` / `test:` / `ci:` / `build:` → no version change

To set an exact version deliberately (a re-baseline, or `1.0.0`), edit `package.json` and prepend a `CHANGELOG.md` entry, then commit with `SKIP_POST_COMMIT=1` so the hook doesn't re-bump, and tag `vX.Y.Z`. Publishing to npm happens automatically when a GitHub Release is published (see `.github/workflows/publish.yml`).

## Development

```bash
git clone https://github.com/william-queant/claude-toolkit.git
cd claude-toolkit
bun install
```
