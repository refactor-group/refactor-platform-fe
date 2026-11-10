import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileInfoUpdateForm } from "@/components/ui/members/profile-info-update-form";
import { MemberProfileContainer } from "@/components/ui/members/member-profile-container";
import { createMockUser } from "../../../test-utils";

const USER = createMockUser({
  id: "user-1",
  email: "jim@example.com",
  first_name: "Jim",
  last_name: "Hodapp",
  display_name: "Jim",
  timezone: "America/Chicago",
  default_coaching_session_duration_minutes: 45,
  working_hours_start: "09:00",
  working_hours_end: "17:00",
});
const PROFILE = {
  email: "jim@example.com",
  first_name: "James",
  last_name: "Hodapp",
  display_name: "Jim",
  timezone: "America/Chicago",
};

vi.mock("@/components/ui/timezone-selector", () => ({ TimezoneSelector: () => null }));

const updateProfile = vi.fn();
const updateWhole = vi.fn();
vi.mock("@/lib/api/users", () => ({
  useUser: () => ({ user: USER, isLoading: false, refresh: vi.fn() }),
  useUserMutation: () => ({ update: updateWhole, isLoading: false }),
  useUserProfileMutation: () => ({ update: updateProfile, isLoading: false }),
  useUserPasswordMutation: () => ({ update: vi.fn() }),
}));
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (select: (s: unknown) => unknown) => select({ userId: "user-1", setTimezone: vi.fn() }),
}));
vi.mock("@/lib/hooks/use-logout-user", () => ({ useLogoutUser: () => vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

const rename = () => {
  fireEvent.change(screen.getByLabelText("First Name"), { target: { value: "James" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Profile" }));
};

beforeEach(() => vi.clearAllMocks());

describe("profile saves", () => {
  it("the form submits only the fields it edits", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProfileInfoUpdateForm user={USER} onSubmit={onSubmit} isSubmitting={false} />);
    rename();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual(PROFILE);
  });

  it("saving the profile sends only those fields, never the whole user", async () => {
    updateProfile.mockResolvedValue(USER);
    render(<MemberProfileContainer userId="user-1" />);
    rename();
    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    expect(updateProfile).toHaveBeenCalledWith("user-1", PROFILE);
    expect(updateWhole).not.toHaveBeenCalled();
  });
});
