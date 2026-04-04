# /pr-review

> Perform a checklist-based code review on the current PR or a specified PR number.

**Type:** Command (slash command)
**Source:** [`core/commands/pr-review.md`](../core/commands/pr-review.md)
**Allowed Tools:** Bash, Read, Glob, Grep

## Usage

```
/pr-review [pr-number]
```

If no PR number is provided, diffs the current branch against the base branch.

## Review Checklist

The command evaluates all changed files against these criteria:

### Logic Correctness
- Conditionals and branches correct, no off-by-one errors
- Edge cases handled (empty inputs, null values, boundary conditions)
- Control flow matches intended behavior
- No unreachable code paths

### Type Safety
- Precise types (no `any`, no unsafe casts, no overly broad unions)
- Type narrowing used correctly before accessing properties
- Generic constraints appropriate
- Return types explicit where needed

### Error Handling
- Errors caught and handled meaningfully (not swallowed)
- Error messages provide enough context for debugging
- Error boundaries or fallbacks in place where needed
- Cleanup logic (finally blocks, defer) correct

### Test Coverage
- New behaviors covered by tests
- Tests focus on behavior, not implementation details
- Edge cases and error paths tested
- Test descriptions clear and descriptive

### Performance
- No unnecessary re-renders, recomputations, or allocations
- No N+1 query patterns or missing pagination
- No missing memoization for expensive operations
- No potential memory leaks

### Security
- No injection vulnerabilities (SQL, XSS, command injection)
- User inputs validated and sanitized
- Auth checks present on protected operations
- Secrets and sensitive data properly handled

### Code Style
- Naming follows project conventions
- Code readable without excessive comments
- Abstractions at the right level
- No unnecessary duplication

## Output Format

```
## PR Review: {title}

**Branch:** {branch} -> {base}
**Files changed:** {count}
**Verdict:** APPROVE | REQUEST_CHANGES | COMMENT

### Critical Issues
### Warnings
### Suggestions
### Positive Notes
### Summary
```

## Notes

- References specific file names and line numbers
- Distinguishes between opinion and objective issues
- Acknowledges good patterns, not just problems
- Suggests splitting if the PR is too large to review effectively
