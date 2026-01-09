import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export enum SseConnectionState {
  Disconnected = "Disconnected",
  Connecting = "Connecting",
  Connected = "Connected",
  Reconnecting = "Reconnecting",
  Error = "Error",
}

interface SseError {
  message: string;
  timestamp: Date;
  attemptNumber: number;
}

interface SseConnectionStateData {
  state: SseConnectionState;
  lastError: SseError | null;
  lastConnectedAt: Date | null;
  lastEventAt: Date | null;
}

interface SseConnectionActions {
  setConnecting: () => void;
  setConnected: () => void;
  setReconnecting: () => void;
  setError: (error: string) => void;
  setDisconnected: () => void;
  recordEvent: () => void;
}

export type SseConnectionStore = SseConnectionStateData & SseConnectionActions;

const defaultState: SseConnectionStateData = {
  state: SseConnectionState.Disconnected,
  lastError: null,
  lastConnectedAt: null,
  lastEventAt: null,
};

export const createSseConnectionStore = () => {
  return create<SseConnectionStore>()(
    devtools(
      (set) => ({
        ...defaultState,

        setConnecting: () => {
          set({ state: SseConnectionState.Connecting });
        },

        setConnected: () => {
          set({
            state: SseConnectionState.Connected,
            lastConnectedAt: new Date(),
            lastError: null,
          });
        },

        setReconnecting: () => {
          set({ state: SseConnectionState.Reconnecting });
        },

        setError: (message: string) => {
          set({
            state: SseConnectionState.Error,
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
