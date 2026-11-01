import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Custom theme keys from tailwind.config.ts, so conflicts resolve correctly.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "page-title",
            "headline",
            "section",
            "card-title",
            "item",
            "label",
            "pill",
            "tiny",
          ],
        },
      ],
      rounded: [{ rounded: ["card", "popover", "input"] }],
      shadow: [{ shadow: ["card", "popover", "toast"] }],
      ease: [{ ease: ["spring"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
