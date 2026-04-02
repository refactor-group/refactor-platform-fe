"use client";
// The purpose of this provider is to provide compatibility with
// Next.js re-rendering and component caching

import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { type StoreApi, useStore } from "zustand";

import { type AuthStore, createAuthStore } from "@/lib/stores/auth-store";
import { useShallow } from "zustand/shallow";

export const AuthStoreContext = createContext<StoreApi<AuthStore> | null>(null);

export interface AuthStoreProviderProps {
  children: ReactNode;
}

export const AuthStoreProvider = ({ children }: AuthStoreProviderProps) => {
  // Create the store eagerly with default state (safe during SSR since it
  // doesn't access browser APIs). The zustand persist middleware will
  // automatically rehydrate from localStorage on the client.
  const [store] = useState(() => createAuthStore());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- gate to detect client mount; children depend on browser APIs unavailable during SSR
    setIsInitialized(true);
  }, []);

  // Gate rendering until the client has mounted. This delays the first paint
  // of child components (including the sidebar) so that client-only state
  // (sessionStorage, window size) is available when children mount,
  // preventing flash of incorrect layout.
  if (!isInitialized) {
    return null;
  }

  return (
    <AuthStoreContext.Provider value={store}>
      {children}
    </AuthStoreContext.Provider>
  );
};

export const useAuthStore = <T,>(selector: (store: AuthStore) => T): T => {
  const authStoreContext = useContext(AuthStoreContext);

  if (!authStoreContext) {
    throw new Error(`useAuthStore must be used within AuthStoreProvider`);
  }

  return useStore(authStoreContext, useShallow(selector));
};
