import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ProgressRing } from "@/components/ui/dashboard/progress-ring";

describe("ProgressRing", () => {
  it("renders the percentage text", () => {
    render(<ProgressRing percent={75} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("renders 0% correctly", () => {
    render(<ProgressRing percent={0} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("renders 100% correctly", () => {
    render(<ProgressRing percent={100} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders two circle elements (track and fill)", () => {
    const { container } = render(<ProgressRing percent={50} />);
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(2);
  });

  it("computes correct stroke-dashoffset for the fill circle", () => {
    const size = 48;
    const strokeWidth = 3.5;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const expectedOffset = circumference - (50 / 100) * circumference;

    const { container } = render(<ProgressRing percent={50} />);
    const fillCircle = container.querySelectorAll("circle")[1];
    expect(fillCircle).toHaveAttribute(
      "stroke-dashoffset",
      String(expectedOffset)
    );
  });

  it("uses the default size of 48", () => {
    const { container } = render(<ProgressRing percent={25} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "48");
    expect(svg).toHaveAttribute("height", "48");
  });

  it("respects a custom size prop", () => {
    const { container } = render(<ProgressRing percent={25} size={64} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "64");
    expect(svg).toHaveAttribute("height", "64");
  });
});
