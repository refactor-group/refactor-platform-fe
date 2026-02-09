import { render, screen } from "@testing-library/react";
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
} from "../../../__tests__/test-utils";

// Mock the hooks
const mockAuthStore = vi.fn();
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector(mockAuthStore()),
}));

const mockRefreshOAuth = vi.fn();
vi.mock("@/lib/api/oauth-connection", () => ({
  useGoogleOAuthConnectionStatus: () => ({
    connectionStatus: mockConnectionStatus,
    isLoading: false,
    isError: undefined,
    refresh: mockRefreshOAuth,
  }),
  GoogleOAuthApi: {
    getAuthorizeUrl: () => "http://localhost:4000/api/oauth/google/authorize",
    disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

let mockConnectionStatus: ReturnType<typeof createMockGoogleOAuthConnectionState> | { status: string } = {
  status: GoogleOAuthConnectionStatus.Disconnected,
};

const mockRefreshRelationships = vi.fn();
vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: () => ({
    relationships: mockRelationships,
    isLoading: false,
    isError: undefined,
    refresh: mockRefreshRelationships,
  }),
  CoachingRelationshipApi: {
    updateRelationship: vi.fn().mockResolvedValue({}),
  },
}));

let mockRelationships: ReturnType<typeof createMockRelationship>[] = [];

vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({
    currentOrganizationId: "org-1",
  }),
}));

vi.mock("@/lib/api/meetings", () => ({
  MeetingApi: {
    createGoogleMeet: vi.fn().mockResolvedValue({
      meeting_id: "meet-123",
      join_url: "https://meet.google.com/abc-defg-hij",
      host_url: "https://meet.google.com/abc-defg-hij",
    }),
  },
}));

describe("GoogleIntegrationSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectionStatus = {
      status: GoogleOAuthConnectionStatus.Disconnected,
    };
    mockRelationships = [];
  });

  describe("when user is not a coach", () => {
    it("does not render the section", () => {
      mockAuthStore.mockReturnValue({ isACoach: false, userId: "user-1" });

      const { container } = render(<GoogleIntegrationSection />);
      expect(container.innerHTML).toBe("");
    });
  });

  describe("when user is a coach and disconnected", () => {
    beforeEach(() => {
      mockAuthStore.mockReturnValue({ isACoach: true, userId: "user-1" });
    });

    it("shows Connect Google Account button", () => {
      render(<GoogleIntegrationSection />);

      expect(
        screen.getByRole("button", { name: "Connect Google Account" })
      ).toBeInTheDocument();
    });

    it("hides Meet URL section when there are no relationships", () => {
      render(<GoogleIntegrationSection />);

      expect(screen.queryByText("Google Meet Links")).not.toBeInTheDocument();
    });

    it("shows relationship selector when disconnected but relationships exist", () => {
      mockRelationships = [
        createMockRelationship({
          id: "rel-1",
          coach_id: "user-1",
          coachee_first_name: "Jane",
          coachee_last_name: "Smith",
        }),
      ];

      render(<GoogleIntegrationSection />);

      expect(screen.getByText("Google Meet Links")).toBeInTheDocument();
      // Should show the Select dropdown with placeholder
      expect(screen.getByText("Select a coachee...")).toBeInTheDocument();
    });

    it("shows Meet URL field in paste-only mode after selecting a coachee", async () => {
      mockRelationships = [
        createMockRelationship({
          id: "rel-1",
          coach_id: "user-1",
          coachee_first_name: "Jane",
          coachee_last_name: "Smith",
        }),
      ];

      render(<GoogleIntegrationSection />);

      // Open the select and pick Jane
      await userEvent.click(screen.getByRole("combobox"));
      await userEvent.click(screen.getByRole("option", { name: "Jane Smith" }));

      // Create Meet button should be disabled since Google is not connected
      expect(
        screen.getByRole("button", { name: "Create Meet" })
      ).toBeDisabled();
    });

    it("navigates to backend authorize URL on connect click", async () => {
      // Spy on window.location.href assignment
      const hrefSetter = vi.fn();
      Object.defineProperty(window, "location", {
        value: { href: "" },
        writable: true,
      });
      Object.defineProperty(window.location, "href", {
        set: hrefSetter,
      });

      render(<GoogleIntegrationSection />);

      await userEvent.click(
        screen.getByRole("button", { name: "Connect Google Account" })
      );

      expect(hrefSetter).toHaveBeenCalledWith(
        "http://localhost:4000/api/oauth/google/authorize"
      );
    });
  });

  describe("when user is a coach and connected", () => {
    beforeEach(() => {
      mockAuthStore.mockReturnValue({ isACoach: true, userId: "user-1" });
      mockConnectionStatus = createMockGoogleOAuthConnectionState();
    });

    it("shows connected email", () => {
      render(<GoogleIntegrationSection />);

      expect(screen.getByText("coach@gmail.com")).toBeInTheDocument();
    });

    it("shows Disconnect button", () => {
      render(<GoogleIntegrationSection />);

      expect(
        screen.getByRole("button", { name: "Disconnect" })
      ).toBeInTheDocument();
    });

    it("shows relationship selector with coachees when relationships exist", async () => {
      mockRelationships = [
        createMockRelationship({
          id: "rel-1",
          coach_id: "user-1",
          coachee_first_name: "Jane",
          coachee_last_name: "Smith",
        }),
        createMockRelationship({
          id: "rel-2",
          coach_id: "user-1",
          coachee_first_name: "Bob",
          coachee_last_name: "Jones",
        }),
      ];

      render(<GoogleIntegrationSection />);

      // Open the select dropdown to see the options
      await userEvent.click(screen.getByRole("combobox"));

      expect(screen.getByRole("option", { name: "Bob Jones" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Jane Smith" })).toBeInTheDocument();
    });

    it("hides Meet URL section when no relationships", () => {
      mockRelationships = [];

      render(<GoogleIntegrationSection />);

      expect(screen.queryByText("Google Meet Links")).not.toBeInTheDocument();
    });
  });
});
