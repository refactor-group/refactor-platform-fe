import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

import { useTranscriptionToasts } from "@/lib/hooks/use-transcription-toasts";
import { MeetingRecordingStatus } from "@/types/meeting-recording";
import { TranscriptionStatus } from "@/types/transcription";

const recordingState: { recording: { status?: MeetingRecordingStatus; error_message?: string } | null } = {
  recording: null,
};
const transcriptionState: {
  transcription: { id?: string; status?: TranscriptionStatus; error_message?: string } | null;
} = { transcription: null };
let viewedTranscriptsState: Record<string, string> = {};

vi.mock("@/lib/api/meeting-recordings", () => ({
  useMeetingRecording: () => ({ recording: recordingState.recording }),
}));
vi.mock("@/lib/api/transcriptions", () => ({
  useTranscription: () => ({ transcription: transcriptionState.transcription }),
}));
vi.mock("@/lib/providers/ui-preferences-state-store-provider", () => ({
  useUiPreferencesStore: <T,>(
    selector: (state: { viewedTranscripts: Record<string, string> }) => T
  ) => selector({ viewedTranscripts: viewedTranscriptsState }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const SESSION_ID = "session-1";

function setRecording(status: MeetingRecordingStatus | undefined, errorMessage?: string) {
  recordingState.recording = status ? { status, error_message: errorMessage } : null;
}
function setTranscription(
  status: TranscriptionStatus | undefined,
  id = "trans-1",
  errorMessage?: string
) {
  transcriptionState.transcription = status ? { id, status, error_message: errorMessage } : null;
}

beforeEach(() => {
  toastSuccess.mockReset();
  toastError.mockReset();
  recordingState.recording = null;
  transcriptionState.transcription = null;
  viewedTranscriptsState = {};
});

describe("useTranscriptionToasts — transcript ready", () => {
  it("does NOT fire on initial mount when transcript is already Completed (page reload guard)", () => {
    setTranscription(TranscriptionStatus.Completed, "trans-1");
    renderHook(() =>
      useTranscriptionToasts({ sessionId: SESSION_ID, onOpenTranscript: vi.fn() })
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("fires once on the Processing → Completed edge", () => {
    setTranscription(TranscriptionStatus.Processing, "trans-1");
    const onOpen = vi.fn();
    const { rerender } = renderHook(() =>
      useTranscriptionToasts({ sessionId: SESSION_ID, onOpenTranscript: onOpen })
    );
    expect(toastSuccess).not.toHaveBeenCalled();

    setTranscription(TranscriptionStatus.Completed, "trans-1");
    rerender();

    expect(toastSuccess).toHaveBeenCalledTimes(1);
    const [title, opts] = toastSuccess.mock.calls[0];
    expect(title).toBe("Transcript ready");
    expect(opts).toMatchObject({
      id: `transcript-ready-${SESSION_ID}`,
      duration: 15_000,
    });
    expect(opts.action).toMatchObject({ label: "View" });
  });

  it("does NOT fire when the transcript was already viewed for this session", () => {
    setTranscription(TranscriptionStatus.Processing, "trans-1");
    viewedTranscriptsState = { [SESSION_ID]: "trans-1" };

    const { rerender } = renderHook(() =>
      useTranscriptionToasts({ sessionId: SESSION_ID, onOpenTranscript: vi.fn() })
    );
    setTranscription(TranscriptionStatus.Completed, "trans-1");
    rerender();

    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("invokes onOpenTranscript when the View action is clicked", () => {
    setTranscription(TranscriptionStatus.Processing, "trans-1");
    const onOpen = vi.fn();
    const { rerender } = renderHook(() =>
      useTranscriptionToasts({ sessionId: SESSION_ID, onOpenTranscript: onOpen })
    );
    setTranscription(TranscriptionStatus.Completed, "trans-1");
    rerender();

    const opts = toastSuccess.mock.calls[0][1];
    opts.action.onClick();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe("useTranscriptionToasts — failures", () => {
  it("fires a persistent error toast on recording.status → Failed", () => {
    setRecording(MeetingRecordingStatus.Recording);
    const { rerender } = renderHook(() =>
      useTranscriptionToasts({ sessionId: SESSION_ID, onOpenTranscript: vi.fn() })
    );

    setRecording(MeetingRecordingStatus.Failed, "Bot couldn't join");
    rerender();

    expect(toastError).toHaveBeenCalledTimes(1);
    const [title, opts] = toastError.mock.calls[0];
    expect(title).toBe("Recording failed");
    expect(opts.duration).toBe(Infinity);
    expect(opts.description).toBe("Bot couldn't join");
  });

  it("fires a persistent error toast on transcription.status → Failed", () => {
    setTranscription(TranscriptionStatus.Processing, "trans-1");
    const { rerender } = renderHook(() =>
      useTranscriptionToasts({ sessionId: SESSION_ID, onOpenTranscript: vi.fn() })
    );

    setTranscription(TranscriptionStatus.Failed, "trans-1", "AssemblyAI rejected the audio");
    rerender();

    expect(toastError).toHaveBeenCalledTimes(1);
    const [title, opts] = toastError.mock.calls[0];
    expect(title).toBe("Transcription failed");
    expect(opts.duration).toBe(Infinity);
    expect(opts.description).toBe("AssemblyAI rejected the audio");
  });

  it("does NOT fire the error toast on initial mount with status === Failed", () => {
    setRecording(MeetingRecordingStatus.Failed);
    renderHook(() =>
      useTranscriptionToasts({ sessionId: SESSION_ID, onOpenTranscript: vi.fn() })
    );
    expect(toastError).not.toHaveBeenCalled();
  });
});

describe("useTranscriptionToasts — null sessionId", () => {
  it("never fires when sessionId is null", () => {
    setTranscription(TranscriptionStatus.Processing, "trans-1");
    const { rerender } = renderHook(() =>
      useTranscriptionToasts({ sessionId: null, onOpenTranscript: vi.fn() })
    );
    setTranscription(TranscriptionStatus.Completed, "trans-1");
    rerender();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
