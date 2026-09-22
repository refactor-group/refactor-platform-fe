// Polyfill ResizeObserver for tests (jsdom doesn't have it, required by cmdk)
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

// Polyfill ProgressEvent (absent in this environment). MSW's XHR interceptor
// constructs one when it rejects a request, so without this the rejection
// below surfaces as an unhandled ReferenceError instead of a useful message.
if (typeof globalThis.ProgressEvent === 'undefined') {
  globalThis.ProgressEvent = class ProgressEvent extends Event {
    readonly lengthComputable: boolean
    readonly loaded: number
    readonly total: number
    constructor(type: string, init: ProgressEventInit = {}) {
      super(type, init)
      this.lengthComputable = init.lengthComputable ?? false
      this.loaded = init.loaded ?? 0
      this.total = init.total ?? 0
    }
  } as unknown as typeof globalThis.ProgressEvent
}

// Polyfill Element.scrollIntoView for tests (jsdom doesn't have it, required by cmdk)
if (typeof Element.prototype.scrollIntoView === 'undefined') {
  Element.prototype.scrollIntoView = function () {};
}

// Polyfill pointer-capture for tests (jsdom lacks it; Radix Select uses it).
if (typeof Element.prototype.hasPointerCapture === 'undefined') {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

import '@testing-library/jest-dom'
import { vi, beforeAll, afterEach, afterAll } from 'vitest'
import { server } from './msw-server'
// @ts-ignore - eventsourcemock doesn't have types, but it's only used in tests
import EventSource from 'eventsourcemock'

// Polyfill EventSource for tests (jsdom doesn't have native EventSource)
// Add standard EventSource constants that eventsourcemock doesn't include
EventSource.CONNECTING = 0
EventSource.OPEN = 1
EventSource.CLOSED = 2

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

// Providers mounts this hook, which reads the user via EntityApi; stub it so
// tests that render Providers over a partially mocked EntityApi still work.
// Its own suite re-imports the real implementation.
vi.mock('@/lib/hooks/use-sync-user-session', () => ({
  useSyncUserSession: () => {}
}))

// Setup MSW
// `error`, not the default `warn`: an unmatched request under `warn` is passed
// through to the real network, so unit tests silently hit whatever is running
// on localhost. Failing loudly keeps the suite hermetic.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())