---
name: Systematic Debugging
description: Four-phase methodology for diagnosing and fixing bugs efficiently without guesswork.
---

# Systematic Debugging

Replace trial-and-error with structured investigation. Follow phases in order.

## Phase 1: Observe

- Reproduce reliably with minimal steps. No repro = no verified fix.
- Read the full stack trace and error message. Do not skim.
- `git log`/`git diff` to identify what changed since last known-good state.
- Record observations (environment, input, timing), not theories.

## Phase 2: Hypothesize

- List 2-3 possible causes before investigating any.
- Rank by: what changed recently, simplest explanation, where evidence points.
- Trace data flow from input to error. Check assumptions about dependencies/configs.

## Phase 3: Test

- Change one variable per experiment. Multiple changes = ambiguous results.
- Write minimal reproduction (unit test, script, reduced input).
- Add logging at function boundaries and data transformations.
- Design tests that would **disprove** each hypothesis.
- Binary search large problem spaces systematically.

## Phase 4: Fix

- Fix root cause, not symptom. A null check that hides a null source is not a fix.
- Smallest change possible. Run reproduction to confirm fix.
- Run full test suite for regressions. Add a test for this bug class.
- Commit message explains cause and why fix is correct.

## Anti-Patterns

1. **Shotgun debugging** -- Random changes without hypotheses.
2. **Fixing symptoms** -- Null checks/try-catch without understanding the unexpected state.
3. **Debug by rewriting** -- Bug may survive the rewrite; new bugs may appear.
4. **"It works now"** -- Intermittent bugs are race conditions or state leaks. Investigate.
5. **Assuming the bug is elsewhere** -- Check your own code first. The framework is rarely the problem.
