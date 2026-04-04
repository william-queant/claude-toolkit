---
description: "Review a pull request using project standards"
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

# Pull Request Review

Perform a checklist-based code review on the current PR or a specified PR number. Evaluate against project standards and common quality criteria.

## Workflow

1. **Get PR context.** If a PR number is provided, fetch it with `gh pr view {number} --json title,body,files,commits`. Otherwise, diff the current branch against the base branch (`main` or `master`).

2. **Read all changed files** in full to understand the complete context of the change. Do not review diffs in isolation — understand what the surrounding code does.

3. **Run the review checklist** against every changed file.

4. **Compile findings** into a structured review.

## Review Checklist

### Logic Correctness
- Are conditionals and branches correct? Any off-by-one errors?
- Are edge cases handled (empty inputs, null values, boundary conditions)?
- Does the control flow match the intended behavior?
- Are there any unreachable code paths?

### Type Safety
- Are types precise (no `any`, no unsafe casts, no overly broad unions)?
- Is type narrowing used correctly before accessing properties?
- Are generic constraints appropriate?
- Are return types explicit where they should be?

### Error Handling
- Are errors caught and handled meaningfully (not swallowed)?
- Do error messages provide enough context for debugging?
- Are error boundaries or fallbacks in place where needed?
- Is cleanup logic (finally blocks, defer, etc.) correct?

### Test Coverage
- Are new behaviors covered by tests?
- Do tests focus on behavior, not implementation details?
- Are edge cases and error paths tested?
- Are test descriptions clear and descriptive?

### Performance
- Any unnecessary re-renders, recomputations, or allocations?
- Any N+1 query patterns or missing pagination?
- Any missing memoization for expensive operations?
- Any potential memory leaks (unclosed resources, dangling listeners)?

### Security
- Any injection vulnerabilities (SQL, XSS, command injection)?
- Are user inputs validated and sanitized?
- Are auth checks present on protected operations?
- Are secrets or sensitive data properly handled (not logged, not exposed)?

### Code Style
- Does naming follow project conventions?
- Is the code readable without excessive comments?
- Are abstractions at the right level (not over- or under-engineered)?
- Is there unnecessary duplication?

## Output Format

```markdown
## PR Review: {title}

**Branch:** {branch} -> {base}
**Files changed:** {count}
**Verdict:** {APPROVE | REQUEST_CHANGES | COMMENT}

### Critical Issues
> Must be fixed before merge.

- **[CRITICAL]** {file}:{line} - {description}

### Warnings
> Should be addressed, but not blocking.

- **[WARNING]** {file}:{line} - {description}

### Suggestions
> Nice-to-have improvements.

- **[SUGGESTION]** {file}:{line} - {description}

### Positive Notes
- {things done well}

### Summary
{1-3 sentence overall assessment}
```

## Notes

- Be specific. Reference file names and line numbers.
- Distinguish between opinion and objective issues.
- Acknowledge good patterns, not just problems.
- If the PR is too large to review effectively, say so and suggest splitting it.
