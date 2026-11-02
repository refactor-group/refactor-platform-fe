import { DateTime } from "ts-luxon";
import { cn } from "@/components/lib/utils";
import {
  formatStatusMeta,
  statusMeta,
  statusMetaClass,
  type StatusMetaInput,
} from "@/components/ui/status/status-meta";

interface StatusMetaLineProps extends StatusMetaInput {
  locale: string;
  className?: string;
}

/** "Due Aug 20", "Done Aug 15", "Paused · was due Aug 18" or "Closed Aug 13"; nothing for an open, undated item. */
export function StatusMetaLine({ locale, className, ...input }: StatusMetaLineProps) {
  const meta = statusMeta(input, DateTime.now());
  const text = formatStatusMeta(meta, locale);
  if (text.none) return null;
  return (
    <span
      data-meta={meta.kind}
      className={cn("text-xs tabular-nums", statusMetaClass(meta), className)}
    >
      {text.val}
    </span>
  );
}
