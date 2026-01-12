import { describe, it, expect, beforeEach } from 'vitest'
import { createSSEConnectionStore, SSEConnectionState } from '@/lib/stores/sse-connection-store'

describe('SSEConnectionStore', () => {
  let store: ReturnType<typeof createSSEConnectionStore>

  beforeEach(() => {
    store = createSSEConnectionStore()
  })

  it('should initialize in Disconnected state', () => {
    const state = store.getState()
    expect(state.state).toBe(SSEConnectionState.Disconnected)
    expect(state.lastError).toBeNull()
    expect(state.lastConnectedAt).toBeNull()
    expect(state.lastEventAt).toBeNull()
  })

  it('should transition to Connecting state', () => {
    store.getState().setConnecting()

    const state = store.getState()
    expect(state.state).toBe(SSEConnectionState.Connecting)
  })

  it('should transition to Connected state and record connection time', () => {
    const beforeConnection = new Date()

    store.getState().setConnected()

    const state = store.getState()
    expect(state.state).toBe(SSEConnectionState.Connected)
    expect(state.lastConnectedAt).toBeInstanceOf(Date)
    expect(state.lastConnectedAt!.getTime()).toBeGreaterThanOrEqual(beforeConnection.getTime())
    expect(state.lastError).toBeNull() // Should clear error on connection
  })

  it('should transition to Reconnecting state', () => {
    store.getState().setReconnecting()

    const state = store.getState()
    expect(state.state).toBe(SSEConnectionState.Reconnecting)
  })

  it('should record error with timestamp', () => {
    const errorMessage = 'Connection failed'
    const beforeError = new Date()

    store.getState().setError(errorMessage)

    const state = store.getState()
    expect(state.state).toBe(SSEConnectionState.Error)
    expect(state.lastError).toMatchObject({
      message: errorMessage,
      timestamp: expect.any(Date),
      attemptNumber: 0,
    })
    expect(state.lastError!.timestamp.getTime()).toBeGreaterThanOrEqual(beforeError.getTime())
  })

  it('should reset to default state on disconnect', () => {
    // First, put store in a non-default state
    store.getState().setConnected()
    store.getState().setError('Test error')
    store.getState().recordEvent()

    // Verify we're not in default state
    expect(store.getState().state).not.toBe(SSEConnectionState.Disconnected)
    expect(store.getState().lastError).not.toBeNull()

    // Disconnect
    store.getState().setDisconnected()

    // Should match initial state
    const state = store.getState()
    expect(state.state).toBe(SSEConnectionState.Disconnected)
    expect(state.lastError).toBeNull()
    expect(state.lastConnectedAt).toBeNull()
    expect(state.lastEventAt).toBeNull()
  })

  it('should record event timestamp', () => {
    const beforeEvent = new Date()

    store.getState().recordEvent()

    const state = store.getState()
    expect(state.lastEventAt).toBeInstanceOf(Date)
    expect(state.lastEventAt!.getTime()).toBeGreaterThanOrEqual(beforeEvent.getTime())
  })

  it('should handle complete connection lifecycle: Connecting → Connected → Reconnecting → Connected', () => {
    // Initial connection attempt
    store.getState().setConnecting()
    expect(store.getState().state).toBe(SSEConnectionState.Connecting)

    // Connection established
    store.getState().setConnected()
    expect(store.getState().state).toBe(SSEConnectionState.Connected)
    const firstConnectionTime = store.getState().lastConnectedAt
    expect(firstConnectionTime).toBeInstanceOf(Date)

    // Network hiccup - reconnecting
    store.getState().setReconnecting()
    expect(store.getState().state).toBe(SSEConnectionState.Reconnecting)

    // Reconnection successful
    store.getState().setConnected()
    expect(store.getState().state).toBe(SSEConnectionState.Connected)
    const secondConnectionTime = store.getState().lastConnectedAt
    expect(secondConnectionTime).toBeInstanceOf(Date)
    expect(secondConnectionTime!.getTime()).toBeGreaterThanOrEqual(firstConnectionTime!.getTime())
  })

  it('should handle error recovery: Error → Connecting → Connected', () => {
    // Error occurs
    store.getState().setError('Network error')
    expect(store.getState().state).toBe(SSEConnectionState.Error)
    expect(store.getState().lastError).not.toBeNull()

    // Retry connection
    store.getState().setConnecting()
    expect(store.getState().state).toBe(SSEConnectionState.Connecting)
    expect(store.getState().lastError).not.toBeNull() // Error still recorded

    // Connection successful - error should be cleared
    store.getState().setConnected()
    expect(store.getState().state).toBe(SSEConnectionState.Connected)
    expect(store.getState().lastError).toBeNull()
  })

  it('should preserve event timestamps across state changes', () => {
    // Record an event
    store.getState().recordEvent()
    const eventTime = store.getState().lastEventAt
    expect(eventTime).toBeInstanceOf(Date)

    // State changes shouldn't clear event time
    store.getState().setConnecting()
    expect(store.getState().lastEventAt).toBe(eventTime)

    store.getState().setConnected()
    expect(store.getState().lastEventAt).toBe(eventTime)

    store.getState().setReconnecting()
    expect(store.getState().lastEventAt).toBe(eventTime)

    // Only disconnect should clear it
    store.getState().setDisconnected()
    expect(store.getState().lastEventAt).toBeNull()
  })
})
