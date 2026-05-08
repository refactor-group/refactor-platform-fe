import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { JoinMeetingButton } from "@/components/ui/coaching-sessions/join-meeting-button";
import { MeetingRecordingStatus } from "@/types/meeting-recording";

const recordingHookState: {
  recording: { status: MeetingRecordingStatus; started_at?: string } | null;
} = { recording: null };

const startRecording = vi.fn(() => Promise.resolve({}));
const stopRecording = vi.fn(() => Promise.resolve({}));

vi.mock("@/lib/api/meeting-recordings", () => ({
  useMeetingRecording: () => ({
    recording: recordingHookState.recording,
    startRecording,
    stopRecording,
  }),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const MEETING_URL = "https://meet.google.com/abc-defg-hij";

let openSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  recordingHookState.recording = null;
  startRecording.mockClear();
  stopRecording.mockClear();
  toastError.mockClear();
  openSpy = vi.fn(() => null);
  // Replace window.open so we can assert call ordering vs the API.
  Object.defineProperty(window, "open", {
    configurable: true,
    writable: true,
    value: openSpy,
  });
});

// ── Disabled state ────────────────────────────────────────────────────

describe("JoinMeetingButton — disabled (no meeting URL)", () => {
  it("renders a disabled button when meetingUrl is missing", () => {
    render(<JoinMeetingButton sessionId="s-1" meetingUrl={undefined} isCoach={true} />);
    const button = screen.getByRole("button", { name: /join meeting/i });
    expect(button).toBeDisabled();
  });

  it("does NOT render the dropdown menu options when disabled", async () => {
    const user = userEvent.setup();
    render(<JoinMeetingButton sessionId="s-1" meetingUrl={undefined} isCoach={true} />);
    await user.click(screen.getByRole("button", { name: /join meeting/i }));
    expect(
      screen.queryByText(/join with transcription/i)
    ).not.toBeInTheDocument();
  });
});

// ── Idle (dropdown) state ────────────────────────────────────────────

describe("JoinMeetingButton — idle dropdown", () => {
  it("calls window.open synchronously BEFORE startRecording when 'Join with transcription' is clicked", async () => {
    const user = userEvent.setup();
    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={true} />);

    await user.click(screen.getByRole("button", { name: /join meeting/i }));
    await user.click(
      await screen.findByRole("menuitem", { name: /join with transcription/i })
    );

    // Pop-up-blocker safety: window.open must run inside the user-gesture turn,
    // BEFORE any async API call. Both should have fired in the same tick, with
    // open invoked first.
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      MEETING_URL,
      "_blank",
      "noopener,noreferrer"
    );
    expect(startRecording).toHaveBeenCalledWith(MEETING_URL);

    const openOrder = openSpy.mock.invocationCallOrder[0];
    const startOrder = startRecording.mock.invocationCallOrder[0];
    expect(openOrder).toBeLessThan(startOrder);
  });

  it("only calls window.open (no API call) for 'Join without transcription'", async () => {
    const user = userEvent.setup();
    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={true} />);

    await user.click(screen.getByRole("button", { name: /join meeting/i }));
    await user.click(
      await screen.findByRole("menuitem", {
        name: /join without transcription/i,
      })
    );

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(startRecording).not.toHaveBeenCalled();
  });

  it("surfaces an error toast if startRecording rejects", async () => {
    const user = userEvent.setup();
    startRecording.mockRejectedValueOnce(new Error("Recall.ai unavailable"));

    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={true} />);
    await user.click(screen.getByRole("button", { name: /join meeting/i }));
    const item = await screen.findByRole("menuitem", {
      name: /join with transcription/i,
    });

    await act(async () => {
      await user.click(item);
    });

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError.mock.calls[0][0]).toMatch(/couldn't start transcription/i);
  });
});

// ── Joining (in-progress, pre-live) state ─────────────────────────────

