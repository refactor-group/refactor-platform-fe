import '@testing-library/jest-dom'
import { vi } from 'vitest'
import { server } from './msw-server'

// Mock SessionCleanupProvider to avoid router dependency in tests
vi.mock('@/lib/session/session-cleanup-provider', () => ({
  SessionCleanupProvider: ({ children }: { children: React.ReactNode }) => children
}))

// Setup MSW
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())