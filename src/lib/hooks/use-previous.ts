import { useEffect, useRef } from "react";

/**
 * Returns the value from the previous render. Returns `undefined` on the
 * first render — guard against that when using this for edge detection so
 * a value present on initial mount isn't treated as a fresh transition.
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}
