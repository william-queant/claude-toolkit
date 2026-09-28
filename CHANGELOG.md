# Changelog

## 0.18.0 (unreleased)

The edit hooks finally run, and safely. Every config value that reaches a hook command is checked against an allowlist first. The format and test hooks read the edited file from Claude Code's stdin JSON, skip tools that are not installed and files git ignores, and report failures to Claude as context without ever blocking. `.claude/settings.json` is merged instead of overwritten, the skill hook's output is advisory, and the shipped commands, agents and skills lose their broadest pre-approvals.

**BREAKING:** hook commands (`hooks.formatter`, `testRunner`, `typeCheck`, `extraChecks[]`, `installCommand`, and the install command derived from `packageManager`) may only contain letters, digits, spaces and `. _ / @ : = + -`, and must start with the program to run (not `eval`, `exec`, `command`, `.`, `source`, a shell with `-c`, or an option). A config that uses quotes, `$`, `;`, `|`, `&&`, redirects or newlines now stops `bunx claude-toolkit` and `claude-toolkit refresh` with an error naming the field and the value (the `prepare` line's `|| exit 0` still lets installs finish). Move such a command into a `package.json` script and reference the script:

    "scripts": { "typecheck:all": "tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json" }
    hooks: { typeCheck: "bun run typecheck:all" }

- fix(hooks)!: allowlist every hook command in `resolveConfig`, before anything is written; the error names the field and the value. Each place a value enters a hook command says it was allowlisted.
- fix(hooks): the PostToolUse hooks tested `$CLAUDE_TOOL_INPUT_FILE_PATH`, which Claude Code never sets, so they had never run. They now read `tool_input.file_path` from stdin through the new fs-only `core/hooks/hook-input.cjs`, are POSIX `sh` (Claude Code runs hooks with `sh` on macOS and Linux), run from the edited file's checkout (a Claude Code worktree under `.claude/worktrees/` reads its own `.claude/`, so with `.claude/` gitignored the hooks apply there once dependencies are installed in the worktree and the `prepare` line has run `claude-toolkit refresh`), leave files git ignores alone, skip silently unless their tool is installed (after `run`/`exec`/`x`/`npx`/`bunx`: a `node_modules/.bin` entry, a `package.json` script or a command on the `PATH`; a bare command must be on the `PATH`), and always exit 0: a failure reaches Claude as `hookSpecificOutput.additionalContext` with the last lines of output. The formatter hook runs on JS/TS files only; stack extensions such as `.sql` or `.proto` no longer reach it.
- feat(hooks): `hooks.typeCheckOnEdit` (default false) turns on the type-check hook, and `hooks.autoInstall` (default false) turns on the install hook, whose last 20 output lines now go to stderr (Claude Code's debug log) instead of `/dev/null`.
- fix(config): new configs format with `bun run biome format --write`, matching the scaffolded `biome.json` (was `bun run prettier --write`). Existing configs keep their formatter.
- fix(settings): `.claude/settings.json` is merged instead of overwritten. The toolkit owns only hook commands whose first line is `# claude-toolkit:<id>` (plus the unmarked entries 0.17 and earlier wrote) and sets `includeCoAuthoredBy` and its `env` defaults only when they are missing; `permissions`, your own hooks, `model` and every other key are kept. A file that is not a JSON object is saved as `settings.json.bak` first. The output is byte-identical across runs.
- fix(skill-eval): the UserPromptSubmit hook prints one advisory line ("claude-toolkit — skills that may be relevant: … Invoke them with the Skill tool if they apply.") instead of a made-up `<user-prompt-submit-hook>` block of "MUST … NOW" instructions. Matching, ranking and input sanitisation are unchanged.
- fix(commands): `code-quality`, `ticket` and `proto-check` pre-approve `pnpm run` and `yarn run` instead of every `pnpm`/`yarn` command; `ticket` no longer pre-approves `git push`; `ticket` and `pr-review` treat issue and PR text as data and pass `"$ARGUMENTS"` to `gh` only when it is a number.
- fix(agents): `ct-code-reviewer` is read-only (`Read, Grep, Glob`) and treats PR text as data; `ct-github-workflow` confirms with the user before `git push` or `gh pr create` and never force-pushes shared branches.
- fix(skills): `ct-capacitor-ota` pins `@capgo/cli@8`, has the user run `login` themselves instead of putting an API key in a command, and runs `init`, `bundle upload` and `channel set production` only on explicit request; `ct-cloudflare-d1-kv` runs `migrations apply --remote` only after a successful `--local` run and the user's explicit confirmation.
- Not a sandbox: Write/Edit plus the remaining `npm run`/`pnpm run`/`bun run`/`yarn run` pre-approvals still let a project script run code without a prompt. These changes remove the obvious outbound and remote-code grants.
- docs: README documents the hooks, `hooks.typeCheckOnEdit`, `hooks.autoInstall`, the command allowlist, the settings merge and upgrading to 0.18; CLAUDE.md describes `hook-commands.ts`, `settings-merge.ts`, `hook-input.cjs` and the allowlist invariant.

## 0.17.0 (2026-09-28)

Nothing runs at install time any more. The `postinstall` script that regenerated `.claude/` is gone; projects opt in with one line in their own `package.json`, and the new `claude-toolkit refresh` does the work. The package also stops shipping `docs/`, and releases move to npm trusted publishing behind a tarball guard.

**BREAKING:** installing or upgrading claude-toolkit no longer regenerates `.claude/`. After upgrading, run `bunx claude-toolkit` once, then add to your `package.json` scripts:

    "prepare": "claude-toolkit refresh || exit 0"

This line is **required** when `.claude/` is gitignored (the README's recommended setup): without it a fresh clone has no `.claude/` until someone runs `bunx claude-toolkit`. Yarn 2+ never runs `prepare` for your own project — use `"postinstall"` there. npm runs `prepare` only on a plain `npm install` and pnpm skips it on `pnpm add`; after those, run `bunx claude-toolkit refresh`. If you added `claude-toolkit` to Bun's `trustedDependencies` or pnpm's `onlyBuiltDependencies`, remove it.

- feat!: remove the install-time `postinstall` script (`bin/postinstall.mjs`) and the internal `postinstall` command. The package now ships no install scripts and no `child_process` or `process.env` use.
- feat: `claude-toolkit refresh [dir]` regenerates `.claude/` only when the installed toolkit version differs from `.claude/.toolkit-version`; the up-to-date path never imports the config. It never creates the config and never scaffolds `biome.json`/`tsconfig.json`; a config that fails to load exits 1. Accepts `claude-toolkit.config.ts` or `claude-toolkit.config.js`.
- feat: every non-quiet `bunx claude-toolkit` run ends with the `prepare` line until `package.json` has a script running `claude-toolkit refresh` — with a named-script variant when `prepare` is already taken, `postinstall` for Yarn 2+ (`.yarnrc.yml`), the npm and pnpm cases where `prepare` does not run, and a leading line when upgrading from 0.16 or earlier. The CLI never edits `package.json`.
- fix(settings): the protected-branch guard blocked every edit on every branch when two or more `git.protectedBranches` were configured (`[` does not accept `&&`). It is now a `case` statement; branch names are validated against `^[A-Za-z0-9._/][A-Za-z0-9._/-]*$`, and an invalid name fails generation with an error naming it. An empty list now generates no guard instead of blocking every edit.
- build: stop shipping `docs/` (about 270 KB); the README links the docs on GitHub. `prepare` runs the husky 9 binary instead of `npx husky`. Dropped the dead pre-0.11 `skill-eval.sh` cleanup.
- ci: publish with npm trusted publishing (OIDC, automatic provenance, no token secret); prerelease versions go to the `next` dist-tag, and the workflow can be re-run by hand on a tag. Before publishing it runs typecheck, lint and tests, strips `prepare`, and runs `check:pack --publish` (no install scripts, no shell or environment access in shipped code, no `docs/`) and `check:smoke` (installs the packed tarball and runs `refresh`). A new CI workflow runs the checks on every push and pull request.
- build: the post-commit version hook no longer bumps prerelease versions (it turned `0.17.0-rc.0` into `0.17.NaN`); `@types/bun` is pinned to `^1.3.11`.
- docs: README documents `refresh`, the `prepare` opt-in per package manager, upgrading from 0.16, and the release-candidate flow; the auto-format, auto-test and type-check hooks are marked not yet functional (fixed in 0.18.0). CLAUDE.md drops the postinstall description and corrects the post-commit and `core/hooks` notes.
- fix(package): `bin` is now `bin/cli.ts` without a leading `./`. npm 11.10 and later silently drop a `./`-prefixed `bin` entry at publish time (`npm pack` keeps it), which would have shipped 0.17.0 without its CLI; `check:pack` now rejects such paths. `repository.url` uses the `git+https` form npm normalizes to.

## 0.16.0 (2026-08-08)

`ct-typescript-conventions` now selects a compiler as well as types: prefer the TypeScript 7 native compiler where a project already ships it, fall back cleanly where it does not, and never upgrade a project unprompted. Availability-aware in the same spirit as `ct-esnext-idioms`.

- feat: prioritise the TypeScript 7 native compiler in `ct-typescript-conventions` — TS7 reached GA on 2026-07-08 as `typescript@7.0.2`, with Microsoft reporting 8x–12x faster full builds. The skill detects the *installed* version (`require('typescript/package.json').version`) rather than the declared semver range, which `overrides`/`resolutions`/catalogs routinely defeat, and names the three detection traps: the binary is `tsc` not `tsgo` (that was the pre-GA `@typescript/native-preview` name), range-sniffing is unreliable, and an API probe gives a false negative because TS7 exposes only `version`/`versionMajorMinor`.
- feat: document when *not* to switch — TS7.0 ships no stable programmatic API, so `typescript-eslint`, `ts-jest`, `ts-node`, `vue-tsc`, `svelte-check`, `@astrojs/check` and `@angular/compiler-cli` break at install or lint time rather than at `tsc --noEmit`, which means a green type-check proves nothing. The skill prescribes the documented side-by-side alias install instead of a downgrade.
- feat: add the TS7 `tsconfig.json` deltas — the options TS7 rejects outright (`ignoreDeprecations` no longer silences them), plus the two changed defaults behind most real breakage. Verified empirically against 5.9.3 / 6.0.3 / 7.0.2: both defaults land in 6.0 and carry forward, `types` fails `TS2591` even with `@types/node` installed, `rootDir` only bites when an `outDir` is set, and `types: ["*"]` is `TS2688` on 5.x — so no literal value is safe across majors.
- feat: skill triggers now fire on typecheck, tsconfig, and compiler work — added the `tsc`, `tsgo`, `tsconfig`, `typecheck` and `compiler` keywords, the `**/tsconfig*.json` path pattern, and intents for running a typecheck or upgrading TypeScript.
- docs: TSConfig cheat sheet gains a TypeScript 7 delta section; the skill's new remit is reflected in the generated skills index, README, and docs index.

## 0.15.0 (2026-07-04)

Two new authoring-convention assets — an opt-in `esnext` stack and an always-on `ct-code-style` core skill — plus Biome enforcement of the mechanically-checkable style rules.

- feat: add the `esnext` stack (skill `ct-esnext-idioms`) — availability-aware guidance on modern ECMAScript runtime features: `Temporal` over `Date`, `using`/`await using` for deterministic cleanup, lazy iterator helpers, `structuredClone`, `Object.groupBy`/`Map.groupBy`, `Promise.withResolvers`, immutable array ops, and ESM hygiene. Detected on tsconfig `target`/`module`/`lib` = ESNext/ES2022+, package.json `"type":"module"`, `engines.node >= 20`, or a `.mjs` file.
- feat: add the `ct-code-style` core skill (always included) — universal code-structure conventions: guard clauses over nested `else`, object lookup tables over `if/else if` chains, single-level ternaries, full ES6 destructuring, and arrow-only functions with no `class`/`this`. Carve-outs defer to stack skills: never destructure reactive SolidJS `props`, and use `class`/`this` only where a platform mandates it (e.g. Cloudflare Durable Objects).
- feat: enforce the mechanically-checkable style rules in the scaffolded Biome config — `noUselessElse`, `noNestedTernary`, and `useArrowFunction`. `noMagicNumbers` is kept as skill guidance only (too noisy to enforce).
- docs: document both assets in the README, `docs/stacks/esnext-idioms.md`, `docs/skills/code-style.md`, and the docs index; cross-link the SolidJS props rule to `ct-code-style`.

## 0.11.0 (2026-07-04)

Remediation of the 2026-07-04 core audit (46 findings): the skill-eval hook is hardened, stack-owned commands are gated behind their stack, and the `ct-` agents, commands, skills, and reference docs are corrected and aligned.

- feat: gate stack commands behind their owning stack — `proto-check` moved to the protobuf stack and is only installed when protobuf is detected. The skill hook is now registered as a single command string rather than exec-form args, so it runs correctly on every prompt.
- fix(hooks): harden the skill-eval hook — correct glob-to-regex conversion, robust file-path extraction with an input cap, defensive config coercion with defaults and clean exit, output sanitization, and verification that referenced skills actually ship. Dropped ghost rules and locked the skill-rules schema with `additionalProperties: false`. Renamed to `.cjs` and exposed a testable module API.
- fix(agents): register `ct-code-reviewer` and `ct-github-workflow` under their `ct-` names with scoped tool grants; give `ct-github-workflow` a real merge-conflict probe and default-branch resolution.
- fix(commands): scope `Bash` grants and add `argument-hint` across `code-quality`, `onboard`, `ticket`, and `pr-summary`; `pr-review` now fetches the PR diff and delegates to `ct-code-reviewer`.
- fix(skills): correct the `satisfies` example, align type-vs-interface guidance with best-practices, narrow E2E scope, and add edge cases plus "Use-when" triggers to the debugging and verification skills.
- docs: add `CLAUDE.md` architecture guide, regenerate testing-patterns from the current skill, correct command invocation names to `/ct:`, and mirror the doc references to the moved/renamed assets.
- chore: add `.gitattributes` to normalize line endings to LF across platforms.

## 0.10.0 (2026-06-09)

One idempotent CLI command replaces `init`/`update`/`sync`, and `.claude/` now regenerates itself on toolkit upgrade.

- feat: `bunx claude-toolkit` does it all — creates the config from stack detection on the first run, then cleanly regenerates `.claude/` on every run. `--update` pulls newly-detected stacks into the config. `init`/`update`/`sync` remain as back-compat aliases (`sync` deprecated).
- feat: automatic regeneration on install — a `postinstall` hook rebuilds `.claude/` when the installed toolkit version changes, so an upgrade ships its updated skills without running anything. Never fails the consumer's install and never writes committed files.
- feat: clean rebuilds — generation removes toolkit-owned (`ct-` prefixed) skills, agents, commands, and hooks before regenerating, so a stack removed from the config leaves no stale skills behind; user-authored files in `.claude/` are preserved.
- feat: stricter CLI parsing — unknown flags and typo'd commands now error instead of silently doing nothing; added `--quiet`/`-q`.
- docs: README and reference docs updated for the single-command workflow and conventional-commit versioning.

## 0.9.0 (2026-06-08)

Re-baselined from 0.1.x to reflect accumulated scope: 10 stack connectors, the full `init`/`update`/`sync` CLI, stack auto-detection with drift and monorepo/workspace support, and a complete skill/command/agent/hook system. Versioning is now conventional-commit-driven from this release onward.

- feat: render/runtime-speed guidance across every stack skill, each paired with a security guardrail
- feat: new `ct-capacitor-ui` skill for webview performance and native feel
- feat: canonical test-speed rule in core testing skill + cross-stack `relatedSkills` wiring
- build: conventional-commit-aware versioning (feat→minor, fix/perf→patch, breaking→major)
- ci: automated npm publish on GitHub release

## 0.1.33 (2026-06-07)

- chore: apply biome formatting to skill-eval hook

## 0.1.32 (2026-06-07)

- feat: add ct-capacitor-ui skill for webview performance and native feel

## 0.1.31 (2026-06-07)

- feat: add i18n performance guidance and wire relatedSkills to solidjs/vanilla-extract

## 0.1.30 (2026-06-07)

- feat: add test-speed guidance to vite, playwright, storybook, and core testing skill

## 0.1.29 (2026-06-07)

- feat: add performance guidance to cloudflare, rust-wasm, and protobuf skills

## 0.1.28 (2026-06-07)

- feat: add render-speed guidance to solidjs and vanilla-extract skills

## 0.1.27 (2026-06-01)

- feat: detect stacks across workspace packages and monorepo subdirectories

## 0.1.26 (2026-06-01)

- docs: document update command in README CLI commands table

## 0.1.25 (2026-06-01)

- feat: add update command to sync detected stacks into existing config

## 0.1.24 (2026-06-01)

- feat: add capacitor stack with Capgo OTA live updates, channels, and encryption

## 0.1.22 (2026-04-11)

- feat: add stack auto-detection with drift reporting

## 0.1.21 (2026-04-11)

- docs: improve README intro and standardize formatting

## 0.1.20 (2026-04-06)

- docs: update storybook docs with Vitest 4 addon-vitest config

## 0.1.19 (2026-04-06)

- fix: update storybook addon-vitest config for Vitest 4 compatibility

## 0.1.18 (2026-04-05)

- docs: update cross-references for vite, playwright, and storybook stacks

## 0.1.17 (2026-04-05)

- feat: add storybook stack with interaction testing and visual regression

## 0.1.16 (2026-04-05)

- feat: add playwright stack with E2E testing, Page Objects, and CI/CD

## 0.1.15 (2026-04-05)

- feat: add vite stack with Vitest testing, coverage, and browser mode

## 0.1.14 (2026-04-05)

- docs: add 3-layer testing strategy and shared principles to testing patterns

## 0.1.13 (2026-04-05)

- docs: add testing best practices for vitest, playwright, and storybook

## 0.1.12 (2026-04-05)

- docs: update skills and docs to 2026 best practices

## 0.1.11 (2026-04-05)

- refactor: rename skill folders to match ct- prefixed skill names

## 0.1.10 (2026-04-05)

- chore: update typescript to ^6.0.2 and require bun >=1.3.0

## 0.1.9 (2026-04-04)

- docs: add Zod/Valibot runtime validation section to SolidJS data fetching

## 0.1.8 (2026-04-04)

- docs: cross-reference best practices and fix markdown lint warnings

## 0.1.7 (2026-04-04)

- docs: add SolidJS best practices collection

## 0.1.6 (2026-04-04)

- docs: add Matt Pocock's TypeScript best practices collection

## 0.1.5 (2026-04-04)

- fix: guard post-commit hook against amend, rebase, cherry-pick, and merge

## 0.1.4 (2026-04-04)

- refactor: namespace commands under ct/ and prefix agents with ct-

## 0.1.3 (2026-04-04)

- fix: production readiness — remove private flag, add LICENSE, fix cross-platform hook

## 0.1.2 (2026-04-04)

- chore: add auto-versioning with changelog on every commit


## 0.1.1 (2026-04-04)

- chore: add auto-versioning with changelog on every commit