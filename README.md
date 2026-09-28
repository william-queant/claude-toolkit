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

Then add one line to your `package.json` so `.claude/` is rebuilt after toolkit upgrades and on fresh clones. It is **required** when `.claude/` is gitignored (the setup recommended below):

```json
{
  "scripts": {
    "prepare": "claude-toolkit refresh || exit 0"
  }
}
```

claude-toolkit itself runs nothing at install time: this is your project's own script, and `|| exit 0` keeps installs working where bun is missing. If `prepare` is already taken, add `"claude-toolkit:refresh": "claude-toolkit refresh || exit 0"` and append `&& bun run claude-toolkit:refresh` (or `npm run`/`pnpm run`/`yarn run`) to your `prepare`. Until one of these is in place, `bunx claude-toolkit` prints the exact line for your project.

When your package manager runs it:

- **bun** runs `prepare` on `bun install`, `bun add` and `bun update`.
- **npm** runs it only on a plain `npm install`. After `npm install <pkg>` or `npm update`, run `bunx claude-toolkit refresh`.
- **pnpm** runs it on `pnpm install` and `pnpm update`, not on `pnpm add`. After `pnpm add`, run `bunx claude-toolkit refresh`.
- **Yarn 2+** never runs `prepare` for your own project. Use `"postinstall": "claude-toolkit refresh || exit 0"` instead; it runs whenever your dependencies change. If you publish the package, don't ship that `postinstall` — run `bunx claude-toolkit refresh` by hand instead.

## How It Works

1. Run `bunx claude-toolkit` — on the first run it creates a `claude-toolkit.config.ts` at your project root, pre-filled with the stacks it detects
2. It generates a `.claude/` directory with skills, hooks, commands, and agents — regenerated cleanly each run, so stacks you remove leave no stale skills behind
3. Claude Code picks up the generated config automatically
4. After a toolkit upgrade, the `prepare` line from Quick Start runs `claude-toolkit refresh`, which rebuilds `.claude/` only when the installed version differs from the one that generated it. Nothing else runs at install time

```ts
import { defineConfig } from "claude-toolkit";

export default defineConfig({
  stacks: ["solidjs", "rust-wasm", "cloudflare", "protobuf"],
  packageManager: "bun",
  hooks: {
    formatter: "bun run biome format --write",
    testRunner: "bun run vitest run",
    typeCheck: "bun run tsc --noEmit",
    typeCheckOnEdit: true,
    extraChecks: ["cargo check --target wasm32-unknown-unknown"],
  },
  git: {
    branchPrefix: "feat",
    protectedBranches: ["main"],
  },
});
```

## CLI Commands

| Command                             | Description                                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `bunx claude-toolkit`               | Create the config if missing, then (re)generate `.claude/`. Idempotent.                              |
| `bunx claude-toolkit --update`      | Same, and also add newly-detected stacks to your config                                              |
| `bunx claude-toolkit refresh [dir]` | Regenerate `.claude/` only if the toolkit version changed. Never creates the config or other files. |
| `bunx claude-toolkit help`          | Show available commands                                                                              |

Aliases (back-compat): `init` is a friendly name for the bare command, `update` equals `--update`, and `sync` is deprecated — use the bare command. `refresh` is what your `prepare` script runs: with no config it prints one setup line and exits 0, a config that fails to load exits 1, and `--quiet` silences it.

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

**Keeping `.claude/` in sync** — `claude-toolkit refresh` compares the installed toolkit version with `.claude/.toolkit-version` and regenerates only when they differ; when they match it returns without loading your config. It never creates the config and never scaffolds `biome.json`/`tsconfig.json`. Run it from your `prepare` script (see Quick Start).

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
- **Auto-formatting** — Formats each JS/TS file Claude edits with `hooks.formatter` (Biome by default)
- **Auto-testing** — Runs `hooks.testRunner` on a test file when Claude edits it
- **Type checking** — Opt in with `hooks.typeCheckOnEdit: true` to run `hooks.typeCheck` after each TypeScript edit

