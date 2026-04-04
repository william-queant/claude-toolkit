# Verification Before Completion

> Evidence-based completion claims -- never say "done" without proof that the work is correct.

**Type:** Core Skill (always included)
**Source:** [`core/skills/verification-before-completion/SKILL.md`](../core/skills/verification-before-completion/SKILL.md)

## Overview

The most common source of rework is claiming completion without verification. Every "done" claim must be backed by evidence that the code works correctly. "I wrote the code" is not evidence. "The tests pass, the types check, and here is the output" is evidence.

## Verification Checklist

### 1. Tests Pass

Run the full test suite (or related tests) and show the output. If any test fails, fix it before claiming complete.

### 2. Type Checks Pass

Run the type checker with no errors (`tsc --noEmit` or equivalent). Zero errors, zero warnings on changed files.

### 3. Linting Passes

Run the project's linter on changed files. Fix any violations introduced by your changes.

### 4. The Feature Actually Works

For user-facing changes, demonstrate the feature works with actual output -- API responses, rendered UI, CLI output:

```
$ curl -s localhost:3000/api/users/1 | jq .
{
  "id": "1",
  "name": "Alice",
  "email": "alice@example.com"
}
```

### 5. Edge Cases Verified

Test boundaries and unusual inputs explicitly:

- **Empty inputs** -- empty strings, empty arrays, null, undefined
- **Boundary values** -- zero, negative numbers, maximum values, off-by-one
- **Invalid inputs** -- wrong types, malformed data, missing required fields
- **Concurrent access** -- simultaneous requests or operations
- **Error paths** -- network failures, database errors, permission denied

### 6. Regression Check

- Run related tests, not just the tests you wrote
- Check integration points if you changed a shared utility, API contract, or database schema
- Smoke test the application if it has a running instance

## Evidence Format

When reporting completion, include concrete evidence:

```markdown
## Completed: User authentication endpoint

### Tests
- 12 tests passing (3 new, 9 existing)
- `npm test -- --grep "auth"` output: all green

### Type check
- `tsc --noEmit`: 0 errors

### Manual verification
- POST /api/auth/login with valid credentials: 200 + JWT token
- POST /api/auth/login with wrong password: 401 + error message
- POST /api/auth/login with locked account: 423 + lockout message

### Edge cases verified
- Empty email: 400 validation error
- SQL injection attempt in email: properly escaped, no error
- Expired token refresh: 401 with clear message
```

## What This Prevents

- **"It works on my machine" failures** -- evidence shows it works in a verifiable way
- **Phantom completions** -- tasks marked done that are actually broken
- **Regression blindness** -- catching breakage before it reaches review or production
- **Incomplete implementations** -- edge cases and error handling are verified, not assumed

## Trigger Conditions

- **Keywords:** `verify`, `check`, `confirm`, `done`, `complete`
- **Intent patterns:** "is it done", "verify it works"
- **Context patterns:** "before claiming", "make sure"
