import { USER_WORKING_HOURS_FALLBACK, type WorkingHours } from "@/lib/scheduling";

export function useWorkingHours(): WorkingHours {
  return USER_WORKING_HOURS_FALLBACK;
}
