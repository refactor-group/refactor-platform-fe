import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZoomIntegrationSection } from "@/components/ui/settings/zoom-integration-section";
import { OAuthConnection } from "@/types/oauth-connection";
import {
  createMockZoomOAuthConnectionState,
} from "../../../__tests__/test-utils";

// Mock the hooks
const mockAuthStore = vi.fn();
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector(mockAuthStore()),
}));

const mockRefreshOAuth = vi.fn();
vi.mock("@/lib/api/oauth-connection", () => ({
  useOAuthConnection: () => ({
    connection: mockConnectionStatus,
    isLoading: false,
    isError: undefined,
    refresh: mockRefreshOAuth,
  }),
  OAuthConnectionApi: {
    getAuthorizeUrl: () => "http://localhost:4000/api/oauth/zoom/authorize",
    disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

let mockConnectionStatus: OAuthConnection | null = null;

describe("ZoomIntegrationSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectionStatus = null;
  });

  describe("when user is not a coach", () => {
    it("does not render the section", () => {
      mockAuthStore.mockReturnValue({ isACoach: false, userId: "user-1" });

      const { container } = render(<ZoomIntegrationSection />);
      expect(container.innerHTML).toBe("");
    });
  });

  describe("when user is a coach and disconnected", () => {
    beforeEach(() => {
      mockAuthStore.mockReturnValue({ isACoach: true, userId: "user-1" });
    });

    it("shows Connect Zoom Account button", () => {
      render(<ZoomIntegrationSection />);

      expect(
        screen.getByRole("button", { name: "Connect Zoom Account" })
      ).toBeInTheDocument();
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

      render(<ZoomIntegrationSection />);

      await userEvent.click(
        screen.getByRole("button", { name: "Connect Zoom Account" })
      );

      expect(hrefSetter).toHaveBeenCalledWith(
        "http://localhost:4000/api/oauth/zoom/authorize"
      );
    });
  });

  describe("when user is a coach and connected", () => {
    beforeEach(() => {
      mockAuthStore.mockReturnValue({ isACoach: true, userId: "user-1" });
      mockConnectionStatus = createMockZoomOAuthConnectionState();
    });

    it("shows connected email", () => {
      render(<ZoomIntegrationSection />);

      expect(screen.getByText("coach@zoom.us")).toBeInTheDocument();
    });

    it("shows Disconnect button", () => {
      render(<ZoomIntegrationSection />);

      expect(
        screen.getByRole("button", { name: "Disconnect" })
      ).toBeInTheDocument();
    });
  });
});
