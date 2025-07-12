# Frontend Testing Strategy for Next.js/TypeScript/React (2025)

## **Recommended Testing Stack** 🏆

### **Core Framework**
- **Vitest** (Unit/Integration) - Faster Jest alternative with excellent TypeScript support
- **React Testing Library** (Component testing) - Industry standard for React component testing
- **Playwright** (E2E) - Has overtaken Cypress as the leading E2E framework
- **MSW (Mock Service Worker)** (API mocking) - Essential for realistic API testing

### **Alternative Stack**
- **Jest** + React Testing Library + Playwright + MSW (if you prefer Jest's ecosystem)

---

## **Why This Stack is Perfect for Your Use Case**

### **Vitest Advantages**
- ⚡ **2-10x faster** than Jest
- 🎯 **Native TypeScript support** without configuration
- 🔄 **Hot reload** in watch mode
- 🌐 **ESM first** (better for modern projects)
- 🎪 **Jest API compatibility** (easy migration path)

### **React Testing Library**
- 🎯 **User-centric testing** - tests how users interact with your app
- 🚫 **Prevents implementation detail testing** - focuses on behavior
- 💪 **Excellent for state management testing** - can test Zustand stores effectively

### **Playwright for E2E**
- 🌍 **Multi-browser testing** (Chromium, Firefox, Safari)
- 📱 **Mobile testing** built-in
- 🎥 **Video recording** and screenshots on failure
- ⚡ **Parallel execution** by default
- 🔧 **Better debugging** than Cypress

---

## **Testing Strategy for Your State Management**

Given your Zustand stores (`currentOrganizationId`, `currentCoachingRelationshipId`, `currentCoachingSessionId`), here's how to test them:

### **1. Unit Tests - Store Logic**
```typescript
// __tests__/stores/organization-state-store.test.ts
import { createOrganizationStateStore } from '@/lib/stores/organization-state-store'

describe('OrganizationStateStore', () => {
  it('should set and retrieve current organization ID', () => {
    const store = createOrganizationStateStore()
    
    store.getState().setCurrentOrganizationId('org-123')
    
    expect(store.getState().currentOrganizationId).toBe('org-123')
  })

  it('should reset organization state', () => {
    const store = createOrganizationStateStore()
    
    store.getState().setCurrentOrganizationId('org-123')
    store.getState().resetOrganizationState()
    
    expect(store.getState().currentOrganizationId).toBe('')
  })
})
```

### **2. Integration Tests - Hooks + Stores**
```typescript
// __tests__/hooks/use-current-organization.test.tsx
import { renderHook, act } from '@testing-library/react'
import { useCurrentOrganization } from '@/lib/hooks/use-current-organization'
import { TestProviders } from '@/test-utils/providers'

describe('useCurrentOrganization', () => {
  it('should sync organization ID from API data', async () => {
    const { result } = renderHook(() => useCurrentOrganization(), {
      wrapper: TestProviders
    })

    act(() => {
      result.current.setCurrentOrganizationId('org-456')
    })

    expect(result.current.currentOrganizationId).toBe('org-456')
  })
})
```

### **3. Component Tests - UI + State Integration**
```typescript
// __tests__/components/organization-switcher.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrganizationSwitcher } from '@/components/ui/organization-switcher'
import { TestProviders } from '@/test-utils/providers'

describe('OrganizationSwitcher', () => {
  it('should auto-select first organization when none selected', async () => {
    render(
      <TestProviders>
        <OrganizationSwitcher />
      </TestProviders>
    )

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })
  })

  it('should update state when organization is selected', async () => {
    render(
      <TestProviders>
        <OrganizationSwitcher />
      </TestProviders>
    )

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByText('Beta Inc'))

    await waitFor(() => {
      expect(screen.getByText('Beta Inc')).toBeInTheDocument()
    })
  })
})
```

### **4. E2E Tests - Complete User Flows**
```typescript
// e2e/state-management-flows.spec.ts
import { test, expect } from '@playwright/test'

test.describe('State Management Flows', () => {
  test('should maintain state through navigation', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Login
    await page.fill('[data-testid="email"]', 'test@example.com')
    await page.fill('[data-testid="password"]', 'password')
    await page.click('[data-testid="login-button"]')
    
    // Select organization
    await page.click('[data-testid="organization-switcher"]')
    await page.click('text=Acme Corp')
    
    // Verify organization persists
    expect(page.locator('[data-testid="current-org"]')).toContainText('Acme Corp')
    
    // Select coaching relationship
    await page.click('[data-testid="relationship-selector"]')
    await page.click('text=John Doe coaching')
    
    // Navigate to session
    await page.click('text=Session #1')
    
    // Verify all state is maintained
    expect(page.locator('[data-testid="current-org"]')).toContainText('Acme Corp')
    expect(page.locator('[data-testid="current-relationship"]')).toContainText('John Doe')
    expect(page.locator('[data-testid="session-title"]')).toContainText('Session #1')
  })

  test('should clear state on logout', async ({ page }) => {
    // ... setup state
    
    await page.click('[data-testid="logout-button"]')
    
    // Verify state is cleared
    await expect(page).toHaveURL('/login')
    // Add assertions for cleared sessionStorage
  })
})
```

---

## **Setup Configuration**

### **1. Install Dependencies**
```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event msw @playwright/test
```

### **2. Vitest Config (`vitest.config.ts`)**
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-utils/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### **3. Test Setup (`src/test-utils/setup.ts`)**
```typescript
import '@testing-library/jest-dom'
import { server } from './msw-server'

// Setup MSW
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### **4. Test Providers (`src/test-utils/providers.tsx`)**
```typescript
import { ReactNode } from 'react'
import { AuthStoreProvider } from '@/lib/providers/auth-store-provider'
import { OrganizationStateStoreProvider } from '@/lib/providers/organization-state-store-provider'

export function TestProviders({ children }: { children: ReactNode }) {
  return (
    <AuthStoreProvider>
      <OrganizationStateStoreProvider>
        {children}
      </OrganizationStateStoreProvider>
    </AuthStoreProvider>
  )
}
```

### **5. MSW Server Setup (`src/test-utils/msw-server.ts`)**
```typescript
import { setupServer } from 'msw/node'
import { handlers } from './msw-handlers'

export const server = setupServer(...handlers)
```

### **6. MSW Handlers (`src/test-utils/msw-handlers.ts`)**
```typescript
import { http, HttpResponse } from 'msw'

export const handlers = [
  // Mock organization API
  http.get('/api/organizations', () => {
    return HttpResponse.json([
      { id: 'org-1', name: 'Acme Corp', logo: '/logo1.png' },
      { id: 'org-2', name: 'Beta Inc', logo: '/logo2.png' },
    ])
  }),

  // Mock coaching sessions API
  http.get('/api/coaching_sessions/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      title: 'Session #1',
      coaching_relationship_id: 'rel-1',
      scheduled_date: '2025-07-04T10:00:00Z',
    })
  }),

  // Mock coaching relationships API
  http.get('/api/organizations/:orgId/coaching_relationships', () => {
    return HttpResponse.json([
      {
        id: 'rel-1',
        coach_name: 'John Doe',
        coachee_name: 'Jane Smith',
        organization_id: 'org-1',
      },
    ])
  }),
]
```

---

## **Package.json Scripts**

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:all": "npm run test && npm run test:e2e"
  }
}
```

