# Changelog

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