### Core Skills

- `ct-systematic-debugging` — Four-phase debugging methodology
- `ct-testing-patterns` — TDD workflow and patterns
- `ct-typescript-conventions` — TypeScript strict mode best practices, and preferring the TS7 native compiler where available
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

## Hooks

The generated `.claude/settings.json` registers these hooks. Each command is plain POSIX `sh` (Claude Code runs hooks with `sh` on macOS and Linux and with Git Bash on Windows) and needs `node` on the `PATH`. Windows without Git Bash, where Claude Code falls back to PowerShell, is not supported.

| Hook               | Runs when Claude…                                          | Config                                             | Default                        |
| ------------------ | ---------------------------------------------------------- | -------------------------------------------------- | ------------------------------ |
| Skill suggestions  | receives a prompt                                          | always on                                          | on                             |
| Protected branches | edits any file on a protected branch — the edit is blocked | `git.protectedBranches`                            | `["main"]`                     |
| Format             | edits a `.js .jsx .ts .tsx .mjs .cjs .mts .cts` file       | `hooks.formatter`                                  | `bun run biome format --write` |
| Test               | edits a `*.test.*` or `*.spec.*` file (js/jsx/ts/tsx)      | `hooks.testRunner` (runs that file)                | `bun run vitest run`           |
| Type-check         | edits a `.ts .tsx .mts .cts` file                          | `hooks.typeCheck` + `hooks.typeCheckOnEdit: true`  | off                            |
| Extra checks       | edits a `.rs` file                                         | `hooks.extraChecks`                                | none                           |
| Install            | edits `package.json`                                       | `hooks.installCommand` + `hooks.autoInstall: true` | off                            |

- **They never block.** The format, test, type-check, extra-check and install hooks always exit 0. When a command fails, Claude gets the last lines of its output as context next to the edit and decides what to do. The install hook also writes the last 20 lines of its output to Claude Code's debug log (`claude --debug-file <path>`).
- **They skip missing tools and ignored files.** A hook does nothing unless its tool is installed: the word after `run`, `exec`, `x`, `npx` or `bunx` must be a `node_modules/.bin` entry, a `package.json` script or a command on the `PATH`; a command without such a prefix (e.g. `tsc --noEmit`) must itself be on the `PATH` — use `bun run tsc --noEmit`. Tools are looked up in the edited file's checkout, so in a git worktree (such as a Claude Code worktree under `.claude/worktrees/`) the hooks run once that worktree has its own dependencies installed. The default formatter stays silent until Biome is installed. Files that git ignores (build output, dependencies) are skipped too. If your `biome.json` excludes files with `files.includes`, add `--no-errors-on-unmatched` to the formatter so edits to excluded files are not reported as failures.
- **Commands are allowlisted.** A hook command may only contain letters, digits, spaces and `. _ / @ : = + -`, and must start with the program to run (not `eval`, `exec`, `command`, `.`, `source`, a shell with `-c`, or an option). Anything else — quotes, `$`, `;`, `|`, `&&`, redirects, newlines — stops `bunx claude-toolkit` and `claude-toolkit refresh` with an error naming the field and the value. Put such a command in a `package.json` script and reference the script:

  ```json
  { "scripts": { "typecheck:all": "tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json" } }
  ```

  ```ts
  hooks: { typeCheck: "bun run typecheck:all", typeCheckOnEdit: true },
  ```

- **`settings.json` is merged, not overwritten.** The toolkit owns only hook entries whose command starts with `# claude-toolkit:` (and the unmarked entries that 0.17 and earlier wrote), and it sets `includeCoAuthoredBy` and its `env` defaults only when they are missing. Your `permissions` (including `deny` rules), your own hooks, `model` and every other key survive regeneration. A `settings.json` that is not a JSON object is saved as `settings.json.bak` before a new one is written.

## Project Setup

