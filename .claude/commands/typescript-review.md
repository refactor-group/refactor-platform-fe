Perform a TypeScript-focused review of this Next.js/React code:

**TYPE SAFETY**
- Eliminate all 'any' types unless absolutely necessary
- Ensure proper prop typing with interfaces
- Check for missing type annotations
- Validate generic type usage

**TYPE DEFINITIONS**
- Interface vs type appropriateness
- Proper extending and composition
- Utility type usage (Pick, Omit, Partial, etc.)
- Enum vs const assertions

**REACT TYPESCRIPT PATTERNS**
- Component prop interfaces
- Event handler typing
- Ref typing and forwarding
- Children prop typing
- Proper typing for hooks

**NEXT.JS TYPESCRIPT**
- Page component typing
- API route request/response types
- Middleware typing
- Static props and paths typing

**BEST PRACTICES**
- Strict mode compliance
- Import/export consistency
- Type-only imports when appropriate
- Proper module declaration files

**ADVANCED TYPESCRIPT PATTERNS**
- Discriminated unions for state management
- Template literal types for API routes
- Conditional types for complex logic
- Mapped types for transformations
- Branded types for domain modeling
- Phantom types for compile-time validation

**TYPE COMPOSITION & DESIGN**
- Favor composition over inheritance
- Use branded types for IDs and special values
- Leverage const assertions for immutable data
- Apply proper variance with readonly/mutable patterns
- Use assertion functions for type narrowing

**ERROR HANDLING & VALIDATION**
- Type predicate functions for runtime validation (e.g., isUser, isValidData)
- Parse functions with proper error handling and transformation
- Custom Error classes with rich type information and readonly properties
- Proper error boundary patterns and error propagation
- Const assertions vs enums for controlled value sets
- Default value factories for consistent object creation

**PERFORMANCE & MAINTAINABILITY**
- Avoid deeply nested conditional types
- Use type aliases for complex unions
- Minimize type instantiation overhead
- Prefer interfaces for extensible types
- Use module augmentation properly

**NEXT.JS SPECIFIC PATTERNS**
- Proper typing for getServerSideProps/getStaticProps
- API route parameter extraction types
- Middleware request/response augmentation
- App Router typing patterns
- Server component vs client component typing

**CODE ORGANIZATION**
- Consistent naming conventions (PascalCase for types)
- Logical type file organization
- Proper barrel exports for types
- Domain-driven type boundaries
- Type-first development approach

Suggest specific type improvements with examples and identify opportunities for better type design.