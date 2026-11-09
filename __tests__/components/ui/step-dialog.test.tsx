import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  StepDialog,
  StepDialogHeight,
  StepDialogVariant,
  type StepDialogLead,
  type StepRailItem,
} from "@/components/ui/step-dialog";
import { None, Some } from "@/types/option";

function viewport(desktop: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: desktop, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
}

afterEach(() => vi.unstubAllGlobals());

const STEPS: StepRailItem[] = [
  { id: "who", label: "Who", value: "Ehab Badawi", done: true, current: false },
  { id: "when", label: "When", value: "Tuesday, August 18, 2:30 PM", done: true, current: true },
  { id: "repeat", label: "Repeats", value: "Doesn't repeat", done: false, current: false },
];

function renderDialog(overrides: Partial<Parameters<typeof StepDialog>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    title: "New session",
    steps: STEPS,
    stepTitle: "When",
    position: { index: 2, total: 3 },
    lead: { kind: "none" } as StepDialogLead,
    onPrev: Some(vi.fn()),
    onNext: Some(vi.fn()),
    height: StepDialogHeight.Tall,
    variant: StepDialogVariant.Steps,
    children: <p>Step body</p>,
    ...overrides,
  };
  render(<StepDialog {...props} />);
  return props;
}

const confirm = (overrides: Partial<Extract<StepDialogLead, { kind: "confirm" }>> = {}): StepDialogLead => ({
  kind: "confirm",
  label: "Schedule session",
  disabled: false,
  pending: false,
  onConfirm: vi.fn(),
  ...overrides,
});

