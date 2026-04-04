# /onboard

> Systematically explore and understand a codebase area, module, or task context.

**Type:** Command (slash command)
**Source:** [`core/commands/ct/onboard.md`](../core/commands/ct/onboard.md)
**Allowed Tools:** Bash, Read, Glob, Grep

## Usage

```bash
/onboard [area]
```

If no area is specified, starts from the project root.

## Workflow

1. **Understand the scope** -- the user specifies an area (e.g., "the auth module", "the payments flow") or the entire repo
2. **Read foundational files** -- `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `package.json`, config files, entry points
3. **Map the architecture** -- directory structure, entry points, request/data flow, key abstractions, design patterns
4. **Identify conventions** -- naming, error handling, testing patterns, state management
5. **Understand dependencies** -- key external libraries, internal module boundaries, database schema
6. **Ask clarifying questions** if ambiguities or undocumented conventions exist

## Output Format

```markdown
## Onboarding Summary: {area}

### Tech Stack
- **Language:** {language and version}
- **Framework:** {framework}
- **Key libraries:** {list with purpose}
- **Database:** {if applicable}

### Architecture
{2-4 sentences describing the overall structure}

### Directory Map
- `src/` - {purpose}
  - `src/models/` - {purpose}

### Key Files
| File | Purpose | Notes |

### Data Flow
{How a request/action flows through the system}

### Conventions
- **Naming:** {patterns observed}
- **Error handling:** {approach}
- **Testing:** {framework, patterns, location}

### Questions / Gaps
- {Things that are unclear or undocumented}
```

## Best Practices Reference

Conventions to look for during onboarding:

| Topic | Guide |
| --- | --- |
| TypeScript conventions and patterns | [TypeScript Best Practices](../best-practices/typescript/README.md) |
| SolidJS conventions and patterns | [SolidJS Best Practices](../best-practices/solidjs/README.md) |

## Notes

- Prioritizes understanding over completeness -- deeply understand 5 key files rather than skim 50
- Notes what is NOT there (missing tests, docs, error handling) as well as what is
- If onboarding for a specific task, focuses exploration on the relevant areas
