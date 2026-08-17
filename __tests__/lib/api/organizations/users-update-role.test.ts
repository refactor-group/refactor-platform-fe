import { createElement, type ReactNode } from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { SWRConfig } from "swr";
import { server } from "@/test-utils/msw-server";
import { useUserList, useUserMutation } from "@/lib/api/organizations/users";
import { Role, type User } from "@/types/user";
import { createMockUser, createMockUserRole } from "../../../test-utils";

vi.mock("@/site.config", () => ({
  siteConfig: {
    env: {
      backendServiceURL: "http://localhost:4000",
      backendApiVersion: "1.0.0-test",
    },
  },
}));

const authState = {
  userSession: {
    id: "me",
    roles: [
      createMockUserRole({ id: "me-org-1", user_id: "me", organization_id: "org-1" }),
      createMockUserRole({ id: "me-org-2", user_id: "me", organization_id: "org-2" }),
    ],
  },
};
const mockAuthStore = vi.fn();
vi.mock("@/lib/providers/auth-store-provider", () => ({
  AuthStoreProvider: ({ children }: { children: ReactNode }) => children,
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector(mockAuthStore()),
}));

const ORG_ID = "org-1";
const USER_ID = "user-1";

function adaWithRoles(orgOneRole: Role, includeOrgTwo: boolean): User {
  return createMockUser({
    id: USER_ID,
    first_name: "Ada",
    last_name: "Lovelace",
    roles: [
      createMockUserRole({
        id: "role-org-1",
        user_id: USER_ID,
        organization_id: "org-1",
        role: orgOneRole,
      }),
      ...(includeOrgTwo
        ? [
            createMockUserRole({
              id: "role-org-2",
              user_id: USER_ID,
              organization_id: "org-2",
              role: Role.Admin,
            }),
          ]
        : []),
    ],
  });
}

/**
 * The PUT answers with the shape the real backend sends: the full user with
 * `roles` filtered to the path organization, which is what makes writing the
 * response into the cache destructive.
 */
function stubEndpoints() {
  const getCalls: number[] = [];
  const putBodies: unknown[] = [];

  server.use(
    // The delay keeps a refetch in flight while the assertions run, so a cache
    // write of the PUT response can't be masked by a fast revalidation.
    http.get(`*/organizations/${ORG_ID}/users`, async () => {
      getCalls.push(Date.now());
      await delay(20);
      const role = putBodies.length > 0 ? Role.Admin : Role.User;
      return HttpResponse.json({
        status_code: 200,
        data: [adaWithRoles(role, true)],
      });
    }),
    http.put(
      "*/organizations/:organizationId/users/:userId/role",
      async ({ request }) => {
        putBodies.push(await request.json());
        return HttpResponse.json({
          status_code: 200,
          data: adaWithRoles(Role.Admin, false),
        });
      }
    )
  );

  return { getCalls, putBodies };
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    SWRConfig,
    { value: { provider: () => new Map(), dedupingInterval: 0 } },
    children
  );
}

function renderHarness() {
  return renderHook(
    () => ({
      list: useUserList(ORG_ID),
      mutation: useUserMutation(ORG_ID),
    }),
    { wrapper }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthStore.mockReturnValue(authState);
});

describe("useUserMutation().updateRole", () => {
  it("leaves other organizations' roles intact in the cached user", async () => {
    const { getCalls, putBodies } = stubEndpoints();
    const { result } = renderHarness();

    await waitFor(() => expect(result.current.list.users).toHaveLength(1));
    const getsBeforePut = getCalls.length;

    await act(async () => {
      await result.current.mutation.updateRole(ORG_ID, USER_ID, Role.Admin);
    });

    // Checked before revalidation lands as well as after: a cache write of the
    // org-filtered response is only visible in this window.
    expect(
      result.current.list.users[0].roles.some(
        (r) => r.organization_id === "org-2"
      )
    ).toBe(true);

    await waitFor(() => expect(getCalls.length).toBeGreaterThan(getsBeforePut));
    await waitFor(() =>
      expect(
        result.current.list.users[0].roles.find(
          (r) => r.organization_id === "org-1"
        )?.role
      ).toBe(Role.Admin)
    );

    const cached = result.current.list.users[0];
    expect(
      cached.roles.some((r) => r.organization_id === "org-2")
    ).toBe(true);
    expect(cached.roles).toHaveLength(2);
    expect(putBodies).toEqual([{ role: "Admin" }]);
  });

  it("does not touch the signed-in user's session roles", async () => {
    stubEndpoints();
    const before = structuredClone(authState.userSession.roles);
    const { result } = renderHarness();

    await waitFor(() => expect(result.current.list.users).toHaveLength(1));

    await act(async () => {
      await result.current.mutation.updateRole(ORG_ID, USER_ID, Role.Admin);
    });

    expect(authState.userSession.roles).toEqual(before);
  });
});
