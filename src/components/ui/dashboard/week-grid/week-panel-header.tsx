import type { Option } from "@/types/option";

export interface WeekPanelHeaderProps {
  titleId: string;
  title: string;
  range: string;
  subline: Option<string>;
}

export function WeekPanelHeader({ titleId, title, range, subline }: WeekPanelHeaderProps) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 id={titleId} className="text-section font-normal">
          {title}
        </h2>
        <span className="text-card-title tabular-nums text-ink-2">{range}</span>
      </div>
      {subline.some && (
        <p className="mt-1 text-sm tabular-nums text-muted-foreground">{subline.val}</p>
      )}
    </div>
  );
}
