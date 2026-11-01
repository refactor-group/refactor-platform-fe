import { cn } from "@/components/lib/utils";
import { ItemStatus, actionStatusToString } from "@/types/general";

interface StatusGlyphProps {
  status: ItemStatus;
  className?: string;
  decorative?: boolean;
}

function GlyphShapes({ status }: { status: ItemStatus }) {
  switch (status) {
    case ItemStatus.NotStarted:
      return (
        <circle cx={10} cy={10} r={8} className="fill-none stroke-status-idle" />
      );
    case ItemStatus.InProgress:
      return (
        <>
          <circle cx={10} cy={10} r={8} className="fill-none stroke-brand" />
          <path d="M10 4 A6 6 0 0 1 10 16 Z" className="fill-brand" />
        </>
      );
    case ItemStatus.OnHold:
      return (
        <>
          <circle
            cx={10}
            cy={10}
            r={8}
            className="fill-on-hold-fill stroke-on-hold-ring"
          />
          <path d="M8 7v6M12 7v6" className="stroke-on-hold-text" />
        </>
      );
    case ItemStatus.Completed:
      return (
        <>
          <circle cx={10} cy={10} r={9} className="fill-positive-solid" />
          <path
            d="M6 10.5l2.6 2.5L14 7.5"
            className="fill-none stroke-white"
            strokeWidth={1.8}
          />
        </>
      );
    case ItemStatus.WontDo:
      return (
        <>
          <circle cx={10} cy={10} r={9} className="fill-faint" />
          <path d="M7 7l6 6M13 7l-6 6" className="stroke-white" strokeWidth={1.8} />
        </>
      );
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}

export function StatusGlyph({
  status,
  className,
  decorative = false,
}: StatusGlyphProps) {
  const a11y = decorative
    ? { "aria-hidden": true }
    : { role: "img", "aria-label": actionStatusToString(status) };
  return (
    <svg
      viewBox="0 0 20 20"
      {...a11y}
      data-status={status}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-5 shrink-0", className)}
    >
      <GlyphShapes status={status} />
    </svg>
  );
}
