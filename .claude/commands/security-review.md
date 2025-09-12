Conduct a security-focused review of this Next.js/React/TypeScript code. Check for:

**INJECTION VULNERABILITIES**
- SQL injection in API routes
- XSS vulnerabilities in JSX rendering
- Command injection in server-side code
- NoSQL injection patterns

**AUTHENTICATION & AUTHORIZATION**
- Insecure session management
- Missing authorization checks
- Token exposure or leakage
- Privilege escalation risks

**DATA EXPOSURE**
- Hardcoded secrets or API keys
- Sensitive data in client bundles
- Information disclosure in error messages
- PII handling violations

**NEXT.JS SPECIFIC SECURITY**
- Server-side rendering (SSR) vulnerabilities
- API route security issues
- Image optimization SSRF risks
- Static file exposure concerns

**CONFIGURATION ISSUES**
- Insecure CSP headers
- Missing security headers
- Unsafe SVG handling
- Production source map exposure

Provide specific recommendations for each finding with code examples.