import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CardError } from "@/components/ui/errors/card-error";
import { Some, None } from "@/types/option";

describe("CardError", () => {
  it("renders the title as an alert", () => {
    render(<CardError title="Couldn't load your goals" retry={None} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /^Couldn't load your goals$/
    );
  });

  it("calls retry once when Try again is clicked", async () => {
    const retry = vi.fn();
    render(<CardError title="Oops" retry={Some(retry)} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("hides Try again when retry is None", () => {
    render(<CardError title="Oops" retry={None} />);
    expect(
      screen.queryByRole("button", { name: "Try again" })
    ).not.toBeInTheDocument();
  });

  it("renders a decorative alert icon in an error-tinted badge", () => {
    const { container } = render(<CardError title="Oops" retry={None} />);
    const svg = container.querySelector("svg[aria-hidden]");
    expect(svg).not.toBeNull();
    const badge = svg?.parentElement;
    expect(badge).toHaveClass("bg-error-tint", "text-error");
  });
});
