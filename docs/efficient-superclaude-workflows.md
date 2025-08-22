# Efficient SuperClaude Workflows - No Rewrites Edition

## 🎯 Core Principle: Context First, Simple Solutions, Zero Rewrites

This guide provides streamlined workflows that front-load codebase context and modern best practices to get simple, idiomatic solutions on the first try.

---

## 🚀 The Context-First Startup Sequence

**Always start with this before any development work:**

```bash
# NEW: One-command context loading (combines both analyses)
/load-context

# OR manually (if /load-context unavailable):
/analyze @. --scope project --c7 --focus architecture
/analyze package.json --focus dependencies --c7 --think
```

**What this does:**
- Analyzes your entire codebase patterns and conventions
- Loads current framework best practices via Context7
- Sets up Claude Code to match your existing style
- Prevents the majority of rewrites by establishing proper context

---

## 🏗️ Feature Development Workflow (5-Step Process)

### Step 1: Requirements Collaboration
```bash
# Start collaborative requirements session
/design [feature-name] --type spec --format prd --interactive ask me one question at a time. The output will be a PRD located at /docs/features/[feature-name]/prd.md

# Example
/design user-authentication --type spec --format prd --interactive ask me one question at a time. The output will be a PRD located at /docs/features/[feature-name]/prd.md
```
**Process:** Claude Code interviews you one question at a time to fully understand requirements, user stories, acceptance criteria, and technical constraints.

### Step 2: PRD Generation
```bash
# Generate comprehensive PRD document
# (Automatic output to /docs/features/[feature-name]-[timestamp].md)

# Example output: /docs/features/user-authentication/prd.md
```
**Content:** Complete Product Requirements Document with user stories, acceptance criteria, technical requirements, and success metrics.

### Step 3: Implementation Planning
```bash
# Generate implementation plan from PRD
/workflow /docs/features/[feature-name]/prd.md --strategy systematic --c7 --sequential Output plan to /docs/features/[feature-name]/implementation-plan.md. Esnure that we are using existing patterns and the most modern, idiomatic best practices.

# Iterate on plan if needed
/improve @plan --focus simplicity --preview

# Example
/workflow /docs/features/user-authentication/prd.md --strategy systematic --c7 --sequentialOutput plan to /docs/features/user-authentication/implementation-plan.md
```
**Process:** Generate detailed implementation plan, review and iterate until approved.

### Step 4: Iterative Implementation
```bash
# Execute plan step-by-step with approval gates
/implement --from-plan /docs/features/[feature-name]/implementation-plan.md --c7 --safe --preview --iterative --with-tests --tdd At the end of implementation, output a brief and concise implementation summary to /docs/features/[feature-name]/implementation-summary.md. This summary should include decisions that were made during implementation and how they differ from the original implementation plan.
# [Review and approve]
```
---

## ⚡ Rapid Prototyping Workflows

### Quick Feature Proof-of-Concept
```bash
# Context first
/analyze @. --scope project --c7

# All-in-one feature implementation
/implement "[feature description]" --type mvp --magic --c7 --safe --preview
```

### API-First Prototyping
```bash
# Generate working API with mock data
/implement "[feature] API with mock data" --type api --c7 --mock-data --safe --preview
```

---

## 🔧 Code Quality & Refactoring Workflows

### Smart Refactoring (Zero Risk)
```bash
# Always preview improvements first
/improve @[path] --preview --focus quality --safe-mode --c7

# Apply after review
/improve @[path] --focus quality --safe-mode --c7
```

### Technical Debt Cleanup
```bash
# Systematic debt analysis and fixes
/analyze @. --focus quality --think-hard
/cleanup @[problem-areas] --safe --iterative --preview
```

### Performance Optimization
```bash
# Identify and fix bottlenecks
/analyze @[feature] --focus performance --think --c7
/improve @[bottlenecks] --focus performance --safe --validate --preview
```

---

## 🎭 Auto-Persona Optimization

**Let SuperClaude pick the right expert automatically. Only override when needed:**

### When to manually specify personas:
- `--persona-security` for authentication/sensitive data features
- `--persona-performance` for optimization-focused work
- `--persona-architect` for system design decisions

### Trust auto-activation for:
- Feature implementation (smart persona selection)
- Code quality improvements (quality-focused personas)
- API development (backend persona)
- UI development (frontend persona)

