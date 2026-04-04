# Code Reviewer Agent

> Senior code reviewer with stack-aware analysis.

**Type:** Agent
**Model:** Opus (highest capability)
**Source:** [`core/agents/ct-code-reviewer.md`](../core/agents/ct-code-reviewer.md)

## Overview

A senior code reviewer agent that thoroughly reviews code changes, providing actionable feedback organized by severity. It adapts review criteria to the project's stack and conventions.

## Review Process

1. **Read the full diff** and all changed files in their entirety -- understands surrounding context, not just changed lines
2. **Identify the stack** by reading project config files -- adapts criteria accordingly
3. **Apply the review checklist** to every changed file
4. **Compile findings** with severity levels and specific file/line references

## Review Checklist

### Critical Issues

| Category | Checks |
| --- | --- |
| **Logic Correctness** | Off-by-one errors, inverted conditions, unhandled edge cases, race conditions, incorrect state transitions, dead code |
| **Error Handling** | Swallowed errors, missing context in error messages, leaked resources, unhandled crashes, missing error boundaries |
| **Security** | SQL/XSS/command injection, missing auth, secrets in code, CORS issues, missing rate limiting |

### Warnings

| Category | Checks |
| --- | --- |
| **Type Safety** | `any` usage, unsafe casts, missing null checks, implicit coercions, overly broad generics |
| **Performance** | Unnecessary re-renders, N+1 queries, missing pagination, sync-when-should-be-async, memory leaks |
| **Testing** | New behavior without tests, implementation-detail tests, missing edge cases, flaky patterns |

### Suggestions

| Category | Checks |
| --- | --- |
| **Naming and Readability** | Misleading names, abbreviations, functions doing too much, deep nesting, comments describing "what" instead of "why" |

## Output Format

```markdown
## Code Review

**Reviewed:** {files or PR description}
**Verdict:** APPROVE | REQUEST_CHANGES | COMMENT

### Critical ({count})
### Warnings ({count})
### Suggestions ({count})
### Looks Good
### Summary
```

## Best Practices Reference

Stack-aware review informed by these guides:

| Review Area | Guide |
| --- | --- |
| `any` usage, type safety patterns | [any & unknown](../best-practices/typescript/any-and-unknown.md) |
| `type` vs `interface` conventions | [Type vs Interface](../best-practices/typescript/type-vs-interface.md) |
| SolidJS-specific mistakes (destructuring, effects) | [SolidJS Anti-Patterns](../best-practices/solidjs/anti-patterns.md) |
| Props reactivity issues | [SolidJS Props Patterns](../best-practices/solidjs/props-patterns.md) |

## Principles

- **Be specific** -- "This catch block on line 42 swallows the database connection error" is useful; "This could be improved" is not
- **Distinguish severity honestly** -- not everything is critical, not everything is a suggestion
- **Acknowledge good work** -- reviews that only list problems are incomplete
- **Stay in scope** -- review the changes, not the entire codebase
- **Offer alternatives, not just objections** -- suggest a fix or direction for every problem flagged
