// The purpose of this provider is to provide compatibility with
// Next.js re-rendering and component caching
"use client";

import { type ReactNode, createContext, useRef, useContext } from "react";
import { type StoreApi, useStore } from "zustand";

import { type AuthStore, createAuthStore } from "@/lib/stores/auth-store";
import { useShallow } from "zustand/shallow";

export const AuthStoreContext = createContext<StoreApi<AuthStore> | null>(null);

export interface AuthStoreProviderProps {
  children: ReactNode;
}

export const AuthStoreProvider = ({ children }: AuthStoreProviderProps) => {
  const storeRef = useRef<StoreApi<AuthStore>>(undefined);
  const authStore = localStorage.getItem("auth-store");

  const persistedStoreOrNull = authStore ? JSON.parse(authStore).state : null;

  if (!storeRef.current) {
    storeRef.current = createAuthStore(persistedStoreOrNull);
  }

  return (
    <AuthStoreContext.Provider value={storeRef.current}>
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
