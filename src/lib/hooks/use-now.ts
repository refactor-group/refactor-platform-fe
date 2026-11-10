import { useState } from "react";
import { DateTime } from "ts-luxon";
import { useInterval } from "@/lib/hooks/use-interval";

/** The current time, refreshed every `intervalMs`. */
export function useNow(intervalMs: number): DateTime {
  const [now, setNow] = useState(() => DateTime.now());
  useInterval(() => setNow(DateTime.now()), intervalMs);
  return now;
}
