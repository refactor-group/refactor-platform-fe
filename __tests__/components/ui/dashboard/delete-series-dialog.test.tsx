import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DeleteSeriesDialog } from "@/components/ui/dashboard/delete-series-dialog";
import { defaultCoachingSessionSeries } from "@/types/coaching-session-series";
import { Frequency } from "@/types/recurrence";

function makeSeries(frequency: Frequency = Frequency.Weekly) {
  const base = defaultCoachingSessionSeries();
  return {
    ...base,
    id: "series-1",
    rule: {
      ...base.rule,
      recurrence: { ...base.rule.recurrence, frequency },
    },
  };
}

function renderDialog(
  overrides?: Partial<React.ComponentProps<typeof DeleteSeriesDialog>>
) {
  const props = {
    series: makeSeries(),
    participantName: "Caleb Bourg",
    isDeleting: false,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  render(<DeleteSeriesDialog {...props} />);
  return props;
}

describe("DeleteSeriesDialog", () => {
  it("names the frequency and counterpart, mirroring the session-delete copy", () => {
    renderDialog({ series: makeSeries(Frequency.Weekly), participantName: "Caleb Bourg" });

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent(
      "permanently remove the weekly series with Caleb Bourg from today onward"
    );
    expect(dialog).toHaveTextContent(
      "along with all of its notes and completed actions"
    );
    expect(dialog).toHaveTextContent("can't be undone");
    // The counterpart is emphasized like the session dialog does.
    expect(screen.getByText("Caleb Bourg")).toBeInTheDocument();
  });

  it("reflects the series frequency in the copy", () => {
    renderDialog({ series: makeSeries(Frequency.Monthly) });

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "remove the monthly series with Caleb Bourg from today onward"
    );
  });

  it("drops the 'with <name>' clause when the counterpart is unresolved", () => {
    renderDialog({ series: makeSeries(Frequency.Weekly), participantName: "" });

    const dialog = screen.getByRole("alertdialog");
    // "series" runs straight into "from today onward" with no dangling "with".
    expect(dialog).toHaveTextContent(
      "remove the weekly series from today onward"
    );
    expect(screen.queryByText("Caleb Bourg")).not.toBeInTheDocument();
  });

  it("renders nothing when no series is pending (series undefined)", () => {
    renderDialog({ series: undefined });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("fires onConfirm and reflects the in-flight state", () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <DeleteSeriesDialog
        series={makeSeries()}
        participantName="Caleb Bourg"
        isDeleting={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete series" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    rerender(
      <DeleteSeriesDialog
        series={makeSeries()}
        participantName="Caleb Bourg"
        isDeleting={true}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    const confirm = screen.getByRole("button", { name: "Deleting…" });
    expect(confirm).toBeDisabled();
  });
});