---

## 🚦 Efficiency Flags Quick Reference

### Must-Use Efficiency Flags
- `--c7` - Always use for modern best practices and framework patterns
- `--safe` - Prevents breaking changes, essential for refactoring
- `--preview` - See changes before applying (mandatory for Step 5)
- `--interactive` - For collaborative requirements gathering

### Development-Specific Optimization
- **Requirements**: `--type spec --format prd --interactive`
- **Planning**: `--strategy systematic --c7 --sequential`
- **Implementation**: `--from-plan [path] --c7 --safe --preview`
- **Refactoring**: `--preview --safe-mode --c7 --focus simplicity`

---

## ⏱️ Time-Saving Command Patterns

### Single-Command Feature Analysis
```bash
# Quick pattern check before implementing
/analyze @[similar-existing-feature] --focus patterns --think --c7
```

### Batch Component Creation
```bash
# Multiple related components from plan
/implement ui-components --from-plan [prd-path] --magic --c7 --safe --preview --batch
```

### Smart Context Switching
```bash
# Load context for specific feature area
/analyze @[feature-directory] --scope module --c7 --focus patterns
```

---

## 🎯 Workflow Decision Tree

### New Feature (Unknown complexity)
→ Use 5-Step Feature Development Workflow
1. Requirements collaboration
2. PRD generation  
3. Implementation planning
4. Plan documentation
5. Iterative implementation with approval gates

### Quick Prototype (Known simple scope)
→ Use Rapid Prototyping
1. Context loading
2. Direct implementation with preview

### Code Quality Improvement (Existing code)
→ Use Smart Refactoring
1. Analysis with modern patterns
2. Preview improvements  
3. Apply with approval

### Performance Issue (Critical bottleneck)
→ Use Performance Optimization
1. Deep analysis with thinking
2. Targeted improvements with validation

---

## 🔧 Process Enforcement Rules

### Enforcing One Question at a Time
```bash
# If Claude asks multiple questions, immediately interrupt:
"Stop. Please ask me only ONE question at a time. What is your first question?"

# Or use this pre-flight template:
"I want you to ask me exactly one question at a time during requirements gathering. Wait for my complete answer before asking the next question. Confirm you understand this process before we begin."
```

### Enforcing Correct File Paths
```bash
# Always specify exact output path:
--output "/docs/features/[feature-name]/prd.md"

# Verify file location before proceeding:
"Please confirm the exact file path where you will save the PRD before we start."
```

### Process Recovery
```bash
# If process goes off-track:
"Let's reset. Please follow our 5-step process: 1) Requirements collaboration 2) PRD generation 3) Implementation planning 4) Plan documentation 5) Iterative implementation. We are currently at step [X]."
```

---

## 🚫 Anti-Patterns to Avoid

### Don't:
- Skip the context-loading step (causes 90% of rewrites)
- Allow multiple questions in requirements phase
- Implement without `--preview` in Step 5
- Use complex commands when simple ones work
- Skip the pre-flight confirmation
- Apply changes without approval gates
- Forget `--c7` flag for best practices
- Accept PRDs saved to wrong locations

### Do:
- Front-load context with `/analyze`
- Use pre-flight confirmation for process enforcement
- Interrupt immediately if Claude deviates from one-question rule
- Always preview before implementation
- Follow the 5-step process religiously
- Trust auto-persona selection
- Verify file paths before proceeding
- Maintain single source of truth in PRD

---

## 📊 Success Indicators

**You'll know the workflow is working when:**
- First-try implementations match your expectations
- Code follows your existing patterns consistently
- No major rewrites needed after implementation
- Features integrate seamlessly with existing codebase
- Implementation matches approved plans exactly

---

## 🔄 Recovery Strategies

**If you get a non-idiomatic solution:**

```bash
# Quick fix without starting over
/improve @[problematic-code] --focus simplicity --c7 --safe --preview
```

**Prevention checklist:**
- ✅ Did you load project context first?
- ✅ Did you use `--c7` for best practices?
- ✅ Did you preview before applying?
- ✅ Was the implementation plan detailed enough?

---

**Remember: Proper requirements collaboration and context loading prevents the majority of rewrites and ensures idiomatic, maintainable code.**