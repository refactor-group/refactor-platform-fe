import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DeleteSeriesDialog } from "@/components/ui/dashboard/delete-series-dialog";
import { defaultCoachingSessionSeries } from "@/types/coaching-session-series";
import { Frequency } from "@/types/recurrence";
import { None, Some } from "@/types/option";

function makeSeries(frequency: Frequency = Frequency.Weekly) {
  const base = defaultCoachingSessionSeries();
  return {
    ...base,
    id: "series-1",
    rule: { ...base.rule, recurrence: { ...base.rule.recurrence, frequency } },
  };
}

function renderDialog(overrides?: Partial<React.ComponentProps<typeof DeleteSeriesDialog>>) {
  const props = {
    series: Some(makeSeries()),
    participantName: Some("Caleb Bourg"),
    isDeleting: false,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  render(<DeleteSeriesDialog {...props} />);
  return props;
}

describe("DeleteSeriesDialog", () => {
  it("asks to cancel the series, naming its frequency and counterpart", () => {
    renderDialog();
    const dialog = screen.getByRole("alertdialog", { name: "Cancel this recurring series?" });
    expect(dialog).toHaveTextContent("weekly series with Caleb Bourg from today onward");
    expect(dialog).toHaveTextContent(/notes and actions/);
    expect(dialog).toHaveTextContent("can't be undone");
    expect(dialog).not.toHaveTextContent(/delet/i);
    expect(screen.getByText("Caleb Bourg")).toBeInTheDocument();
  });

  it("reflects the series frequency", () => {
    renderDialog({ series: Some(makeSeries(Frequency.Monthly)) });
    expect(screen.getByRole("alertdialog")).toHaveTextContent("monthly series with Caleb Bourg");
  });

  it("drops the with clause when the counterpart is unresolved", () => {
    renderDialog({ participantName: None });
    expect(screen.getByRole("alertdialog")).toHaveTextContent("weekly series from today onward");
  });

  it("renders nothing when no series is pending", () => {
    renderDialog({ series: None });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("Keep series calls onCancel", () => {
    const { onCancel } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Keep series" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("fires onConfirm and reflects the in-flight state", () => {
    const onConfirm = vi.fn();
    const { rerender } = render(
      <DeleteSeriesDialog series={Some(makeSeries())} participantName={Some("Caleb Bourg")} isDeleting={false} onCancel={vi.fn()} onConfirm={onConfirm} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel series" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    rerender(
      <DeleteSeriesDialog series={Some(makeSeries())} participantName={Some("Caleb Bourg")} isDeleting onCancel={vi.fn()} onConfirm={onConfirm} />
    );
    expect(screen.getByRole("button", { name: "Cancelling…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep series" })).toBeDisabled();
  });
});
