# Coding Standards

This document outlines coding conventions and standards for this project.

## React and TypeScript

### Import Conventions

**React Imports**: Always import specific hooks and types from React rather than using the `React.` prefix.

```typescript
// ✅ Correct
import { useState, useEffect, useCallback } from "react";
import type { FC, ReactNode } from "react";

export const MyComponent: FC = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // effect logic
  }, []);

  return <div>{count}</div>;
};

// ❌ Incorrect
import React from "react";

export const MyComponent: React.FC = () => {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    // effect logic
  }, []);

  return <div>{count}</div>;
};
```

**Rationale**:
- Improves code readability by making hook usage more explicit
- Reduces verbosity and visual clutter
- Aligns with modern React conventions and tree-shaking optimization
- Consistent with the rest of the codebase

### Type Annotations

- Use explicit function component typing sparingly - TypeScript can often infer the type
- When needed, import `FC` or `ReactNode` types explicitly from React
- Prefer explicit return types for component props interfaces

```typescript
// ✅ Good - TypeScript infers the component type
export const SimpleComponent = () => {
  return <div>Hello</div>;
};

// ✅ Good - explicit typing when needed for props
import type { FC, ReactNode } from "react";

interface Props {
  children: ReactNode;
  title: string;
}

export const ComplexComponent: FC<Props> = ({ children, title }) => {
  return <div>{title}{children}</div>;
};
```

## General Guidelines

### Naming Conventions
- Use PascalCase for component names and files: `ConnectionStatus.tsx`
- Use PascalCase for enum types: `ConnectionState`, `BadgeVariant`
- Use PascalCase for enum values: `ConnectionState.Connecting`, `BadgeVariant.Secondary`
- Use camelCase for functions, variables, and hooks: `useEditorCache`, `handleClick`
- Use SCREAMING_SNAKE_CASE for constants: `MAX_RETRIES`, `API_ENDPOINT`

```typescript
// ✅ Correct - PascalCase for enum types and values
enum ConnectionState {
  Connecting = "connecting",
  Connected = "connected",
  Offline = "offline",
  Error = "error",
}

// ❌ Incorrect - lowercase or SCREAMING_SNAKE_CASE
enum connectionState {
  CONNECTING = "connecting",
  CONNECTED = "connected",
}
```

### File Organization
- Keep React components in `src/components/`
- Place tests in `__tests__/` directories mirroring the source structure
- Group related components in feature-specific subdirectories

### UI Component Libraries

This project uses two UI component libraries with different import paths:

**shadcn/ui components** - Located in `src/components/ui/`
```typescript
// ✅ Correct - shadcn components
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
```

**Kibo UI components** - Located in `src/components/kibo/ui/`
```typescript
// ✅ Correct - Kibo UI components
import { Pill, PillIndicator } from "@/components/kibo/ui/pill";
import { Choicebox, ChoiceboxItem } from "@/components/kibo/ui/choicebox";
```

**Utility function `cn`** - Located in `src/components/lib/utils.ts`
```typescript
// ✅ Correct
import { cn } from "@/components/lib/utils";

// ❌ Incorrect - this path doesn't exist in this project
import { cn } from "@/lib/utils";
```

**Note**: When installing new shadcn components via CLI, you may need to update their imports from `@/lib/utils` to `@/components/lib/utils`.

### Documentation
- Add JSDoc comments for complex logic or non-obvious patterns
- Explain *why* something is done, not just *what* is being done
- Document external state synchronization patterns (like forceUpdate mechanisms)

## Code Review Checklist

When reviewing or writing code, ensure:
- [ ] React hooks are imported directly, not accessed via `React.`
- [ ] Components follow the established import patterns
- [ ] Enum types and values use PascalCase
- [ ] Complex logic has explanatory comments
- [ ] Tests are updated to match code changes
- [ ] TypeScript types are properly defined and used
