---
description: Generate a PR summary from the current branch
allowed-tools:
  - Bash(git diff:*)
  - Bash(git log:*)
  - Bash(git merge-base:*)
  - Bash(git branch:*)
  - Read
---

# PR Summary Generator

Generate a structured pull request summary by analyzing the diff and commit history of the current branch against its base.

## Workflow

1. **Identify the base branch.** Check for `main` or `master`. Use `git merge-base` to find the common ancestor.

2. **Gather the diff.** Run `git diff {base}...HEAD --stat` for an overview and `git diff {base}...HEAD` for full changes.

3. **Gather commit history.** Run `git log {base}..HEAD --oneline --no-merges` (two-dot: commits on HEAD but not on base) to understand the progression of changes.

4. **Analyze changes** by reading modified files to understand the "why" behind each change. Group related changes together.

5. **Generate the summary.**

## Output Format

```markdown
## Summary

{1-3 bullet points describing the high-level purpose of this PR}

## What Changed

### {Category 1} (e.g., "Authentication", "Database", "UI")
- `{file}` - {what changed and why}
- `{file}` - {what changed and why}

### {Category 2}
- ...

## Impact Assessment

- **Risk level:** {low | medium | high}
- **Affected areas:** {list of features or systems impacted}
- **Breaking changes:** {none, or describe}
- **Migration needed:** {none, or describe}

## Testing Notes

- {How to test this change}
- {Key scenarios to verify}
- {Any manual testing required}
```

## Notes

- Infer the "why" from commit messages, code comments, and the nature of changes. Do not just list file names.
- Group related file changes under meaningful categories, not one-file-per-bullet.
- Be honest about risk level. If you see potential issues, flag them in Testing Notes.
- Keep it concise. The summary should be scannable in under 60 seconds.
