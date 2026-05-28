import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
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

// ── Coach idle (dropdown) state ──────────────────────────────────────

describe("JoinMeetingButton — coach idle dropdown", () => {
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

// ── Coach joining (pre-live) state ───────────────────────────────────

describe.each([
  MeetingRecordingStatus.Pending,
  MeetingRecordingStatus.Joining,
  MeetingRecordingStatus.WaitingRoom,
])("JoinMeetingButton — coach joining (status=%s)", (status) => {
  it("renders the camera dropdown with 'Open meeting' and no 'Stop transcription' item yet", async () => {
    const user = userEvent.setup();
    recordingHookState.recording = { status };

    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={true} />);

    const trigger = screen.getByRole("button", { name: /join meeting/i });
    expect(trigger).not.toBeDisabled();

    await user.click(trigger);

    expect(
      await screen.findByRole("menuitem", { name: /open meeting/i })
    ).toBeInTheDocument();
    // The bot is still joining — nothing to stop.
    expect(
      screen.queryByRole("menuitem", { name: /stop transcription/i })
    ).not.toBeInTheDocument();
  });

  it("'Open meeting' opens the meeting URL", async () => {
    const user = userEvent.setup();
    recordingHookState.recording = { status };

    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={true} />);
    await user.click(screen.getByRole("button", { name: /join meeting/i }));
    await user.click(
      await screen.findByRole("menuitem", { name: /open meeting/i })
    );

    expect(openSpy).toHaveBeenCalledWith(
      MEETING_URL,
      "_blank",
      "noopener,noreferrer"
    );
  });
});

// ── Coach live state ─────────────────────────────────────────────────

describe.each([
  MeetingRecordingStatus.InMeeting,
  MeetingRecordingStatus.Recording,
])("JoinMeetingButton — coach live (status=%s)", (status) => {
  it("exposes 'Open meeting' and 'Stop transcription' items under the camera dropdown", async () => {
    const user = userEvent.setup();
    recordingHookState.recording = {
      status,
      started_at: new Date().toISOString(),
    };

    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={true} />);
    await user.click(screen.getByRole("button", { name: /join meeting/i }));

    expect(
      await screen.findByRole("menuitem", { name: /open meeting/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("menuitem", { name: /stop transcription/i })
    ).toBeInTheDocument();
  });

  it("selecting 'Stop transcription' opens the AlertDialog; confirming calls stopRecording", async () => {
    const user = userEvent.setup();
    recordingHookState.recording = {
      status,
      started_at: new Date().toISOString(),
    };

    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={true} />);
    await user.click(screen.getByRole("button", { name: /join meeting/i }));
    await user.click(
      await screen.findByRole("menuitem", { name: /stop transcription/i })
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
    await user.click(screen.getByRole("button", { name: /join meeting/i }));
    await user.click(
      await screen.findByRole("menuitem", { name: /stop transcription/i })
    );

    const cancel = await screen.findByRole("button", {
      name: /keep transcribing/i,
    });
    await user.click(cancel);

    expect(stopRecording).not.toHaveBeenCalled();
  });
});

// ── Coach processing state ───────────────────────────────────────────

describe("JoinMeetingButton — coach processing", () => {
  it("renders the camera dropdown with only 'Open meeting' (recording is done)", async () => {
    const user = userEvent.setup();
    recordingHookState.recording = {
      status: MeetingRecordingStatus.Processing,
    };

    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={true} />);

    const trigger = screen.getByRole("button", { name: /join meeting/i });
    expect(trigger).not.toBeDisabled();

    await user.click(trigger);

    expect(
      await screen.findByRole("menuitem", { name: /open meeting/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /stop transcription/i })
    ).not.toBeInTheDocument();
  });
});

// ── Terminal states fall back to idle ────────────────────────────────