describe("StepDialog on desktop", () => {
  it("is a dialog named by its title, with the step title, subline and body", () => {
    viewport(true);
    renderDialog({ stepSubline: "Pick a day and time." });
    expect(screen.getByRole("dialog", { name: "New session" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "When" })).toBeInTheDocument();
    expect(screen.getByText("Pick a day and time.")).toBeInTheDocument();
    expect(screen.getByText("Step body")).toBeInTheDocument();
  });

  it("lists the steps in the rail and marks the current one", () => {
    viewport(true);
    renderDialog();
    const rail = screen.getByRole("list", { name: "Steps" });
    const rows = within(rail).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Who");
    expect(rows[0]).toHaveTextContent("Ehab Badawi");
    expect(rows[1]).toHaveAttribute("aria-current", "step");
    expect(rows[0]).not.toHaveAttribute("aria-current");
  });

  it("marks done rows, including a current one, with a check", () => {
    viewport(true);
    renderDialog();
    const rows = within(screen.getByRole("list", { name: "Steps" })).getAllByRole("listitem");
    expect(rows[0].querySelector("svg")).not.toBeNull();
    expect(rows[1].querySelector("svg")).not.toBeNull();
    expect(rows[2].querySelector("svg")).toBeNull();
  });

  it("renders the rail header and footer slots", () => {
    viewport(true);
    renderDialog({ railHeader: <p>Currently Tue, Aug 18</p>, railFooter: <p>Scheduling will create</p> });
    expect(screen.getByText("Currently Tue, Aug 18")).toBeInTheDocument();
    expect(screen.getByText("Scheduling will create")).toBeInTheDocument();
  });

  it("shows the position and steps with prev and next", () => {
    viewport(true);
    const props = renderDialog();
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(props.onPrev.some && props.onPrev.val).toHaveBeenCalled();
    expect(props.onNext.some && props.onNext.val).toHaveBeenCalled();
  });

  it("keeps prev and next, disabled, with no step that way", () => {
    viewport(true);
    renderDialog({ onPrev: None, onNext: None });
    expect(screen.getByRole("button", { name: "Previous step" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
  });

  it("shows no position, arrows or footer for a single view, even with arrows passed", () => {
    viewport(true);
    renderDialog({ variant: StepDialogVariant.Single, position: { index: 1, total: 1 }, lead: confirm() });
    expect(screen.queryByRole("button", { name: "Schedule session" })).not.toBeInTheDocument();
    expect(screen.queryByText("1 of 1")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous step" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next step" })).not.toBeInTheDocument();
  });

  it("keeps the position and arrows for a one-step flow", () => {
    viewport(true);
    renderDialog({ position: { index: 1, total: 1 }, onPrev: None, onNext: None });
    expect(screen.getByText("1 of 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
  });

  it("shows no position or arrows for a single view on a phone either", () => {
    viewport(false);
    renderDialog({ variant: StepDialogVariant.Single, position: { index: 1, total: 1 } });
    expect(screen.queryByText(/1 of 1/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous step" })).not.toBeInTheDocument();
  });

  it("confirms from the footer", () => {
    viewport(true);
    const lead = confirm();
    renderDialog({ lead });
    fireEvent.click(screen.getByRole("button", { name: "Schedule session" }));
    expect(lead.kind === "confirm" && lead.onConfirm).toHaveBeenCalled();
  });

  it("disables the confirm while disabled or pending", () => {
    viewport(true);
    renderDialog({ lead: confirm({ pending: true }) });
    expect(screen.getByRole("button", { name: "Schedule session" })).toBeDisabled();
  });

  it("shows a hint instead of a confirm", () => {
    viewport(true);
    renderDialog({ lead: { kind: "hint", text: "Pick a new time for Ehab, or keep both." } });
    expect(screen.getByText("Pick a new time for Ehab, or keep both.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Schedule session" })).not.toBeInTheDocument();
  });

  it("closes from the close button and Escape", () => {
    viewport(true);
    const props = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it("confirms on Enter when the confirm is enabled", () => {
    viewport(true);
    const lead = confirm();
    renderDialog({ lead });
    fireEvent.keyDown(screen.getByText("Step body"), { key: "Enter" });
    expect(lead.kind === "confirm" && lead.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("doesn't confirm on Enter while disabled or typing", () => {
    viewport(true);
    const disabled = confirm({ disabled: true });
    renderDialog({ lead: disabled, children: <input aria-label="Start time" /> });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });
    expect(disabled.kind === "confirm" && disabled.onConfirm).not.toHaveBeenCalled();
  });

  it("doesn't confirm on Enter from a text input", () => {
    viewport(true);
    const lead = confirm();
    renderDialog({ lead, children: <input aria-label="Start time" /> });
    fireEvent.keyDown(screen.getByLabelText("Start time"), { key: "Enter" });
    expect(lead.kind === "confirm" && lead.onConfirm).not.toHaveBeenCalled();
  });

  it("renders nothing when closed", () => {
    viewport(true);
    renderDialog({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("StepDialog below 900px", () => {
  it("is a full-screen step view with the title and position in the top bar", () => {
    viewport(false);
    renderDialog();
    expect(screen.getByRole("dialog", { name: "New session" })).toBeInTheDocument();
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "When" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Steps" })).not.toBeInTheDocument();
  });

  it("goes back with the circle and forward with a Next pill", () => {
    viewport(false);
    const props = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(props.onPrev.some && props.onPrev.val).toHaveBeenCalled();
    expect(props.onNext.some && props.onNext.val).toHaveBeenCalled();
  });

  it("keeps the back circle, disabled, on the first step", () => {
    viewport(false);
    renderDialog({ onPrev: None });
    expect(screen.getByRole("button", { name: "Previous step" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("puts the confirm in the footer on the last step", () => {
    viewport(false);
    const lead = confirm();
    renderDialog({ lead, onNext: None });
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Schedule session" }));
    expect(lead.kind === "confirm" && lead.onConfirm).toHaveBeenCalled();
  });

  it("keeps the rail header and footer content in the body", () => {
    viewport(false);
    renderDialog({ railHeader: <p>Currently Tue, Aug 18</p>, railFooter: <p>Scheduling will create</p> });
    expect(screen.getByText("Currently Tue, Aug 18")).toBeInTheDocument();
    expect(screen.getByText("Scheduling will create")).toBeInTheDocument();
  });

  it("closes from the top bar", () => {
    viewport(false);
    const props = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
