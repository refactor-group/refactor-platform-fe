import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleIntegrationSection } from "@/components/ui/settings/google-integration-section";
import { OAuthConnection } from "@/types/oauth-connection";
import {
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
  useGoogleOAuthConnection: () => ({
    connection: mockConnectionStatus,
    isLoading: false,
    isError: undefined,
    refresh: mockRefreshOAuth,
  }),
  OAuthConnectionApi: {
    getAuthorizeUrl: () => "http://localhost:4000/api/oauth/google/authorize",
    disconnectGoogle: vi.fn().mockResolvedValue(undefined),
  },
}));

let mockConnectionStatus: OAuthConnection | null = null;

describe("GoogleIntegrationSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectionStatus = null;
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
  });
});
