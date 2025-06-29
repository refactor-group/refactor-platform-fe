import { toast } from "sonner";

export async function copyCoachingSessionLink(sessionId: string): Promise<void> {
  const url = `${window.location.origin}/coaching-sessions/${sessionId}`;
  try {
    await navigator.clipboard.writeText(url);
    toast("Coaching session link copied successfully.");
  } catch (error) {
    console.error("Failed to copy link:", error);
  }
}