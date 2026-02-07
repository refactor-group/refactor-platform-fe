"use client";

import { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { FC, ReactNode } from "react";

/** Data needed to render the compact session title in the site header */
export interface StickyTitleData {
  /** e.g. "Jim Hodapp / Mark Richardson" */
  names: string;
  /** e.g. "Feb 7, 2026 10:00 AM CST" */
  date: string;
}

interface StickyTitleContextValue {
  titleData: StickyTitleData | null;
  isVisible: boolean;
  setTitleData: (data: StickyTitleData | null) => void;
  setVisible: (visible: boolean) => void;
}

const StickyTitleContext = createContext<StickyTitleContextValue | null>(null);

interface StickyTitleProviderProps {
  children: ReactNode;
}

export const StickyTitleProvider: FC<StickyTitleProviderProps> = ({ children }) => {
  const [titleData, setTitleDataState] = useState<StickyTitleData | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const setTitleData = useCallback((data: StickyTitleData | null) => {
    setTitleDataState(data);
  }, []);

  const setVisible = useCallback((visible: boolean) => {
    setIsVisible(visible);
  }, []);

  const value = useMemo(
    () => ({ titleData, isVisible, setTitleData, setVisible }),
    [titleData, isVisible, setTitleData, setVisible]
  );

  return (
    <StickyTitleContext.Provider value={value}>
      {children}
    </StickyTitleContext.Provider>
  );
};

/**
 * Returns the sticky title context value, or null if outside a StickyTitleProvider.
 * This allows SiteHeader to safely render on non-coaching-session pages.
 */
export const useStickyTitle = (): StickyTitleContextValue | null => {
  return useContext(StickyTitleContext);
};
