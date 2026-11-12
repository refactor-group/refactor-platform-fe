import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionAction, SessionRemoval } from "@/lib/session-actions";
import { useSessionActions, type UseSessionActionsInput } from "@/components/ui/dashboard/use-session-actions";
import { EntityApiError } from "@/types/entity-api-error";
import { createMockEnrichedSession } from "../../../test-utils";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (select: (s: unknown) => unknown) => select({ userSession: { id: "coach-1" } }),
}));
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-1" }),
}));
vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: () => ({ relationships: [] }),
}));
const deleteSession = vi.fn();
vi.mock("@/lib/api/coaching-sessions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/coaching-sessions")>()),
  useCoachingSessionMutation: () => ({ delete: deleteSession }),
}));
vi.mock("@/components/ui/dashboard/use-resend-invite", () => ({
  useResendInvite: () => ({ requestResend: vi.fn(), dialogProps: {} }),
}));
vi.mock("@/components/ui/dashboard/use-edit-series", () => ({ useEditSeries: () => vi.fn() }));
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: Object.assign(vi.fn(), {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  }),
}));

// Tuesday, August 18 2026; the session is two days ahead, so removing it cancels it.
const NOW = new Date("2026-08-18T18:00:00Z");
const UPCOMING = createMockEnrichedSession({ id: "s-upcoming", date: "2026-08-20T15:00:00" });

const PAST = createMockEnrichedSession({ id: "s-past", date: "2026-08-10T15:00:00" });

function hasContentError(): EntityApiError {
  const axiosLike = Object.assign(new Error("Request failed"), {
    isAxiosError: true,
    response: {
      status: 409,
      statusText: "Conflict",
      data: { details: { reason: "sessions_have_content", coaching_session_id: "s-upcoming" } },
    },
  });
  return new EntityApiError("DELETE", "/coaching_sessions/s-upcoming", axiosLike);
}

function renderActions(session = UPCOMING) {
  const onSessionsChanged = vi.fn();
  const input: UseSessionActionsInput = {
    userTimezone: "America/Chicago",
    onReschedule: vi.fn(),
    onSessionsChanged,
  };
  const hook = renderHook(() => useSessionActions(input));
  act(() => hook.result.current.run(SessionAction.DeleteSession, session));
  return { hook, onSessionsChanged };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useSessionActions cancelling a session", () => {
  it("asks first, as a cancellation of an upcoming session", () => {
    const { hook } = renderActions();
    const dialog = hook.result.current.dialogs.deleteSession;
    expect(dialog.session?.id).toBe("s-upcoming");
    expect(dialog.removal).toBe(SessionRemoval.Cancel);
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it("deletes on confirm, refreshes the session lists, closes the dialog and says so", async () => {
    deleteSession.mockResolvedValueOnce(undefined);
    const { hook, onSessionsChanged } = renderActions();
    await act(() => hook.result.current.dialogs.deleteSession.onConfirm());
    expect(deleteSession).toHaveBeenCalledWith("s-upcoming");
    expect(onSessionsChanged).toHaveBeenCalledTimes(1);
    expect(hook.result.current.dialogs.deleteSession.session).toBeUndefined();
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("reports a failed delete, closes the dialog and leaves the lists alone", async () => {
    deleteSession.mockRejectedValueOnce(new Error("network down"));
    const { hook, onSessionsChanged } = renderActions();
    await act(() => hook.result.current.dialogs.deleteSession.onConfirm());
    expect(toastError).toHaveBeenCalledWith("Couldn't cancel the session · Try again");
    expect(onSessionsChanged).not.toHaveBeenCalled();
    expect(hook.result.current.dialogs.deleteSession.session).toBeUndefined();
  });

  it("says why when the session has notes, actions or agreements", async () => {
    deleteSession.mockRejectedValueOnce(hasContentError());
    const { hook, onSessionsChanged } = renderActions();
    await act(() => hook.result.current.dialogs.deleteSession.onConfirm());
    expect(toastError).toHaveBeenCalledWith("Couldn't cancel the session · It has notes, actions or agreements");
    expect(onSessionsChanged).not.toHaveBeenCalled();
  });

  it("names a past session's refusal as a removal", async () => {
    deleteSession.mockRejectedValueOnce(hasContentError());
    const { hook } = renderActions(PAST);
    await act(() => hook.result.current.dialogs.deleteSession.onConfirm());
    expect(toastError).toHaveBeenCalledWith("Couldn't remove the session · It has notes, actions or agreements");
  });

  it("deletes nothing when the dialog is dismissed", () => {
    const { hook } = renderActions();
    act(() => hook.result.current.dialogs.deleteSession.onCancel());
    expect(hook.result.current.dialogs.deleteSession.session).toBeUndefined();
    expect(deleteSession).not.toHaveBeenCalled();
  });
});
