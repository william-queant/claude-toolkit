---
name: Verification Before Completion
description: Evidence-based completion claims -- never say "done" without proof that the work is correct.
---

# Verification Before Completion

The most common source of rework is claiming completion without verification. Every "done" claim must be backed by evidence that the code works correctly.

## Core Principle

**Never claim "done" without evidence.** "I wrote the code" is not evidence. "The tests pass, the types check, and here is the output" is evidence.

## Verification Checklist

Before claiming any task is complete, run and confirm each applicable check.

### 1. Tests Pass

Run the full test suite (or at minimum, tests related to the changed code). Show the output.

```
# Show actual results, not just "tests pass"
PASS  src/auth/login.test.ts
  Login flow
    - returns token for valid credentials (12ms)
    - rejects invalid password (3ms)
    - locks account after 5 failed attempts (8ms)

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

If any test fails, fix it before claiming complete. Do not skip failing tests.

### 2. Type Checks Pass

Run the type checker with no errors.

```
# TypeScript
tsc --noEmit

# Or your language's equivalent static analysis
```

Zero errors, zero warnings on changed files. Pre-existing warnings in unrelated files can be noted but are not your responsibility.

### 3. Linting Passes

Run the project's linter on changed files. Fix any violations introduced by your changes.

### 4. The Feature Actually Works

For user-facing changes, demonstrate the feature works by showing actual output -- API responses, rendered UI, CLI output. Screenshots or copy-pasted terminal output are acceptable evidence.

```
# Example: verifying an API endpoint
$ curl -s localhost:3000/api/users/1 | jq .
{
  "id": "1",
  "name": "Alice",
  "email": "alice@example.com"
}
```

## Edge Cases

Test boundaries and unusual inputs explicitly. Common edge cases to verify:

- **Empty inputs.** Empty strings, empty arrays, null, undefined.
- **Boundary values.** Zero, negative numbers, maximum values, off-by-one.
- **Invalid inputs.** Wrong types, malformed data, missing required fields.
- **Concurrent access.** What happens with simultaneous requests or operations?
- **Error paths.** Network failures, database errors, permission denied.

Do not assume edge cases work because the happy path works. Test them.

## Regression Check

Changes in one area can break behavior in another. Before completion:

- **Run related tests.** Not just the tests you wrote -- run tests for modules that depend on the code you changed.
- **Check integration points.** If you changed a shared utility, API contract, or database schema, verify consumers still work.
- **Smoke test the application.** If the project has a running application, verify it starts and basic flows work.

## Evidence Format

When reporting completion, include concrete evidence:

```
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

- **"It works on my machine" failures.** Evidence shows it works in a verifiable way.
- **Phantom completions.** Tasks marked done that are actually broken.
- **Regression blindness.** Catching breakage before it reaches review or production.
- **Incomplete implementations.** Edge cases and error handling are verified, not assumed.
