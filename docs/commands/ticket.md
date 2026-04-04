# /ticket

> Work end-to-end on a ticket or issue: understand, explore, plan, implement, deliver.

**Type:** Command (slash command)
**Source:** [`core/commands/ct/ticket.md`](../core/commands/ct/ticket.md)
**Allowed Tools:** Bash, Read, Write, Edit, Glob, Grep

## Usage

```
/ticket [issue-number-or-description]
```

## Phases

### Phase 1: Understand

- Read the ticket (fetches via `gh issue view` if a GitHub issue number is provided)
- Clarify requirements -- identify acceptance criteria, edge cases, and constraints
- Identify scope -- what needs to change, what should NOT change

### Phase 2: Explore

- Find relevant code -- search for files, functions, and patterns related to the ticket
- Understand the test landscape -- existing tests, framework, patterns, coverage
- Check for related changes -- recent commits or PRs in the affected area

### Phase 3: Plan

- Draft an implementation plan listing specific changes needed:
  - Files to create or modify
  - Functions to add or change
  - Tests to write
  - Migrations or config changes
- Share the plan with the user and get confirmation before proceeding

### Phase 4: Implement

- Create a feature branch following project conventions
- Write tests first when applicable (TDD)
- Implement changes following project conventions
- Run quality checks (lint, typecheck, tests)

### Phase 5: Deliver

- Commit with conventional commit messages
- Create a PR with clear title and description
- Report back with the PR link and summary

## Notes

- Always asks before making architectural decisions (new tables, new services, changing frameworks)
- Does not gold-plate -- implements what the ticket asks for, nothing more
- Proposes splitting if the ticket is too large for a single PR
- Notes bugs or issues outside the ticket scope but does not fix them unless they block the ticket