---

## **Benefits for Your Specific Use Case**

### **Confidence in State Management**
- ✅ Test organization auto-selection logic
- ✅ Test coaching relationship syncing from session data
- ✅ Test logout state clearing (your recent bug!)
- ✅ Test persistence across page refreshes
- ✅ Test error states (403 forbidden scenarios)

### **Prevent Regressions**
- 🛡️ Auto-detect when state logic breaks
- 🛡️ Catch race conditions in logout flow
- 🛡️ Verify sessionStorage/localStorage behavior
- 🛡️ Test URL-driven state management

### **Developer Experience**
- ⚡ Fast feedback loop with Vitest
- 🎯 Test exactly what users experience
- 📊 Coverage reports for confidence
- 🔄 CI/CD integration ready

---

## **Getting Started**

1. **Install the dependencies** listed above
2. **Set up the configuration files** (vitest.config.ts, test setup, MSW)
3. **Start with unit tests** for your Zustand stores
4. **Add integration tests** for your custom hooks
5. **Create component tests** for critical UI components
6. **Implement E2E tests** for complete user flows

This testing strategy will give you the confidence to refactor state management logic knowing that any breaking changes will be caught immediately!

---

## **Implementation Status**

- [x] Install testing dependencies (Vitest, React Testing Library, Playwright, MSW)
- [x] Set up Vitest configuration with Next.js support
- [x] Create test utilities and providers
- [x] Write unit tests for all state stores (organization, coaching relationship, auth)
- [x] Add integration tests for useCurrentOrganization and useCurrentCoachingRelationship hooks
- [x] Create component test for OrganizationSwitcher
- [x] Configure Playwright for E2E testing
- [x] Implement E2E tests for state management flows
- [x] Update package.json scripts

## **Test Directory Structure**

```
refactor-platform-fe/
├── __tests__/                          # Unit and integration tests
│   ├── components/                     # Component tests
│   │   └── organization-switcher.test.tsx
│   ├── hooks/                         # Hook integration tests
│   │   ├── use-current-organization.test.tsx
│   │   └── use-current-coaching-relationship.test.tsx
│   └── stores/                        # Store unit tests
│       ├── auth-store.test.ts
│       ├── organization-state-store.test.ts
│       └── coaching-relationship-state-store.test.ts
├── e2e/                               # End-to-end tests
│   └── state-management-flows.spec.ts
├── src/test-utils/                    # Test utilities
│   ├── setup.ts                       # Global test setup
│   ├── providers.tsx                  # Test provider wrapper
│   ├── msw-handlers.ts                # API mock handlers
│   └── msw-server.ts                  # MSW server setup
├── vitest.config.ts                   # Vitest configuration
├── playwright.config.ts               # Playwright configuration
└── docs/testing/                      # Testing documentation
    └── frontend-testing-strategy.md

## **Available Test Scripts**

- `npm run test` - Run unit tests with Vitest
- `npm run test:ui` - Run tests with Vitest UI
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:e2e` - Run E2E tests with Playwright
- `npm run test:e2e:ui` - Run E2E tests with Playwright UI
- `npm run test:all` - Run all tests (unit + E2E)

## **Next Steps**

- [ ] Set up CI/CD pipeline to run tests automatically
- [ ] Add coverage thresholds and reporting
- [ ] Expand E2E tests for more complex user flows
- [ ] Add visual regression testing with Playwright
- [ ] Create performance benchmarking tests