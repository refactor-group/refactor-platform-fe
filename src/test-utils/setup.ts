import '@testing-library/jest-dom'
import { vi, beforeAll, afterEach, afterAll } from 'vitest'
import { server } from './msw-server'
// @ts-ignore - eventsourcemock doesn't have types, but it's only used in tests
import EventSource from 'eventsourcemock'

// Polyfill EventSource for tests (jsdom doesn't have native EventSource)
Object.defineProperty(global, 'EventSource', {
  value: EventSource,
})

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
vi.mock('@/lib/auth/session-cleanup-provider', () => ({
  SessionCleanupProvider: ({ children }: { children: React.ReactNode }) => children
}))

// Mock SessionCleanupProvider from the new location as well
vi.mock('@/lib/providers/session-cleanup-provider', () => ({
  SessionCleanupProvider: ({ children }: { children: React.ReactNode }) => children
}))

// Mock SSEProvider to prevent actual SSE connections in tests
vi.mock('@/lib/providers/sse-provider', () => ({
  SSEProvider: ({ children }: { children: React.ReactNode }) => children
}))

// Setup MSW
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())