# refactor-platform-fe Project Instructions

## Mandatory File Consultations

**Nullable Types** → **Never write `T | null` or `T | undefined` by default.** Use `Maybe<T>` or `Result<T, E>` from `true-myth`. See `.claude/coding-standards.md` § "Strict Typing and Nullability" for the full hierarchy and when bare `null` is acceptable.
**Code Implementation/Editing** → Read `.claude/coding-standards.md` FIRST
**Pull Request Operations** → Read `.claude/pr-instructions.md` FIRST

## Rules
- Project standards override global defaults on conflict
- Validate all code against standards before task completion
- PR reviews require both files if coding standards referenced
