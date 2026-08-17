import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { SWRConfig } from "swr";
import { server } from "@/test-utils/msw-server";
import { useSyncUserSession } from "@/lib/hooks/use-sync-user-session";
import { Role, type User, type UserRole } from "@/types/user";
import { createMockUser, createMockUserRole } from "../test-utils";

// Opt out of the global stub in src/test-utils/setup.ts — this suite tests the
// real hook.
vi.mock("@/lib/hooks/use-sync-user-session", async (importOriginal) =>
  importOriginal<typeof import("@/lib/hooks/use-sync-user-session")>()
);

vi.mock("@/site.config", () => ({
  siteConfig: {
    env: {
      backendServiceURL: "http://localhost:4000",
      backendApiVersion: "1.0.0-test",
    },
  },
}));

const mockAuthStore = vi.fn();
vi.mock("@/lib/providers/auth-store-provider", () => ({
  AuthStoreProvider: ({ children }: { children: ReactNode }) => children,
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector(mockAuthStore()),
}));

const syncUserSession = vi.fn();

const roleIn = (organizationId: string, role: Role): UserRole =>
  createMockUserRole({
    id: `role-${organizationId}`,
    user_id: "user-1",
    organization_id: organizationId,
    role,
  });

function setStore(state: {
  isLoggedIn: boolean;
  userId: string;
  roles: UserRole[];
}) {
  mockAuthStore.mockReturnValue({
    isLoggedIn: state.isLoggedIn,
    userId: state.userId,
    userSession: createMockUser({ id: state.userId, roles: state.roles }),
    syncUserSession,
  });
}

/** Records every GET /users/:id so "no fetch" is assertable, not assumed. */
function serveUser(user: User) {
  const calls: string[] = [];
  server.use(
    http.get("*/users/:id", ({ request }) => {
      calls.push(request.url);
      return HttpResponse.json({ status_code: 200, data: user });
    })
  );
  return calls;
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("useSyncUserSession", () => {
  it("syncs when the fetched roles differ from the stored roles", async () => {
    setStore({
      isLoggedIn: true,
      userId: "user-1",
      roles: [roleIn("org-1", Role.Admin)],
    });
    const fetched = createMockUser({
      id: "user-1",
      roles: [roleIn("org-1", Role.User)],
    });
    serveUser(fetched);

    renderHook(() => useSyncUserSession(), { wrapper });

    await waitFor(() => expect(syncUserSession).toHaveBeenCalledTimes(1));
    expect(syncUserSession).toHaveBeenCalledWith("user-1", fetched);
  });

  it("does not sync when the roles are unchanged, even in a different order", async () => {
    const stored = [roleIn("org-1", Role.Admin), roleIn("org-2", Role.User)];
    setStore({ isLoggedIn: true, userId: "user-1", roles: stored });
    const calls = serveUser(
      createMockUser({ id: "user-1", roles: [stored[1], stored[0]] })
    );

    renderHook(() => useSyncUserSession(), { wrapper });

    await waitFor(() => expect(calls).toHaveLength(1));
    await waitFor(() => expect(syncUserSession).not.toHaveBeenCalled());
  });

  it("never syncs the placeholder user returned before the fetch resolves", async () => {
    setStore({
      isLoggedIn: true,
      userId: "user-1",
      roles: [roleIn("org-1", Role.Admin)],
    });
    // A payload for somebody else stands in for "not this user's data yet".
    const calls = serveUser(createMockUser({ id: "someone-else", roles: [] }));

    renderHook(() => useSyncUserSession(), { wrapper });

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(syncUserSession).not.toHaveBeenCalled();
  });

  it("syncs every organization's role, not just the changed one", async () => {
    setStore({
      isLoggedIn: true,
      userId: "user-1",
      roles: [
        roleIn("org-1", Role.Admin),
        roleIn("org-2", Role.User),
        roleIn("org-3", Role.Admin),
      ],
    });
    serveUser(
      createMockUser({
        id: "user-1",
        roles: [
          roleIn("org-1", Role.User),
          roleIn("org-2", Role.User),
          roleIn("org-3", Role.Admin),
        ],
      })
    );

    renderHook(() => useSyncUserSession(), { wrapper });

    await waitFor(() => expect(syncUserSession).toHaveBeenCalledTimes(1));
    const synced = syncUserSession.mock.calls[0][1] as User;
    expect(synced.roles).toHaveLength(3);
    expect(synced.roles.map((r) => r.organization_id).sort()).toEqual([
      "org-1",
      "org-2",
      "org-3",
    ]);
  });

  it("is inert when logged out", async () => {
    setStore({ isLoggedIn: false, userId: "user-1", roles: [] });
    const calls = serveUser(
      createMockUser({ id: "user-1", roles: [roleIn("org-1", Role.Admin)] })
    );

    renderHook(() => useSyncUserSession(), { wrapper });

    await waitFor(() => expect(syncUserSession).not.toHaveBeenCalled());
    expect(calls).toEqual([]);
  });
});
