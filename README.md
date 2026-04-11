# claude-toolkit

**claude-toolkit is a toolbox that Claude Code picks up and uses on its own — no prompting required, saving tokens and ensuring consistent behavior across your team.**

The toolkit auto-detects your tech stacks (SolidJS, Vite, Playwright, Cloudflare, etc.) and generates a `.claude/` directory that Claude Code automatically loads. Instead of every team member re-explaining project conventions, tooling, and patterns each session (burning tokens every time), Claude already knows — the knowledge is baked into the generated config. As your project evolves, the toolkit detects stack drift and suggests config updates to stay in sync.

This means any developer on your team gets the same Claude behavior for a given project, regardless of how they prompt. The toolkit is project-specific but team-consistent: Claude follows the same debugging methodology, the same testing patterns, and the same code quality standards for everyone.

Whether you're starting a new project from scratch or consolidating an existing one, the toolkit gives Claude immediate context about your stack and conventions — so it produces code that fits from day one, or aligns with what's already in place.

## Quick Start

```bash
# Install as a dev dependency
bun add -d claude-toolkit

# Scaffold config and generate .claude/
bunx claude-toolkit init
```

## How It Works

1. You define a `claude-toolkit.config.ts` at your project root
2. The toolkit generates a `.claude/` directory with skills, hooks, commands, and agents
3. Claude Code picks up the generated config automatically

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

| Command                    | Description                                              |
| -------------------------- | -------------------------------------------------------- |
| `bunx claude-toolkit init` | Scaffold config file and generate `.claude/`             |
| `bunx claude-toolkit sync` | Regenerate `.claude/` from config (after toolkit update) |
| `bunx claude-toolkit help` | Show available commands                                  |

## Stack Auto-Detection

The toolkit automatically detects which stacks your project uses by scanning `package.json` dependencies, config files, and project structure.

**On `init`** (new project), detected stacks are pre-filled in the generated config:

```text
Detected stacks:
  solidjs    — found solid-js in dependencies
  vite       — found vite.config.ts
  cloudflare — found wrangler.toml

Created claude-toolkit.config.ts
```

**On `sync`** (existing config), the toolkit compares your configured stacks against what it detects and reports any drift:

```text
Stack drift detected:
  + playwright — found @playwright/test in dependencies (not in config)
  - rust-wasm  — in config but not detected in project

Suggested update in claude-toolkit.config.ts:
  stacks: ["solidjs", "vite", "cloudflare", "playwright"]
```

This keeps your config aligned as your project evolves — stacks you add or remove are surfaced automatically. The suggestion is informational; your config is not modified unless you update it yourself.

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

The patch version auto-increments on every commit via a post-commit hook. `CHANGELOG.md` is updated automatically with the commit message.

To bump major or minor versions manually:

```bash
bun version major   # 0.1.x → 1.0.0
bun version minor   # 0.1.x → 0.2.0
```

## Development

```bash
git clone https://github.com/william-queant/claude-toolkit.git
cd claude-toolkit
bun install
```
