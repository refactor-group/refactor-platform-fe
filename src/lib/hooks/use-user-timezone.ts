import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { getBrowserTimezone } from "@/lib/timezone-utils";

/** The profile's time zone, else the browser's. */
export function useUserTimezone(): string {
  const timezone = useAuthStore((state) => state.userSession?.timezone);
  return timezone || getBrowserTimezone();
}
