import { cn } from "@/components/lib/utils";
import type { DotKind } from "@/components/ui/join-session/types";

interface SessionDotProps {
  kind: DotKind;
  label: string;
  onSelect: () => void;
  onPreview: (showing: boolean) => void;
}

function dotClasses(kind: DotKind): string {
  switch (kind) {
    case "past":
      return "h-[9px] w-[9px] bg-brand-dot";
    case "upcoming":
      return "h-[9px] w-[9px] border-2 border-brand bg-card";
    case "today":
      return "h-[11px] w-[11px] bg-primary shadow-[0_0_0_3px_hsl(var(--brand-tint-2))]";
    case "current":
      return "h-3 w-3 bg-primary";
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unhandled dot kind: ${_exhaustive}`);
    }
  }
}

export function SessionDot({ kind, label, onSelect, onPreview }: SessionDotProps) {
  const show = () => onPreview(true);
  const hide = () => onPreview(false);
  return (
    <button
      type="button"
      aria-label={label}
      data-kind={kind}
      onClick={onSelect}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="group flex h-5 w-4 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden
        className={cn(
          "rounded-full origin-bottom transition-transform duration-[180ms] ease-spring group-hover:scale-[1.8] group-focus-visible:scale-[1.8] motion-reduce:transition-none",
          dotClasses(kind)
        )}
      />
    </button>
  );
}
