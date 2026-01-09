import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export enum SSEConnectionState {
  Disconnected = "Disconnected",
  Connecting = "Connecting",
  Connected = "Connected",
  Reconnecting = "Reconnecting",
  Error = "Error",
}

interface SSEError {
  message: string;
  timestamp: Date;
  attemptNumber: number;
}

interface SSEConnectionStateData {
  state: SSEConnectionState;
  lastError: SSEError | null;
  lastConnectedAt: Date | null;
  lastEventAt: Date | null;
}

interface SSEConnectionActions {
  setConnecting: () => void;
  setConnected: () => void;
  setReconnecting: () => void;
  setError: (error: string) => void;
  setDisconnected: () => void;
  recordEvent: () => void;
}

export type SSEConnectionStore = SSEConnectionStateData & SSEConnectionActions;

const defaultState: SSEConnectionStateData = {
  state: SSEConnectionState.Disconnected,
  lastError: null,
  lastConnectedAt: null,
  lastEventAt: null,
};

export const createSSEConnectionStore = () => {
  return create<SSEConnectionStore>()(
    devtools(
      (set) => ({
        ...defaultState,

        setConnecting: () => {
          set({ state: SSEConnectionState.Connecting });
        },

        setConnected: () => {
          set({
            state: SSEConnectionState.Connected,
            lastConnectedAt: new Date(),
            lastError: null,
          });
        },

        setReconnecting: () => {
          set({ state: SSEConnectionState.Reconnecting });
        },

        setError: (message: string) => {
          set({
            state: SSEConnectionState.Error,
            lastError: {
              message,
              timestamp: new Date(),
              attemptNumber: 0,
            },
          });
        },

        setDisconnected: () => {
          set(defaultState);
        },

        recordEvent: () => {
          set({ lastEventAt: new Date() });
        },
      }),
      { name: 'sse-connection-store' }
    )
  );
};
