import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import {
  TranscriptSpeakerFilter,
  type SpeakerFilterOption,
} from "@/components/ui/coaching-sessions/transcript-speaker-filter";

const OPTIONS: SpeakerFilterOption[] = [
  { value: "all", label: "All" },
  { value: "Speaker A", label: "Speaker A", swatchClass: "bg-[#007AFF]" },
  { value: "Speaker B", label: "Speaker B", swatchClass: "bg-zinc-400" },
];

describe("TranscriptSpeakerFilter", () => {
  it("renders every option label", () => {
    render(
      <TranscriptSpeakerFilter
        options={OPTIONS}
        value="all"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole("radio", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Speaker A" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Speaker B" })).toBeInTheDocument();
  });

  it("marks the currently selected option as aria-checked", () => {
    render(
      <TranscriptSpeakerFilter
        options={OPTIONS}
        value="Speaker B"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole("radio", { name: "All" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByRole("radio", { name: "Speaker B" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("calls onChange with the clicked option's value", () => {
    const onChange = vi.fn();
    render(
      <TranscriptSpeakerFilter
        options={OPTIONS}
        value="all"
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: "Speaker A" }));
    expect(onChange).toHaveBeenCalledWith("Speaker A");
  });

  it("clicking the already-active option still fires onChange (no swallowing)", () => {
    // Guarantees parents can observe re-clicks if they want to treat it as a toggle.
    const onChange = vi.fn();
    render(
      <TranscriptSpeakerFilter
        options={OPTIONS}
        value="Speaker A"
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: "Speaker A" }));
    expect(onChange).toHaveBeenCalledWith("Speaker A");
  });

  it("exposes the radio group with a default accessible label", () => {
    render(
      <TranscriptSpeakerFilter
        options={OPTIONS}
        value="all"
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByRole("radiogroup", { name: "Filter transcript by speaker" })
    ).toBeInTheDocument();
  });

  it("supports a custom accessible label", () => {
    render(
      <TranscriptSpeakerFilter
        options={OPTIONS}
        value="all"
        onChange={vi.fn()}
        ariaLabel="Speaker filter"
      />
    );
    expect(
      screen.getByRole("radiogroup", { name: "Speaker filter" })
    ).toBeInTheDocument();
  });
});
