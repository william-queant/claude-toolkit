---
description: Onboard yourself to a codebase area or task
argument-hint: "[area]"
allowed-tools:
  - Bash(git log:*)
  - Bash(git ls-files:*)
  - Bash(git remote:*)
  - Bash(ls:*)
  - Bash(find:*)
  - Read
  - Glob
  - Grep
---

# Codebase Onboarding

Systematically explore and understand a codebase area, module, or task context. Produce a structured summary of findings.

## Workflow

1. **Understand the scope.** The scope is given by `$ARGUMENTS` (e.g., "the auth module", "the payments flow", "this repo"). If `$ARGUMENTS` is empty, start from the project root.

2. **Read foundational files first:**
   - `README.md`, `CLAUDE.md`, `CONTRIBUTING.md` (project conventions)
   - `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod` (dependencies and scripts)
   - Config files (`.env.example`, `docker-compose.yml`, CI configs)
   - Entry points (`src/index.*`, `src/main.*`, `app.*`, `cmd/`)

3. **Map the architecture:**
   - Identify the directory structure and what each top-level folder contains
   - Find entry points and trace the request/data flow
   - Identify key abstractions (models, services, controllers, middleware)
   - Note design patterns in use (repository pattern, dependency injection, etc.)

4. **Identify conventions:**
   - Naming conventions (files, functions, variables)
   - Error handling patterns
   - Testing patterns (frameworks, file placement, naming)
   - State management approach

5. **Understand dependencies:**
   - Key external libraries and what they're used for
   - Internal module dependencies and boundaries
   - Database schema or data models

6. **Ask clarifying questions** if the codebase has ambiguities, undocumented conventions, or conflicting patterns.

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
  - `src/services/` - {purpose}
  - ...

### Key Files
| File | Purpose | Notes |
|------|---------|-------|
| ...  | ...     | ...   |

### Data Flow
{How a request/action flows through the system, from entry to response}

### Conventions
- **Naming:** {patterns observed}
- **Error handling:** {approach}
- **Testing:** {framework, patterns, location}

### Questions / Gaps
- {Things that are unclear or undocumented}
```

## Notes

- Prioritize understanding over completeness. It is better to deeply understand 5 key files than to skim 50.
- Note what is NOT there (missing tests, missing docs, missing error handling) as well as what is.
- If onboarding for a specific task, focus exploration on the areas relevant to that task.