Add `.claude/` to your `.gitignore` (it's generated, not tracked):

```gitignore
# Claude Code (generated by claude-toolkit)
.claude/
CLAUDE.local.md
```

With `.claude/` gitignored, a fresh clone has no `.claude/` until something generates it, so the `prepare` line from Quick Start is **required** in this setup.

Track the config file and CLAUDE.md:

```
claude-toolkit.config.ts  # tracked — your project's Claude config
CLAUDE.md                 # tracked — project-specific documentation
```

## Upgrading from 0.16 or earlier

0.17.0 removed the install-time `postinstall` script: installing or upgrading claude-toolkit no longer runs anything. After upgrading:

1. Run `bunx claude-toolkit` once to regenerate `.claude/`.
2. Add `"prepare": "claude-toolkit refresh || exit 0"` to your `package.json` scripts (the CLI prints the exact line for your project, including the Yarn 2+ and existing-`prepare` variants).
3. If you added `claude-toolkit` to Bun's `trustedDependencies` or pnpm's `onlyBuiltDependencies` so its install script could run, remove it — there is no install script any more.

## Upgrading to 0.18

- **Hook commands are allowlisted.** If `bunx claude-toolkit` now stops with `Invalid hooks.<field> in the claude-toolkit config`, move that command into a `package.json` script and reference it as `bun run <script>` (see [Hooks](#hooks)).
- **The edit hooks now run.** The format and test hooks never fired before 0.18.0 (they read an environment variable Claude Code does not set). They now run after Claude's edits, but only when their tool is installed. Type-check on edit and auto-install are off unless you set `hooks.typeCheckOnEdit` or `hooks.autoInstall`.
- **New configs format with Biome.** Existing configs keep their `formatter`; a Prettier formatter keeps working when Prettier is installed.
- **Your `settings.json` changes now survive regeneration** (see [Hooks](#hooks)).

## Documentation

Full reference documentation for all skills, commands, and agents lives in the [`docs/` directory on GitHub](https://github.com/william-queant/claude-toolkit/blob/main/docs/README.md). It is not included in the npm package.

## Versioning

Version bumps are derived from your commit messages (Conventional Commits) by a post-commit hook, and `CHANGELOG.md` is updated automatically:

- `feat:` → minor · `fix:` / `perf:` → patch · `feat!:` / `BREAKING CHANGE` → major (capped to minor while pre-1.0)
- `docs:` / `chore:` / `refactor:` / `style:` / `test:` / `ci:` / `build:` → no version change

To set an exact version deliberately (a re-baseline, a release candidate, or `1.0.0`), edit `package.json` and the `CHANGELOG.md` entry, then commit with `SKIP_POST_COMMIT=1` so the hook doesn't re-bump. While `package.json` holds a prerelease version (for example `0.17.0-rc.0`), the hook never bumps.

Releases go through a release candidate:

1. Set `X.Y.0-rc.N`, commit with `SKIP_POST_COMMIT=1`, and publish a GitHub **pre-release** for tag `vX.Y.0-rc.N`. `.github/workflows/publish.yml` publishes it to the `next` dist-tag.
2. Verify the published candidate; fix and cut `rc.N+1` if needed.
3. Set `X.Y.0`, commit with `SKIP_POST_COMMIT=1`, and publish a normal GitHub Release for `vX.Y.0`. It goes to `latest`.

Publishing uses npm trusted publishing (OIDC): there is no npm token secret, and provenance is automatic. Before publishing, the workflow runs typecheck, lint and tests, strips the dev-only `prepare` script, then runs `bun run check:pack --publish` (no install scripts, no shell or environment access in shipped code, no `docs/`) and `bun run check:smoke` (installs the packed tarball and runs `claude-toolkit refresh`). `.github/workflows/ci.yml` runs typecheck, lint, tests, `check:pack` and `check:smoke` on every push and pull request.

## Development

```bash
git clone https://github.com/william-queant/claude-toolkit.git
cd claude-toolkit
bun install
bun test               # test suite
bun run check:pack     # tarball guard
bun run check:smoke    # pack, install into a temp project, run refresh
```
