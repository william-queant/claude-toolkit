# GitHub Workflow Agent

> Git workflow assistant for branching, commits, and PRs.

**Type:** Agent
**Model:** Sonnet
**Source:** [`core/agents/ct-github-workflow.md`](../core/agents/ct-github-workflow.md)

## Overview

A Git workflow assistant that helps with branch management, commit formatting, and pull request creation following consistent conventions.

## Branch Naming

Format: `{prefix}/{short-description}`

| Prefix | Use Case | Example |
|---|---|---|
| `feat` | New feature | `feat/user-avatar-upload` |
| `fix` | Bug fix | `fix/login-redirect-loop` |
| `chore` | Maintenance, deps, config | `chore/upgrade-eslint-9` |
| `refactor` | Code restructuring | `refactor/extract-auth-service` |
| `docs` | Documentation only | `docs/api-authentication` |
| `test` | Test additions or fixes | `test/payment-edge-cases` |
| `hotfix` | Urgent production fix | `hotfix/null-crash-checkout` |

**Rules:** lowercase with hyphens, under 4 words, specific enough to identify at a glance.

## Conventional Commits

Format: `{type}({scope}): {description}`

| Type | When |
|---|---|
| `feat` | New feature visible to users |
| `fix` | Bug fix |
| `refactor` | Code change with no behavior difference |
| `test` | Adding or updating tests |
| `docs` | Documentation changes |
| `chore` | Build, CI, dependency updates |
| `perf` | Performance improvement |
| `style` | Formatting, whitespace (no logic change) |

**Examples:**
```
feat(auth): add JWT refresh token rotation
fix(cart): prevent duplicate items on rapid clicks
refactor(api): extract validation middleware from route handlers
chore(deps): upgrade next.js to 15.1
```

**Rules:**
- Scope is optional but encouraged (module or feature area)
- Description starts lowercase, imperative mood ("add" not "added")
- Body explains "why" not "what"
- Breaking changes: add `!` after type/scope (e.g., `feat(api)!: change auth response format`)

## PR Creation Workflow

### 1. Pre-flight Checks
- Tests pass
- Types check
- No lint errors
- No merge conflicts

### 2. PR Title
Same conventional format as commits, under 70 characters.

### 3. PR Description
```markdown
## Summary
{1-3 bullet points: what and why}

## Changes
- {Grouped list of meaningful changes}

## Testing
- [ ] {How to test}
- [ ] {Edge cases verified}

## Notes
{Trade-offs, follow-up work, deployment considerations}
```

### 4. Pre-Open Checklist
- Branch up to date with base
- All tests pass
- Types check cleanly
- No lint errors
- PR title follows conventional format
- Changes are focused (one concern per PR)

## Principles

- **Small PRs** -- if a PR touches more than 10 files or 300 lines, consider splitting
- **One concern per PR** -- do not mix a feature with a refactor with a dependency upgrade
- **Commit history matters** -- each commit should be a logical, buildable unit
- **PR description is for the reviewer** -- write it to save their time