describe.each([
  MeetingRecordingStatus.Pending,
  MeetingRecordingStatus.Joining,
  MeetingRecordingStatus.WaitingRoom,
])("JoinMeetingButton — joining (status=%s)", (status) => {
  it("renders a disabled icon button with the joining-meeting accessible name", () => {
    recordingHookState.recording = { status };
    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={true} />);
    const button = screen.getByRole("button", { name: /joining meeting/i });
    expect(button).toBeDisabled();
  });
});

// ── Live state ────────────────────────────────────────────────────────

describe.each([
  MeetingRecordingStatus.InMeeting,
  MeetingRecordingStatus.Recording,
])("JoinMeetingButton — live (status=%s)", (status) => {
  it("shows the Transcribing live pill with a duration timer", () => {
    const startedAt = new Date(Date.now() - 65_000).toISOString();
    recordingHookState.recording = { status, started_at: startedAt };

    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={true} />);
    expect(
      screen.getByRole("button", { name: /stop transcription/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/transcribing/i)).toBeInTheDocument();
    expect(screen.getByText(/1:05/)).toBeInTheDocument();
  });

  it("opens the AlertDialog on click; confirming calls stopRecording", async () => {
    const user = userEvent.setup();
    recordingHookState.recording = {
      status,
      started_at: new Date().toISOString(),
    };

    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={true} />);
    await user.click(
      screen.getByRole("button", { name: /stop transcription/i })
    );

    const confirm = await screen.findByRole("button", {
      name: /^stop transcription$/i,
    });
    await user.click(confirm);

    expect(stopRecording).toHaveBeenCalledTimes(1);
  });

  it("cancelling the dialog does NOT call stopRecording", async () => {
    const user = userEvent.setup();
    recordingHookState.recording = {
      status,
      started_at: new Date().toISOString(),
    };

    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={true} />);
    await user.click(
      screen.getByRole("button", { name: /stop transcription/i })
    );

    const cancel = await screen.findByRole("button", {
      name: /keep transcribing/i,
    });
    await user.click(cancel);

    expect(stopRecording).not.toHaveBeenCalled();
  });
});

// ── Processing state ─────────────────────────────────────────────────

describe("JoinMeetingButton — processing", () => {
  it("renders a disabled icon button with the processing accessible name", () => {
    recordingHookState.recording = {
      status: MeetingRecordingStatus.Processing,
    };
    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={true} />);
    const button = screen.getByRole("button", {
      name: /processing transcription/i,
    });
    expect(button).toBeDisabled();
  });
});

// ── Terminal states fall back to idle ────────────────────────────────

