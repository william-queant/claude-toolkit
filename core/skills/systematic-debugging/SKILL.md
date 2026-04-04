---
name: Systematic Debugging
description: Four-phase methodology for diagnosing and fixing bugs efficiently without guesswork.
---

# Systematic Debugging

A disciplined approach to debugging that replaces trial-and-error with structured investigation. Apply these phases in order -- skipping phases leads to wasted time and incomplete fixes.

## Phase 1: Observe

Reproduce the issue and gather evidence before forming any theories.

- **Reproduce reliably.** Find the minimal steps to trigger the bug. If you cannot reproduce it, you cannot verify a fix.
- **Read the actual error.** Read the full stack trace, error message, and relevant logs. Do not skim.
- **Check recent changes.** Use `git log` and `git diff` to identify what changed since the last known-good state.
- **Gather context.** Note the environment, input data, user actions, and timing. Intermittent bugs often depend on state or ordering.
- **Record observations.** Write down what you see, not what you think is happening.

## Phase 2: Hypothesize

Form theories based on evidence, not intuition.

- **List possible causes.** Generate at least 2-3 hypotheses before investigating any of them.
- **Rank by likelihood.** Consider: What changed recently? What is the simplest explanation? Where does the evidence point?
- **Consider the data flow.** Trace the path from input to error. Where could the data become incorrect?
- **Check assumptions.** The bug is often in the code you trust most. Verify that dependencies, configs, and environment match expectations.

## Phase 3: Test

Isolate variables and verify one hypothesis at a time.

- **Test one thing at a time.** Change a single variable per experiment. Multiple changes at once produce ambiguous results.
- **Use the smallest possible test.** Write a minimal reproduction -- a unit test, a script, or a reduced input case.
- **Add logging at boundaries.** Log inputs and outputs at function boundaries, API calls, and data transformations.
- **Disprove hypotheses.** A hypothesis that cannot be disproven is not useful. Design tests that would show the hypothesis is wrong.
- **Binary search large spaces.** When the problem could be anywhere in a large codebase or dataset, bisect systematically.

## Phase 4: Fix

Apply the minimal correct fix, then verify thoroughly.

- **Fix the root cause, not the symptom.** If a null check prevents a crash but the value should never be null, fix the source of the null.
- **Make the smallest change possible.** Large fixes introduce new bugs. Change only what is necessary.
- **Verify the fix.** Run the reproduction case and confirm the bug is gone. Do not assume.
- **Check for regressions.** Run the full test suite. The fix should not break existing behavior.
- **Add a test for the bug.** If no test caught this bug, write one. Prevent the same class of bug from recurring.
- **Document the fix.** In the commit message, explain what caused the bug and why the fix is correct.

## Anti-patterns

- **Shotgun debugging.** Making random changes hoping something works. Every change should be driven by a hypothesis.
- **Fixing symptoms.** Adding null checks, try/catch blocks, or default values without understanding why the unexpected state occurs.
- **Debugging by rewriting.** Rewriting a module because you cannot find the bug. The bug may survive the rewrite or new bugs may appear.
- **Ignoring intermittent failures.** "It works now" is not a fix. Intermittent bugs are usually race conditions, state leaks, or environment dependencies.
- **Assuming the bug is elsewhere.** Check your own code first. The framework, library, or runtime is almost never the problem.
