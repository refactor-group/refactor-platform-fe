## Context Loading Commands

**`/load-context $ARGUMENTS`**
```yaml
---
command: "/load-context"
category: "Analysis & Investigation"
purpose: "Comprehensive project context loading with architecture and dependency analysis"
wave-enabled: false
performance-profile: "complex"
---
```
- **Auto-Persona**: Analyzer, Architect
- **MCP Integration**: Context7 (primary), Sequential (analysis coordination)
- **Tool Orchestration**: [Read, Grep, Glob, Bash, TodoWrite]
- **Combined Operations**: 
  - Project architecture analysis: `/analyze @. --scope project --c7 --focus architecture`
  - Dependency analysis: `/analyze package.json --focus dependencies --c7 --think`
- **Arguments**: `[target]`, `@<path>`, `--<flags>`
- **Purpose**: Loads comprehensive project context including existing patterns, dependencies, and architecture decisions to inform implementation choices

**Usage Examples**:
- `/load-context` - Full project context loading
- `/load-context --focus patterns` - Focus on existing code patterns
- `/load-context --focus tech-stack` - Focus on technology stack and dependencies