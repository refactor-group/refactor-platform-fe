import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { GoogleIntegrationSection } from "@/components/ui/settings/google-integration-section";

// Polyfill DOM methods missing in jsdom (needed by Radix Select)
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});
import { GoogleOAuthConnectionStatus } from "@/types/oauth-connection";
import {
  createMockRelationship,
  createMockGoogleOAuthConnectionState,
} from "../test-utils";

// Mock toast
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock auth store
const mockAuthStore = vi.fn();
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector(mockAuthStore()),
}));

// Mock OAuth hook
vi.mock("@/lib/api/oauth-connection", () => ({
  useGoogleOAuthConnectionStatus: () => ({
    connectionStatus: createMockGoogleOAuthConnectionState(),
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  }),
  GoogleOAuthApi: {
    getAuthorizeUrl: () => "http://localhost:4000/api/oauth/google/authorize",
    disconnect: vi.fn(),
  },
}));

// Mock coaching relationships
const mockUpdateRelationship = vi.fn().mockResolvedValue({});
const mockRefreshRelationships = vi.fn();
let mockRelationships: ReturnType<typeof createMockRelationship>[] = [];

vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: () => ({
    relationships: mockRelationships,
    isLoading: false,
    isError: undefined,
    refresh: mockRefreshRelationships,
  }),
  CoachingRelationshipApi: {
    updateRelationship: (...args: unknown[]) => mockUpdateRelationship(...args),
  },
}));

vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({
    currentOrganizationId: "org-1",
  }),
}));

// Mock meetings API
const mockCreateGoogleMeet = vi.fn().mockResolvedValue({
  meeting_id: "meet-123",
  join_url: "https://meet.google.com/xyz-abcd-efg",
  host_url: "https://meet.google.com/xyz-abcd-efg",
});

vi.mock("@/lib/api/meetings", () => ({
  MeetingApi: {
    createGoogleMeet: (...args: unknown[]) => mockCreateGoogleMeet(...args),
  },
}));

describe("Meet URL Management Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore.mockReturnValue({ isACoach: true, userId: "user-1" });
    mockRelationships = [
      createMockRelationship({
        id: "rel-1",
        coach_id: "user-1",
        coachee_first_name: "Jane",
        coachee_last_name: "Smith",
      }),
    ];
  });

  /** Select a coachee from the relationship dropdown */
  async function selectCoachee(name: string) {
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name }));
  }

  describe("Paste flow", () => {
    it("saves valid Meet URL on blur", async () => {
      render(<GoogleIntegrationSection />);
      await selectCoachee("Jane Smith");

      const input = screen.getByPlaceholderText("Paste Google Meet URL");
      const validUrl = "https://meet.google.com/abc-defg-hij";
      await userEvent.type(input, validUrl);
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockUpdateRelationship).toHaveBeenCalledWith(
          "org-1",
          "rel-1",
          { meet_url: validUrl }
        );
      });
    });

    it("shows validation error for invalid URL", async () => {
      render(<GoogleIntegrationSection />);
      await selectCoachee("Jane Smith");

      const input = screen.getByPlaceholderText("Paste Google Meet URL");
      await userEvent.type(input, "https://zoom.us/j/123456");
      fireEvent.blur(input);

      await waitFor(() => {
        expect(
          screen.getByText(/Please enter a valid Google Meet URL/)
        ).toBeInTheDocument();
      });

      expect(mockUpdateRelationship).not.toHaveBeenCalled();
    });
  });

  describe("Create flow", () => {
    it("creates Meet and saves URL to relationship", async () => {
      render(<GoogleIntegrationSection />);
      await selectCoachee("Jane Smith");

      await userEvent.click(
        screen.getByRole("button", { name: "Create Meet" })
      );

      await waitFor(() => {
        expect(mockCreateGoogleMeet).toHaveBeenCalledWith("org-1", "rel-1");
      });

      await waitFor(() => {
        expect(mockUpdateRelationship).toHaveBeenCalledWith(
          "org-1",
          "rel-1",
          { meet_url: "https://meet.google.com/xyz-abcd-efg" }
        );
      });

      expect(mockRefreshRelationships).toHaveBeenCalled();
    });
  });
});
