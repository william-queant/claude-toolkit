---
name: ct-verification-before-completion
description: Evidence-based completion claims -- never say "done" without proof that the work is correct.
---

# Verification Before Completion

**Never claim "done" without evidence.** "I wrote the code" is not evidence. "Tests pass, types check, here is the output" is evidence.

## Checklist

Before claiming complete, run and show output for each:

1. **Tests pass** -- Full suite or related tests. Show actual output, not just "tests pass".
2. **Types check** -- `tsc --noEmit` with zero errors on changed files.
3. **Lint passes** -- Fix violations introduced by your changes.
4. **Feature works** -- Show actual output (API response, CLI output, screenshot) for user-facing changes.

## Edge Cases to Verify

- Empty inputs (empty string, empty array, null, undefined)
- Boundary values (zero, negative, max, off-by-one)
- Invalid inputs (wrong types, malformed data, missing fields)
- Error paths (network failure, permission denied)

Do not assume edge cases work because the happy path works.

## Regression Check

- Run tests for modules that depend on changed code.
- Verify consumers of changed APIs/schemas still work.
- Smoke test the running application if applicable.

## Security Check

Before completing work that touches dependencies, inputs, or external data:

- **Dependency audit** -- Run `bun audit` or `npm audit` and resolve critical/high vulnerabilities.
- **Input validation** -- Verify user-facing inputs are validated at system boundaries (no SQL injection, XSS, command injection).
- **Secret exposure** -- Confirm no secrets, API keys, or credentials in committed code or logs.

## Evidence Format

```
## Completed: [task name]
- Tests: X passing (Y new, Z existing) -- [command output]
- Types: tsc --noEmit: 0 errors
- Lint: 0 violations
- Security: audit clean, no exposed secrets
- Manual: [endpoint/action]: [status/result]
- Edge cases: [what was verified]
```