describe.each([
  MeetingRecordingStatus.Completed,
  MeetingRecordingStatus.Failed,
])("JoinMeetingButton — terminal (status=%s) returns to idle", (status) => {
  it("renders the Join Meeting dropdown trigger", () => {
    recordingHookState.recording = { status };
    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={true} />);
    expect(
      screen.getByRole("button", { name: /join meeting/i })
    ).not.toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Coachee role: encodes the consent + bot-singleton invariants.
//
// The recording bot is a session-level singleton owned by the coach.
// The coachee must NEVER be able to:
//   (1) start a recording (consent ownership)
//   (2) stop a recording (lifecycle ownership)
//   (3) silently disable transcription mid-session
//
// These tests guard those invariants at the component boundary so a
// future refactor can't accidentally regress consent semantics.
// ─────────────────────────────────────────────────────────────────────

describe("JoinMeetingButton — coachee idle", () => {
  it("renders a plain icon button with no dropdown chevron", () => {
    render(
      <JoinMeetingButton
        sessionId="s-1"
        meetingUrl={MEETING_URL}
        isCoach={false}
      />
    );
    const button = screen.getByRole("button", { name: /join meeting/i });
    expect(button).not.toBeDisabled();
    // The coach idle button has aria-haspopup (DropdownMenuTrigger);
    // the coachee button must not.
    expect(button).not.toHaveAttribute("aria-haspopup", "menu");
  });

  it("opens the meeting URL via window.open when clicked", async () => {
    const user = userEvent.setup();
    render(
      <JoinMeetingButton
        sessionId="s-1"
        meetingUrl={MEETING_URL}
        isCoach={false}
      />
    );

    await user.click(screen.getByRole("button", { name: /join meeting/i }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      MEETING_URL,
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("INVARIANT: coachee clicking idle NEVER calls startRecording", async () => {
    const user = userEvent.setup();
    render(
      <JoinMeetingButton
        sessionId="s-1"
        meetingUrl={MEETING_URL}
        isCoach={false}
      />
    );
    await user.click(screen.getByRole("button", { name: /join meeting/i }));

    expect(startRecording).not.toHaveBeenCalled();
  });

  it("INVARIANT: coachee idle does NOT expose a transcription dropdown", async () => {
    const user = userEvent.setup();
    render(
      <JoinMeetingButton
        sessionId="s-1"
        meetingUrl={MEETING_URL}
        isCoach={false}
      />
    );
    await user.click(screen.getByRole("button", { name: /join meeting/i }));

    expect(
      screen.queryByText(/join with transcription/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/join without transcription/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });

  it("falls back to the same coachee idle path on terminal recording statuses", () => {
    // After a session ends (Completed / Failed), the coachee should still
    // see the plain icon — not, e.g., a coach-style dropdown leaking through.
    recordingHookState.recording = {
      status: MeetingRecordingStatus.Completed,
    };
    render(
      <JoinMeetingButton
        sessionId="s-1"
        meetingUrl={MEETING_URL}
        isCoach={false}
      />
    );
    const button = screen.getByRole("button", { name: /join meeting/i });
    expect(button).not.toHaveAttribute("aria-haspopup", "menu");
  });
});

describe("JoinMeetingButton — coachee live (transparency, no controls)", () => {
  it("renders the pulsing Transcribing pill so the coachee sees it's being recorded", () => {
    recordingHookState.recording = {
      status: MeetingRecordingStatus.Recording,
      started_at: new Date(Date.now() - 65_000).toISOString(),
    };
    render(
      <JoinMeetingButton
        sessionId="s-1"
        meetingUrl={MEETING_URL}
        isCoach={false}
      />
    );
    expect(screen.getByText(/transcribing/i)).toBeInTheDocument();
    expect(screen.getByText(/1:05/)).toBeInTheDocument();
  });

  it("the live pill carries a non-interactive accessible name and aria-disabled", () => {
    recordingHookState.recording = {
      status: MeetingRecordingStatus.Recording,
      started_at: new Date().toISOString(),
    };
    render(
      <JoinMeetingButton
        sessionId="s-1"
        meetingUrl={MEETING_URL}
        isCoach={false}
      />
    );
    const pill = screen.getByRole("button", {
      name: /transcription in progress/i,
    });
    expect(pill).toHaveAttribute("aria-disabled", "true");
    // The coach's pill is named "Stop transcription"; a coachee with that
    // accessible name would be a regression we must catch.
    expect(
      screen.queryByRole("button", { name: /stop transcription/i })
    ).not.toBeInTheDocument();
  });

  it("INVARIANT: clicking the coachee live pill does NOT open the stop-confirm AlertDialog", async () => {
    const user = userEvent.setup();
    recordingHookState.recording = {
      status: MeetingRecordingStatus.Recording,
      started_at: new Date().toISOString(),
    };
    render(
      <JoinMeetingButton
        sessionId="s-1"
        meetingUrl={MEETING_URL}
        isCoach={false}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /transcription in progress/i })
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/stop transcription\?/i)
    ).not.toBeInTheDocument();
  });

  it("INVARIANT: coachee can NEVER call stopRecording, even via repeated clicks", async () => {
    const user = userEvent.setup();
    recordingHookState.recording = {
      status: MeetingRecordingStatus.Recording,
      started_at: new Date().toISOString(),
    };
    render(
      <JoinMeetingButton
        sessionId="s-1"
        meetingUrl={MEETING_URL}
        isCoach={false}
      />
    );
    const pill = screen.getByRole("button", {
      name: /transcription in progress/i,
    });

    await user.click(pill);
    await user.click(pill);
    await user.click(pill);

    expect(stopRecording).not.toHaveBeenCalled();
  });
});

describe("JoinMeetingButton — role-agnostic states", () => {
  it("disabled (no meeting URL) state is identical for coach and coachee", () => {
    const { rerender } = render(
      <JoinMeetingButton
        sessionId="s-1"
        meetingUrl={undefined}
        isCoach={true}
      />
    );
    const coachLabel = screen
      .getByRole("button", { name: /join meeting/i })
      .getAttribute("aria-label");
    expect(
      screen.getByRole("button", { name: /join meeting/i })
    ).toBeDisabled();

    rerender(
      <JoinMeetingButton
        sessionId="s-1"
        meetingUrl={undefined}
        isCoach={false}
      />
    );
    expect(
      screen.getByRole("button", { name: /join meeting/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /join meeting/i }).getAttribute(
        "aria-label"
      )
    ).toBe(coachLabel);
  });

  it("joining state renders identically regardless of role", () => {
    recordingHookState.recording = { status: MeetingRecordingStatus.Joining };
    const { rerender } = render(
      <JoinMeetingButton
        sessionId="s-1"
        meetingUrl={MEETING_URL}
        isCoach={true}
      />
    );
    expect(
      screen.getByRole("button", { name: /joining meeting/i })
    ).toBeDisabled();

    rerender(
      <JoinMeetingButton
        sessionId="s-1"
        meetingUrl={MEETING_URL}
        isCoach={false}
      />
    );
    expect(
      screen.getByRole("button", { name: /joining meeting/i })
    ).toBeDisabled();
  });

  it("processing state renders identically regardless of role", () => {
    recordingHookState.recording = {
      status: MeetingRecordingStatus.Processing,
    };
    const { rerender } = render(
      <JoinMeetingButton
        sessionId="s-1"
        meetingUrl={MEETING_URL}
        isCoach={true}
      />
    );
    expect(
      screen.getByRole("button", { name: /processing transcription/i })
    ).toBeDisabled();

    rerender(
      <JoinMeetingButton
        sessionId="s-1"
        meetingUrl={MEETING_URL}
        isCoach={false}
      />
    );
    expect(
      screen.getByRole("button", { name: /processing transcription/i })
    ).toBeDisabled();
  });
});

describe("JoinMeetingButton — role transitions don't leak privileges", () => {
  it("rerendering from coach to coachee while live removes the stop affordance", async () => {
    const user = userEvent.setup();
    recordingHookState.recording = {
      status: MeetingRecordingStatus.Recording,
      started_at: new Date().toISOString(),
    };

    const { rerender } = render(
      <JoinMeetingButton
        sessionId="s-1"
        meetingUrl={MEETING_URL}
        isCoach={true}
      />
    );
    // Coach can stop.
    expect(
      screen.getByRole("button", { name: /stop transcription/i })
    ).toBeInTheDocument();

    // Role flips to coachee (e.g., role hook re-derives mid-session).
    rerender(
      <JoinMeetingButton
        sessionId="s-1"
        meetingUrl={MEETING_URL}
        isCoach={false}
      />
    );

    expect(
      screen.queryByRole("button", { name: /stop transcription/i })
    ).not.toBeInTheDocument();

    // Clicking the now-coachee pill must not trigger stop.
    const pill = screen.getByRole("button", {
      name: /transcription in progress/i,
    });
    await user.click(pill);
    expect(stopRecording).not.toHaveBeenCalled();
  });
});
