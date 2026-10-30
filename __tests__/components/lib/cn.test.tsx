import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";

const classesOf = (value: string) => value.split(/\s+/);

describe("cn", () => {
  describe("custom font sizes", () => {
    it("keeps a custom size alongside a text colour", () => {
      expect(classesOf(cn("text-item", "text-primary-foreground"))).toEqual(
        expect.arrayContaining(["text-item", "text-primary-foreground"])
      );
    });

    it("treats custom sizes as conflicting with built-in sizes", () => {
      expect(cn("text-sm", "text-item")).toBe("text-item");
      expect(cn("text-item", "text-sm")).toBe("text-sm");
    });

    it("keeps a pill size alongside a brand colour", () => {
      expect(
        classesOf(cn("text-pill font-medium bg-brand-tint text-brand-strong"))
      ).toEqual(expect.arrayContaining(["text-pill", "text-brand-strong"]));
    });
  });

  it("merges custom radii with built-in radii", () => {
    expect(cn("rounded-lg", "rounded-card")).toBe("rounded-card");
    expect(cn("rounded-card", "rounded-lg")).toBe("rounded-lg");
    expect(cn("rounded-sm", "rounded-input")).toBe("rounded-input");
  });

  it("merges custom shadows with built-in shadows", () => {
    expect(cn("shadow-card", "shadow-none")).toBe("shadow-none");
    expect(cn("shadow-sm", "shadow-popover")).toBe("shadow-popover");
  });

  it("merges the spring easing with built-in easings", () => {
    expect(cn("ease-in-out", "ease-spring")).toBe("ease-spring");
  });
});

describe("Button classes", () => {
  it("keeps the item size with the default variant colour", () => {
    render(<Button>Go</Button>);
    expect(classesOf(screen.getByRole("button").className)).toEqual(
      expect.arrayContaining(["text-item", "text-primary-foreground"])
    );
  });

  it("keeps the item size with the secondary variant colour", () => {
    render(<Button variant="secondary">Go</Button>);
    expect(classesOf(screen.getByRole("button").className)).toEqual(
      expect.arrayContaining(["text-item", "text-foreground"])
    );
  });
});
