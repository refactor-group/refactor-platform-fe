import '@testing-library/jest-dom'
import { server } from './msw-server'

// Setup MSW
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())