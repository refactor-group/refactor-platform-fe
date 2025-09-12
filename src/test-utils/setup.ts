import '@testing-library/jest-dom'
import { vi, beforeAll, afterEach, afterAll } from 'vitest'
import { server } from './msw-server'

// Mock Next.js router hooks to avoid app router dependency in tests
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/'),
  useParams: vi.fn(() => ({})),
}))

// Mock SessionCleanupProvider to avoid router dependency in tests
vi.mock('@/lib/session/session-cleanup-provider', () => ({
  SessionCleanupProvider: ({ children }: { children: React.ReactNode }) => children
}))

// Mock SessionCleanupProvider from the new location as well
vi.mock('@/lib/providers/session-cleanup-provider', () => ({
  SessionCleanupProvider: ({ children }: { children: React.ReactNode }) => children
}))

// Setup MSW
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())