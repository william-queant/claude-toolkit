# /pr-summary

> Generate a structured pull request summary from the current branch.

**Type:** Command (slash command)
**Source:** [`core/commands/ct/pr-summary.md`](../core/commands/ct/pr-summary.md)
**Allowed Tools:** Bash, Read

## Usage

```
/pr-summary
```

## Workflow

1. **Identify the base branch** -- checks for `main` or `master`, uses `git merge-base` to find the common ancestor
2. **Gather the diff** -- runs `git diff {base}...HEAD --stat` for overview and full diff for details
3. **Gather commit history** -- runs `git log {base}...HEAD --oneline --no-merges`
4. **Analyze changes** -- reads modified files to understand the "why" behind each change
5. **Generate the summary**

## Output Format

```markdown
## Summary
{1-3 bullet points describing the high-level purpose}

## What Changed

### {Category} (e.g., "Authentication", "Database", "UI")
- `{file}` - {what changed and why}

## Impact Assessment
- **Risk level:** low | medium | high
- **Affected areas:** {list of features or systems impacted}
- **Breaking changes:** none, or description
- **Migration needed:** none, or description

## Testing Notes
- {How to test this change}
- {Key scenarios to verify}
```

## Notes

- Infers the "why" from commit messages, code comments, and the nature of changes
- Groups related file changes under meaningful categories
- Honest about risk level -- flags potential issues in Testing Notes
- Designed to be scannable in under 60 seconds