describe.each([
  MeetingRecordingStatus.Completed,
  MeetingRecordingStatus.Failed,
])("JoinMeetingButton — coach terminal (status=%s) returns to idle", (status) => {
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
// The coachee must ALWAYS be able to:
//   (4) open the meeting URL — regardless of recording status (#404)
//
// These tests guard those invariants at the component boundary so a
// future refactor can't accidentally regress consent semantics or
// re-introduce the bug where the coachee lost their join button once
// the coach started recording.
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

// Regression tests for #404 — the coachee must keep their join button
// across every non-disabled recording status. Pre-fix, statuses other
// than idle replaced the camera button with a transcription pill.
describe.each([
  MeetingRecordingStatus.Pending,
  MeetingRecordingStatus.Joining,
  MeetingRecordingStatus.WaitingRoom,
  MeetingRecordingStatus.InMeeting,
  MeetingRecordingStatus.Recording,
  MeetingRecordingStatus.Processing,
])(
  "JoinMeetingButton — coachee non-idle (status=%s) — issue #404 regression",
  (status) => {
    it("still renders the plain camera join button", () => {
      recordingHookState.recording = {
        status,
        started_at: new Date().toISOString(),
      };
      render(
        <JoinMeetingButton
          sessionId="s-1"
          meetingUrl={MEETING_URL}
          isCoach={false}
        />
      );
      const button = screen.getByRole("button", { name: /join meeting/i });
      expect(button).not.toBeDisabled();
      expect(button).not.toHaveAttribute("aria-haspopup", "menu");
    });

    it("does NOT render a 'Transcribing' pill or 'Transcription in progress' affordance", () => {
      recordingHookState.recording = {
        status,
        started_at: new Date().toISOString(),
      };
      render(
        <JoinMeetingButton
          sessionId="s-1"
          meetingUrl={MEETING_URL}
          isCoach={false}
        />
      );
      expect(screen.queryByText(/transcribing/i)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /transcription in progress/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /stop transcription/i })
      ).not.toBeInTheDocument();
    });

    it("INVARIANT: clicking the coachee button NEVER calls stopRecording or startRecording", async () => {
      const user = userEvent.setup();
      recordingHookState.recording = {
        status,
        started_at: new Date().toISOString(),
      };
      render(
        <JoinMeetingButton
          sessionId="s-1"
          meetingUrl={MEETING_URL}
          isCoach={false}
        />
      );
      await user.click(screen.getByRole("button", { name: /join meeting/i }));

      expect(stopRecording).not.toHaveBeenCalled();
      expect(startRecording).not.toHaveBeenCalled();
      expect(openSpy).toHaveBeenCalledWith(
        MEETING_URL,
        "_blank",
        "noopener,noreferrer"
      );
    });
  }
);

describe("JoinMeetingButton — role-agnostic disabled state", () => {
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
      screen
        .getByRole("button", { name: /join meeting/i })
        .getAttribute("aria-label")
    ).toBe(coachLabel);
  });
});

// Red pulsing dot lives on the camera/join button while the bot is in
// the meeting (InMeeting or Recording) — matches what the BE actually
// emits during a live session; bots commonly sit on InMeeting without
// ever transitioning to a literal Recording status.
describe("JoinMeetingButton — recording dot on camera icon", () => {
  const RECORDING_DOT = "join-meeting-recording-dot";

  it.each([
    MeetingRecordingStatus.InMeeting,
    MeetingRecordingStatus.Recording,
  ])("renders a red pulsing dot for the coach during status=%s", (status) => {
    recordingHookState.recording = {
      status,
      started_at: new Date().toISOString(),
    };
    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={true} />);
    const dot = screen.getByTestId(RECORDING_DOT);
    expect(dot.className).toContain("bg-red-500");
    expect(dot.className).toContain("motion-safe:animate-pulse");
  });

  it.each([
    MeetingRecordingStatus.InMeeting,
    MeetingRecordingStatus.Recording,
  ])("renders a red pulsing dot for the coachee during status=%s (transparency)", (status) => {
    recordingHookState.recording = {
      status,
      started_at: new Date().toISOString(),
    };
    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={false} />);
    const dot = screen.getByTestId(RECORDING_DOT);
    expect(dot.className).toContain("bg-red-500");
    expect(dot.className).toContain("motion-safe:animate-pulse");
  });

  it.each([
    MeetingRecordingStatus.Pending,
    MeetingRecordingStatus.Joining,
    MeetingRecordingStatus.WaitingRoom,
    MeetingRecordingStatus.Processing,
    MeetingRecordingStatus.Completed,
    MeetingRecordingStatus.Failed,
  ])("does NOT render the dot for status=%s (coach)", (status) => {
    recordingHookState.recording = { status };
    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={true} />);
    expect(screen.queryByTestId(RECORDING_DOT)).not.toBeInTheDocument();
  });

  it.each([
    MeetingRecordingStatus.Pending,
    MeetingRecordingStatus.Joining,
    MeetingRecordingStatus.WaitingRoom,
    MeetingRecordingStatus.Processing,
    MeetingRecordingStatus.Completed,
    MeetingRecordingStatus.Failed,
  ])("does NOT render the dot for status=%s (coachee)", (status) => {
    recordingHookState.recording = { status };
    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={false} />);
    expect(screen.queryByTestId(RECORDING_DOT)).not.toBeInTheDocument();
  });

  it("does NOT render the dot when idle (no recording)", () => {
    render(<JoinMeetingButton sessionId="s-1" meetingUrl={MEETING_URL} isCoach={true} />);
    expect(screen.queryByTestId(RECORDING_DOT)).not.toBeInTheDocument();
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

    // Coach: dropdown trigger present; opening it reveals the stop item.
    await user.click(screen.getByRole("button", { name: /join meeting/i }));
    expect(
      await screen.findByRole("menuitem", { name: /stop transcription/i })
    ).toBeInTheDocument();

    // Role flips to coachee (e.g., role hook re-derives mid-session).
    rerender(
      <JoinMeetingButton
        sessionId="s-1"
        meetingUrl={MEETING_URL}
        isCoach={false}
      />
    );

    // Coachee: plain icon, no menu items, no stop affordance.
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
    const button = screen.getByRole("button", { name: /join meeting/i });
    expect(button).not.toHaveAttribute("aria-haspopup", "menu");

    await user.click(button);
    expect(stopRecording).not.toHaveBeenCalled();
  });
});
