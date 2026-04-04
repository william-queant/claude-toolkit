# claude-toolkit Documentation

Complete reference for all skills, commands, and agents provided by claude-toolkit.

## Core Skills

Skills that are always included regardless of stack configuration.

| Skill                                                                      | Description                                                                 |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [ct-systematic-debugging](skills/systematic-debugging.md)                     | Four-phase methodology for diagnosing and fixing bugs without guesswork     |
| [ct-testing-patterns](skills/testing-patterns.md)                             | Framework-agnostic TDD practices, mocking strategies, and test organization |
| [ct-typescript-conventions](skills/typescript-conventions.md)                 | Strict TypeScript patterns for type safety and maintainability              |
| [ct-verification-before-completion](skills/verification-before-completion.md) | Evidence-based completion claims with structured verification checklist     |

## Commands

Slash commands available in Claude Code sessions.

| Command                                   | Description                                                                |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| [/code-quality](commands/code-quality.md) | Run lint, typecheck, and format checks with structured reporting           |
| [/pr-review](commands/pr-review.md)       | Checklist-based code review against project standards                      |
| [/pr-summary](commands/pr-summary.md)     | Generate a structured PR summary from branch diff and commits              |
| [/onboard](commands/onboard.md)           | Systematically explore and understand a codebase area                      |
| [/ticket](commands/ticket.md)             | Work end-to-end on a ticket: understand, explore, plan, implement, deliver |
| [/proto-check](commands/proto-check.md)   | Validate protobuf definitions, lint, breaking changes, and code generation |

## Agents

Specialized agents with dedicated models and review capabilities.

| Agent                                        | Model  | Description                                                                |
| -------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| [Code Reviewer](agents/code-reviewer.md)     | Opus   | Senior code reviewer with stack-aware analysis and severity-based feedback |
| [GitHub Workflow](agents/github-workflow.md) | Sonnet | Git workflow assistant for branching, commits, and PR creation             |

## Stack Skills

Stack-specific skills activated based on your `claude-toolkit.config.ts` configuration.

| Skill                                                          | Stack             | Description                                                                    |
| -------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------ |
| [ct-solidjs-patterns](stacks/solidjs-patterns.md)                 | `solidjs`         | Reactivity, signals, effects, component patterns, and props handling           |
| [ct-vanilla-extract-patterns](stacks/vanilla-extract-patterns.md) | `vanilla-extract` | Type-safe CSS with zero runtime: styles, recipes, themes, sprinkles            |
| [ct-rust-wasm-patterns](stacks/rust-wasm-patterns.md)             | `rust-wasm`       | Rust WASM for Cloudflare Workers: routing, handlers, env bindings              |
| [ct-protobuf-contracts](stacks/protobuf-contracts.md)             | `protobuf`        | Protocol Buffers for API contracts: schema design, versioning, code generation |
| [ct-cloudflare-d1-kv](stacks/cloudflare-d1-kv.md)                 | `cloudflare`      | D1 database and KV cache: queries, migrations, caching patterns                |
| [ct-i18n-typesafe](stacks/i18n-typesafe.md)                       | `i18n-typesafe`   | Type-safe internationalization with compile-time key checking                  |
