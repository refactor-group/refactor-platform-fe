"use client";
// The purpose of this provider is to provide compatibility with
// Next.js re-rendering and component caching

import {
  type ReactNode,
  createContext,
  useRef,
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
  const storeRef = useRef<StoreApi<AuthStore> | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Now safe to access localStorage
      const storedValue = localStorage.getItem("auth-store");
      const initialState = storedValue ? JSON.parse(storedValue).state : null;
      storeRef.current = createAuthStore(initialState);
      setIsInitialized(true);
    }
  }, []);

  // Ensure store is initialized before rendering the provider
  if (!isInitialized) {
    return null; // or return a loading component
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
