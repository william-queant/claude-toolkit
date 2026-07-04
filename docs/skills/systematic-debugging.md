# Systematic Debugging

> Four-phase methodology for diagnosing and fixing bugs efficiently without guesswork. Use when investigating a bug, test failure, or unexpected behavior before proposing a fix

**Type:** Core Skill (always included)
**Source:** [`core/skills/ct-systematic-debugging/SKILL.md`](../core/skills/ct-systematic-debugging/SKILL.md)

## Overview

A disciplined approach to debugging that replaces trial-and-error with structured investigation. Apply the four phases in order -- skipping phases leads to wasted time and incomplete fixes.

## Phases

### Phase 1: Observe

Reproduce the issue and gather evidence before forming any theories.

- **Reproduce reliably** -- find the minimal steps to trigger the bug
- **Read the actual error** -- full stack trace, error message, and relevant logs
- **Check recent changes** -- use `git log` and `git diff` to identify what changed
- **Gather context** -- note the environment, input data, user actions, and timing
- **Record observations** -- write down what you see, not what you think is happening

### Phase 2: Hypothesize

Form theories based on evidence, not intuition.

- **List possible causes** -- generate at least 2-3 hypotheses before investigating any
- **Rank by likelihood** -- what changed recently? What is the simplest explanation?
- **Consider the data flow** -- trace the path from input to error
- **Check assumptions** -- the bug is often in the code you trust most

### Phase 3: Test

Isolate variables and verify one hypothesis at a time.

- **Test one thing at a time** -- change a single variable per experiment
- **Use the smallest possible test** -- write a minimal reproduction
- **Add logging at boundaries** -- log inputs and outputs at function boundaries
- **Disprove hypotheses** -- design tests that would show the hypothesis is wrong
- **Binary search large spaces** -- bisect systematically when the problem could be anywhere

### Phase 4: Fix

Apply the minimal correct fix, then verify thoroughly.

- **Fix the root cause, not the symptom** -- if a null check prevents a crash but the value should never be null, fix the source
- **Make the smallest change possible** -- large fixes introduce new bugs
- **Verify the fix** -- run the reproduction case and confirm the bug is gone
- **Check for regressions** -- run the full test suite
- **Add a test for the bug** -- prevent the same class of bug from recurring
- **Document the fix** -- explain what caused the bug and why the fix is correct in the commit message

## Anti-patterns

| Anti-pattern | Description |
|---|---|
| **Shotgun debugging** | Making random changes hoping something works. Every change should be driven by a hypothesis. |
| **Fixing symptoms** | Adding null checks, try/catch blocks, or default values without understanding why the unexpected state occurs. |
| **Debugging by rewriting** | Rewriting a module because you cannot find the bug. The bug may survive the rewrite. |
| **Ignoring intermittent failures** | "It works now" is not a fix. Intermittent bugs are usually race conditions, state leaks, or environment dependencies. |
| **Assuming the bug is elsewhere** | Check your own code first. The framework or library is almost never the problem. |

## Trigger Conditions

This skill is automatically suggested when Claude detects:

- **Keywords:** `bug`, `debug`, `fix`, `error`, `issue`, `broken`, `crash`
- **Intent patterns:** "fix/debug/resolve the bug/error/issue"
- **Excludes:** "fix typo", "fix formatting", "fix lint"
