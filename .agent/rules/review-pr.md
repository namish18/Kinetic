---
description: Rules and checklist for reviewing GitHub Pull Requests in the Kinetic repository.
---

# Kinetic — Pull Request Review Rules

When asked to review a branch, diff, or Pull Request, act as a strict senior maintainer. Do not modify files unless explicitly instructed. Output your findings as a structured **PR Review Artifact**.

## 1. PR Hygiene & Contributor Scope
- **Issue Alignment:** Verify that the diff solves a single, clearly scoped issue and matches the agreed-upon plan of action. Flag unrelated refactors, formatting-only noise, or scope creep.
- **No Stray Artifacts:** Flag accidentally committed secrets (`.env`, API keys, tokens), lockfile conflicts, OS junk (`.DS_Store`, `Thumbs.db`), debug logs (`console.log`, `print`), or commented-out dead code.
- **Documentation & Templates:** Check whether user-facing changes, new env vars, or CLI/API updates are reflected in `README.md` or relevant docs.

## 2. CI Sanity Gate Parity
Before approving, check that the changes will pass the checks defined in `.github/workflows/ci.yml` (inspect that file in the workspace for the exact commands):
- **Linting & Formatting:** Code adheres to the repo's configured linter and formatter with zero new warnings.
- **Type & Build Checks:** The project compiles/builds cleanly with no broken imports or type regressions.
- **Tests:** Existing unit/integration tests pass, and new logic or bug fixes include targeted tests covering happy paths and edge cases.

## 3. Code Quality, Architecture & Security
- **Correctness & Edge Cases:** Trace null/undefined states, empty inputs, race conditions, async error handling, and boundary conditions.
- **Architectural Consistency:** Ensure new files follow existing folder conventions, naming patterns, and shared utilities rather than introducing duplicate helpers or new dependencies unnecessarily.
- **Security & Data Safety:** Check for unvalidated user input, injection risks, improper auth/permission checks, insecure defaults, and unsafe error leaks.
- **Performance:** Flag N+1 queries, unnecessary re-renders, blocking I/O on main threads, or unbounded loops/memory growth.

## 4. Project-Specific Stack Rules
<!-- Auto-populate this section from the repo's package.json / pubspec.yaml / pyproject.toml / ci.yml -->
- **Primary Stack:** [Fill in or let Antigravity detect from workspace]
- **Key Architectural Patterns:** [e.g., folder structure, state management, API layer rules]
- **Verification Commands:** [e.g., exact lint, test, and build commands from `.github/workflows/ci.yml`]

## 5. Required Output Format (PR Review Artifact)
Structure every review in this exact order:

1. **Verdict:** `APPROVE`, `REQUEST CHANGES`, or `NEEDS DISCUSSION` with a 2-sentence summary.
2. **Blockers (Must Fix):** Critical bugs, security flaws, broken builds, or missing core requirements — with exact `file:line` references and concrete fix suggestions.
3. **Improvements (Should Fix):** Maintainability, performance, edge cases, or missing test coverage — with `file:line` references.
4. **Nits (Optional):** Naming, readability, or minor cleanup.
5. **Verification Checklist:** List the exact local commands or browser flows to run before merging.