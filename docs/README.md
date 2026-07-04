# claude-toolkit Documentation

Complete reference for all skills, commands, and agents provided by claude-toolkit.

## Setup

Run `bunx claude-toolkit` in your project — on the first run it creates `claude-toolkit.config.ts` (pre-filled from stack detection) and generates `.claude/`. Run it again anytime to regenerate; add `--update` to pull newly-detected stacks into the config. `.claude/` also regenerates automatically on install when the toolkit version changes. See the [README](../README.md#cli-commands) for the full CLI.

## Core Skills

Skills that are always included regardless of stack configuration.

| Skill                                                                      | Description                                                                 |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [ct-systematic-debugging](skills/systematic-debugging.md)                     | Four-phase methodology for diagnosing and fixing bugs without guesswork     |
| [ct-testing-patterns](skills/testing-patterns.md)                             | Framework-agnostic TDD practices, mocking strategies, and test organization |
| [ct-typescript-conventions](skills/typescript-conventions.md)                 | Strict TypeScript patterns for type safety and maintainability              |
| [ct-verification-before-completion](skills/verification-before-completion.md) | Evidence-based completion claims with structured verification checklist     |
| [ct-code-style](skills/code-style.md)                                         | Code structure & style: guard clauses, lookup tables, no magic values       |

## Commands

Slash commands available in Claude Code sessions.

| Command                                   | Description                                                                |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| [/ct:code-quality](commands/code-quality.md) | Run lint, typecheck, and format checks with structured reporting           |
| [/ct:pr-review](commands/pr-review.md)       | Checklist-based code review against project standards                      |
| [/ct:pr-summary](commands/pr-summary.md)     | Generate a structured PR summary from branch diff and commits              |
| [/ct:onboard](commands/onboard.md)           | Systematically explore and understand a codebase area                      |
| [/ct:ticket](commands/ticket.md)             | Work end-to-end on a ticket: understand, explore, plan, implement, deliver |
| [/ct:proto-check](commands/proto-check.md)   | Validate protobuf definitions, lint, breaking changes, and code generation |

## Agents

Specialized agents with dedicated models and review capabilities.

| Agent                                        | Model  | Description                                                                |
| -------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| [ct-code-reviewer](agents/ct-code-reviewer.md)     | Opus   | Senior code reviewer with stack-aware analysis and severity-based feedback |
| [ct-github-workflow](agents/ct-github-workflow.md) | Sonnet | Git workflow assistant for branching, commits, and PR creation             |

## Stack Skills

Stack-specific skills activated based on your `claude-toolkit.config.ts` configuration.

| Skill                                                          | Stack             | Description                                                                    |
| -------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------ |
| [ct-solidjs-patterns](stacks/solidjs-patterns.md)                 | `solidjs`         | Reactivity, signals, effects, component patterns, and props handling           |
| [ct-vite-vitest-patterns](stacks/vite-vitest-patterns.md)         | `vite`            | Vite build config, plugins, env vars, Vitest testing, coverage, browser mode   |
| [ct-vanilla-extract-patterns](stacks/vanilla-extract-patterns.md) | `vanilla-extract` | Type-safe CSS with zero runtime: styles, recipes, themes, sprinkles            |
| [ct-rust-wasm-patterns](stacks/rust-wasm-patterns.md)             | `rust-wasm`       | Rust WASM for Cloudflare Workers: routing, handlers, env bindings              |
| [ct-protobuf-contracts](stacks/protobuf-contracts.md)             | `protobuf`        | Protocol Buffers for API contracts: schema design, versioning, code generation |
| [ct-cloudflare-d1-kv](stacks/cloudflare-d1-kv.md)                 | `cloudflare`      | D1 database and KV cache: queries, migrations, caching patterns                |
| [ct-i18n-typesafe](stacks/i18n-typesafe.md)                       | `i18n-typesafe`   | Type-safe internationalization with compile-time key checking                  |
| [ct-playwright-patterns](stacks/playwright-patterns.md)           | `playwright`      | E2E testing with Page Objects, fixtures, auth, network mocking, CI/CD          |
| [ct-storybook-patterns](stacks/storybook-patterns.md)             | `storybook`       | Interaction testing, CSF 3, play functions, a11y, visual regression            |
| [ct-capacitor-ota](stacks/capacitor-ota.md)                       | `capacitor`       | Capacitor 8 native runtime and Capgo OTA live updates, channels, encryption    |
| [ct-esnext-idioms](stacks/esnext-idioms.md)                       | `esnext`          | Modern ECMAScript runtime idioms: Temporal, iterator helpers, using, structuredClone |
