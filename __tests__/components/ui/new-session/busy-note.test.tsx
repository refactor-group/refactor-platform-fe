import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BusyNote } from "@/components/ui/new-session/busy-note";
import { None, Some } from "@/types/option";
import { EHAB, PRIYA, at } from "./fixtures";

const TUESDAY = at("2026-08-18T00:00");

describe("BusyNote", () => {
  it("says when the day is free", () => {
    render(<BusyNote day={TUESDAY} sessions={[]} clash={None} onUseInstead={vi.fn()} />);
    expect(screen.getByText("Nothing else on Tuesday, August 18.")).toBeInTheDocument();
  });

  it("lists the day's sessions under a header", () => {
    render(<BusyNote day={TUESDAY} sessions={[EHAB, PRIYA]} clash={None} onUseInstead={vi.fn()} />);
    expect(screen.getByText("Already on Tuesday, August 18")).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Ehab Badawi");
    expect(rows[0]).toHaveTextContent("2:30 PM–3:20 PM");
    expect(rows[1]).toHaveTextContent("Priya Raman");
  });

  it("swaps to the overlap and offers the free time", () => {
    const onUseInstead = vi.fn();
    const instead = at("2026-08-18T15:30");
    render(
      <BusyNote
        day={TUESDAY}
        sessions={[EHAB, PRIYA]}
        clash={Some({ session: EHAB, instead: Some(instead) })}
        onUseInstead={onUseInstead}
      />
    );
    expect(screen.getByText(/Overlaps with Ehab, 2:30–3:20 PM/)).toBeInTheDocument();
    expect(screen.queryByText("Already on Tuesday, August 18")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use 3:30 PM instead" }));
    expect(onUseInstead).toHaveBeenCalledWith(instead);
  });

  it("names the overlap alone when nothing is free", () => {
    render(
      <BusyNote day={TUESDAY} sessions={[EHAB]} clash={Some({ session: EHAB, instead: None })} onUseInstead={vi.fn()} />
    );
    expect(screen.getByText(/Overlaps with Ehab, 2:30–3:20 PM/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
