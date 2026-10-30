import { describe, expect, it } from "vitest";
import { buttonVariants } from "@/components/ui/button";

const VARIANTS = [
  "default",
  "destructive",
  "outline",
  "secondary",
  "ghost",
  "link",
] as const;
const SIZES = [
  "default",
  "sm",
  "lg",
  "xl",
  "icon",
  "icon-sm",
  "icon-menu",
] as const;

describe("buttonVariants", () => {
  it("defaults to an indigo pill", () => {
    const classes = buttonVariants();
    expect(classes).toContain("rounded-full");
    expect(classes).toContain("bg-primary");
    expect(classes).toContain("h-10");
  });

  it("maps sizes to heights", () => {
    expect(buttonVariants({ size: "sm" })).toContain("h-9");
    expect(buttonVariants({ size: "lg" })).toContain("h-11");
    expect(buttonVariants({ size: "xl" })).toContain("h-12");
    expect(buttonVariants({ size: "icon" })).toContain("h-10");
    expect(buttonVariants({ size: "icon" })).toContain("w-10");
    expect(buttonVariants({ size: "icon-menu" })).toContain("h-7");
    expect(buttonVariants({ size: "icon-menu" })).toContain("w-7");
  });

  it("styles secondary and outline variants", () => {
    expect(buttonVariants({ variant: "secondary" })).toContain("bg-fill");
    expect(buttonVariants({ variant: "outline" })).toContain("border-input");
  });

  it("dims secondary icon buttons only", () => {
    expect(buttonVariants({ variant: "secondary", size: "icon" })).toContain(
      "text-ink-2"
    );
    expect(buttonVariants({ variant: "secondary" })).not.toContain(
      "text-ink-2"
    );
  });

  it("gives ghost menu buttons a disabled icon tone", () => {
    expect(buttonVariants({ variant: "ghost", size: "icon-menu" })).toContain(
      "disabled:text-disabled-icon"
    );
  });

  it("never emits rounded-md", () => {
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        expect(buttonVariants({ variant, size })).not.toContain("rounded-md");
      }
    }
  });
});
