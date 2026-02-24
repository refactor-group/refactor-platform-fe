/**
 * Tests verifying that SWR wrapper hooks do NOT fetch when given falsy IDs.
 *
 * When an ID is absent (null, undefined, or ""), the hook must pass a null
 * URL/key to SWR so that no network request is made. Each hook is tested
 * with its actual implementation — only EntityApi is mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { TestProviders } from "@/test-utils/providers";
import { DateTime } from "ts-luxon";

// Mock EntityApi — the single dependency all SWR hooks share
vi.mock("@/lib/api/entity-api", () => ({
  EntityApi: {
    useEntity: vi.fn().mockReturnValue({
      entity: undefined,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    }),
    useEntityList: vi.fn().mockReturnValue({
      entities: [],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    }),
    listFn: vi.fn(),
    getFn: vi.fn(),
    createFn: vi.fn(),
    updateFn: vi.fn(),
    deleteFn: vi.fn(),
    listNestedFn: vi.fn(),
  },
}));

vi.mock("@/site.config", () => ({
  siteConfig: {
    env: {
      backendServiceURL: "http://localhost:4000",
    },
  },
}));

import { EntityApi } from "@/lib/api/entity-api";
import { useCoachingSession, useCoachingSessionList } from "@/lib/api/coaching-sessions";
import { useOrganization } from "@/lib/api/organizations";
import {
  useCoachingRelationship,
  useCoachingRelationshipList,
} from "@/lib/api/coaching-relationships";
import { useOverarchingGoalBySession } from "@/lib/api/overarching-goals";

describe("SWR hooks — null/falsy ID path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useCoachingSession", () => {
    it("passes null URL to useEntity when id is empty string", () => {
      renderHook(() => useCoachingSession(""), {
        wrapper: TestProviders,
      });

      expect(EntityApi.useEntity).toHaveBeenCalledWith(
        null, // URL must be null to skip fetch
        expect.any(Function),
        expect.anything() // defaultValue
      );
    });

    it("passes a real URL to useEntity when id is present", () => {
      renderHook(() => useCoachingSession("session-123"), {
        wrapper: TestProviders,
      });

      expect(EntityApi.useEntity).toHaveBeenCalledWith(
        expect.stringContaining("/coaching_sessions/session-123"),
        expect.any(Function),
        expect.anything()
      );
    });
  });

  describe("useOrganization", () => {
    it("passes null URL to useEntity when id is empty string", () => {
      renderHook(() => useOrganization(""), {
        wrapper: TestProviders,
      });

      expect(EntityApi.useEntity).toHaveBeenCalledWith(
        null,
        expect.any(Function),
        expect.anything()
      );
    });

    it("passes a real URL to useEntity when id is present", () => {
      renderHook(() => useOrganization("org-456"), {
        wrapper: TestProviders,
      });

      expect(EntityApi.useEntity).toHaveBeenCalledWith(
        expect.stringContaining("/organizations/org-456"),
        expect.any(Function),
        expect.anything()
      );
    });
  });

  describe("useCoachingRelationship", () => {
    it("passes null URL to useEntity when both IDs are empty", () => {
      renderHook(() => useCoachingRelationship("", ""), {
        wrapper: TestProviders,
      });

      expect(EntityApi.useEntity).toHaveBeenCalledWith(
        null,
        expect.any(Function),
        expect.anything()
      );
    });

    it("passes null URL to useEntity when organizationId is empty", () => {
      renderHook(() => useCoachingRelationship("", "rel-123"), {
        wrapper: TestProviders,
      });

      expect(EntityApi.useEntity).toHaveBeenCalledWith(
        null,
        expect.any(Function),
        expect.anything()
      );
    });

    it("passes null URL to useEntity when relationshipId is empty", () => {
      renderHook(() => useCoachingRelationship("org-456", ""), {
        wrapper: TestProviders,
      });

      expect(EntityApi.useEntity).toHaveBeenCalledWith(
        null,
        expect.any(Function),
        expect.anything()
      );
    });

    it("passes a real URL to useEntity when both IDs are present", () => {
      renderHook(() => useCoachingRelationship("org-456", "rel-123"), {
        wrapper: TestProviders,
      });

      expect(EntityApi.useEntity).toHaveBeenCalledWith(
        expect.stringContaining("/organizations/org-456/coaching_relationships/rel-123"),
        expect.any(Function),
        expect.anything()
      );
    });
  });

  describe("useCoachingRelationshipList", () => {
    it("passes null conditional key when organizationId is null", () => {
      renderHook(() => useCoachingRelationshipList(null), {
        wrapper: TestProviders,
      });

      // Third arg (params/conditional) is null → useEntityList sets SWR key = null
      expect(EntityApi.useEntityList).toHaveBeenCalledWith(
        expect.any(String), // URL template (always constructed even with null)
        expect.any(Function),
        null
      );
    });

    it("passes organizationId as conditional key when present", () => {
      renderHook(() => useCoachingRelationshipList("org-456"), {
        wrapper: TestProviders,
      });

      expect(EntityApi.useEntityList).toHaveBeenCalledWith(
        expect.stringContaining("/organizations/org-456/coaching_relationships"),
        expect.any(Function),
        "org-456"
      );
    });
  });

  describe("useCoachingSessionList", () => {
    const from = DateTime.fromISO("2025-01-01");
    const to = DateTime.fromISO("2025-12-31");

    it("passes undefined conditional key when relationshipId is null", () => {
      renderHook(() => useCoachingSessionList(null, from, to), {
        wrapper: TestProviders,
      });

      // When relationshipId is null, params = undefined → SWR key = null
      expect(EntityApi.useEntityList).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        undefined
      );
    });

    it("passes params object when relationshipId is present", () => {
      renderHook(() => useCoachingSessionList("rel-123", from, to), {
        wrapper: TestProviders,
      });

      expect(EntityApi.useEntityList).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({
          coaching_relationship_id: "rel-123",
        })
      );
    });
  });

  describe("useOverarchingGoalBySession", () => {
    it("passes empty string as conditional key (falsy → null SWR key)", () => {
      renderHook(() => useOverarchingGoalBySession(""), {
        wrapper: TestProviders,
      });

      // useOverarchingGoalBySession → useOverarchingGoalList → useEntityList
      // Third arg is coachingSessionId="" (falsy) → useEntityList sets key = null
      expect(EntityApi.useEntityList).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        ""
      );
    });

    it("passes session ID as conditional key when present", () => {
      renderHook(() => useOverarchingGoalBySession("session-789"), {
        wrapper: TestProviders,
      });

      expect(EntityApi.useEntityList).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        "session-789"
      );
    });
  });
});
