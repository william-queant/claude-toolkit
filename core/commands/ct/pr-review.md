---
description: Review a pull request using project standards
argument-hint: "[pr-number]"
allowed-tools:
  - Bash(gh pr view:*)
  - Bash(gh pr diff:*)
  - Bash(gh pr checkout:*)
  - Bash(git diff:*)
  - Bash(git log:*)
  - Bash(git merge-base:*)
  - Bash(git branch:*)
  - Read
  - Task
---

# Pull Request Review

Review the current branch's PR, or a specific PR number passed as `$ARGUMENTS`, by delegating the analysis to the `ct-code-reviewer` agent — the single source of truth for the review checklist, severity model, and output format.

## Workflow

1. **Get PR context.**
   - If `$ARGUMENTS` contains a PR number, fetch the PR's **actual** changes (metadata alone has no patch):
     - `gh pr view $ARGUMENTS --json title,body,files,commits` for the title, description, and file list.
     - `gh pr diff $ARGUMENTS` to read the actual patch.
     - If you need to read changed files at the PR's revision rather than the local checkout, run `gh pr checkout $ARGUMENTS` first so the working tree matches the PR branch.
   - Otherwise (no PR number), diff the current branch against its base branch (`main` or `master`): resolve the base with `git merge-base`, then use `git diff {base}..HEAD` and `git log {base}..HEAD --oneline --no-merges`.

2. **Delegate the review to the `ct-code-reviewer` agent.** Spawn the `ct-code-reviewer` agent with the Task tool, handing it the PR title/description and the diff (and, when you ran `gh pr checkout`, permission to read the changed files in full). The agent applies its own review checklist, severity model, and output format — do not restate them here.

3. **Return the agent's review to the user verbatim.** Add a one-line note only if you had to skip something (e.g. the PR was too large to check out, or `gh` was unavailable).

## Notes

- The `ct-code-reviewer` agent is the canonical review checklist and output format. This command only gathers context and delegates, so the checklist and severity model never drift between the two.
- Prefer `gh pr diff` / `gh pr checkout` over reading local files when a PR number is given — the local branch is usually not the PR branch.
- If the PR is too large to review effectively, say so and suggest splitting it.
- If `gh` is not installed or the PR number is invalid, fall back to reviewing the current branch's diff against its base.
