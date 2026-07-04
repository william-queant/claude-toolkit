---
description: Work end-to-end on a ticket or issue
argument-hint: "[issue-number | description]"
allowed-tools:
  - Bash(git status:*)
  - Bash(git checkout:*)
  - Bash(git switch:*)
  - Bash(git branch:*)
  - Bash(git add:*)
  - Bash(git commit:*)
  - Bash(git push:*)
  - Bash(git diff:*)
  - Bash(git log:*)
  - Bash(gh issue view:*)
  - Bash(gh pr create:*)
  - Bash(gh pr view:*)
  - Bash(npm run:*)
  - Bash(pnpm:*)
  - Bash(bun run:*)
  - Bash(bun test:*)
  - Bash(yarn:*)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# Ticket Workflow

Work on a ticket or issue end-to-end: understand it, explore the codebase, plan the implementation, build it, test it, and prepare a PR.

## Workflow

### Phase 1: Understand

1. **Read the ticket.** If `$ARGUMENTS` is a GitHub issue number, fetch it with `gh issue view $ARGUMENTS`. Otherwise, treat `$ARGUMENTS` as the ticket description.

2. **Clarify requirements.** Identify acceptance criteria, edge cases, and constraints. If anything is ambiguous, ask before proceeding.

3. **Identify scope.** What needs to change? What should NOT change? Are there related tickets or dependencies?

### Phase 2: Explore

4. **Find relevant code.** Search for files, functions, and patterns related to the ticket. Read them fully to understand the current behavior.

5. **Understand the test landscape.** Find existing tests for the affected area. Note the testing framework, patterns, and coverage.

6. **Check for related changes.** Look at recent commits or PRs in the affected area for context.

### Phase 3: Plan

7. **Draft an implementation plan.** List the specific changes needed, in order:
   - Files to create or modify
   - Functions to add or change
   - Tests to write
   - Migrations or config changes needed

8. **Share the plan with the user** and get confirmation before proceeding. If the change is small and obvious, proceed directly.

### Phase 4: Implement

9. **Create a feature branch** following project conventions (e.g., `feat/description`, `fix/description`).

10. **Write tests first** when applicable (TDD). Write failing tests that describe the desired behavior, then implement to make them pass.

11. **Implement the changes.** Follow project conventions for code style, error handling, and naming. Make focused, atomic changes.

12. **Run quality checks.** Run lint, typecheck, and tests. Fix any issues introduced by the changes.

### Phase 5: Deliver

13. **Commit with conventional commit messages.** Group related changes into logical commits.

14. **Create a PR** with a clear title and description. Include:
    - Summary of what changed and why
    - How to test
    - Any follow-up work needed

15. **Report back** with the PR link and a summary of what was done.

## Notes

- Always ask before making architectural decisions (new tables, new services, changing frameworks).
- Do not gold-plate. Implement what the ticket asks for, nothing more.
- If the ticket is too large for a single PR, propose splitting it and implement the first piece.
- If you discover bugs or issues outside the ticket scope, note them but do not fix them unless they block the ticket.
- Prefer small, reviewable PRs over large monolithic ones.
