import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MeetingIntegrationSection } from "@/components/ui/settings/meeting-integration-section";
import { OAuthConnection } from "@/types/oauth-connection";
import { Provider } from "@/types/provider";
import {
  createMockGoogleOAuthConnectionState,
  createMockZoomOAuthConnectionState,
} from "../../../__tests__/test-utils";

// Mock the hooks
const mockAuthStore = vi.fn();
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector(mockAuthStore()),
}));

const mockRefreshOAuth = vi.fn();
let mockGoogleConnection: OAuthConnection | null = null;
let mockZoomConnection: OAuthConnection | null = null;

vi.mock("@/lib/api/oauth-connection", () => ({
  useOAuthConnection: (provider: string) => ({
    connection:
      provider === "google" ? mockGoogleConnection : mockZoomConnection,
    isLoading: false,
    isError: undefined,
    refresh: mockRefreshOAuth,
  }),
  OAuthConnectionApi: {
    getAuthorizeUrl: (provider: string) =>
      `http://localhost:4000/api/oauth/${provider}/authorize`,
    disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("MeetingIntegrationSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGoogleConnection = null;
    mockZoomConnection = null;
  });

  describe("when user is not a coach", () => {
    it("does not render the section", () => {
      mockAuthStore.mockReturnValue({ isACoach: false, userId: "user-1" });

      const { container } = render(<MeetingIntegrationSection />);
      expect(container.innerHTML).toBe("");
    });
  });

  describe("when user is a coach and disconnected", () => {
    beforeEach(() => {
      mockAuthStore.mockReturnValue({ isACoach: true, userId: "user-1" });
    });

    it("shows the platform dropdown", () => {
      render(<MeetingIntegrationSection />);

      expect(screen.getByText("Select a platform")).toBeInTheDocument();
    });

    it("shows the updated description text", () => {
      render(<MeetingIntegrationSection />);

      expect(
        screen.getByText(
          "Connect your Google or Zoom account to enable video calls and AI-powered session transcription."
        )
      ).toBeInTheDocument();
    });

    it("does not show a connect button before selecting a platform", () => {
      render(<MeetingIntegrationSection />);

      expect(
        screen.queryByRole("button", { name: /Connect.*Account/ })
      ).not.toBeInTheDocument();
    });
  });

  describe("when Google is connected", () => {
    beforeEach(() => {
      mockAuthStore.mockReturnValue({ isACoach: true, userId: "user-1" });
      mockGoogleConnection = createMockGoogleOAuthConnectionState();
    });

    it("shows connected Google email", () => {
      render(<MeetingIntegrationSection />);

      expect(screen.getByText("coach@gmail.com")).toBeInTheDocument();
    });

    it("shows the Google provider label", () => {
      render(<MeetingIntegrationSection />);

      expect(screen.getByText("Google")).toBeInTheDocument();
    });

    it("shows Disconnect button", () => {
      render(<MeetingIntegrationSection />);

      expect(
        screen.getByRole("button", { name: "Disconnect" })
      ).toBeInTheDocument();
    });

    it("does not show the platform dropdown", () => {
      render(<MeetingIntegrationSection />);

      expect(screen.queryByText("Select a platform")).not.toBeInTheDocument();
    });
  });

  describe("when Zoom is connected", () => {
    beforeEach(() => {
      mockAuthStore.mockReturnValue({ isACoach: true, userId: "user-1" });
      mockZoomConnection = createMockZoomOAuthConnectionState();
    });

    it("shows connected Zoom email", () => {
      render(<MeetingIntegrationSection />);

      expect(screen.getByText("coach@zoom.us")).toBeInTheDocument();
    });

    it("shows the Zoom provider label", () => {
      render(<MeetingIntegrationSection />);

      expect(screen.getByText("Zoom")).toBeInTheDocument();
    });

    it("shows Disconnect button", () => {
      render(<MeetingIntegrationSection />);

      expect(
        screen.getByRole("button", { name: "Disconnect" })
      ).toBeInTheDocument();
    });
  });
});
