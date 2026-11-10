import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/chip";
import type { Option } from "@/types/option";
import { WeekFilter, type WeekFilterProps } from "./week-filter";

export interface WeekNavigation {
  canGoEarlier: boolean;
  canGoLater: boolean;
  isCurrentWeek: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onThisWeek: () => void;
}

export interface WeekPanelHeaderProps {
  titleId: string;
  title: string;
  range: string;
  subline: Option<string>;
  navigation: WeekNavigation;
  filter: Option<WeekFilterProps>;
  onSchedule: Option<() => void>;
  /** The server can't be reached, so Schedule session stays visible but disabled. */
  readOnly: boolean;
}

export function WeekPanelHeader({
  titleId,
  title,
  range,
  subline,
  navigation,
  filter,
  onSchedule,
  readOnly,
}: WeekPanelHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      <div>
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 id={titleId} className="text-section font-normal">
            {title}
          </h2>
          <span className="text-card-title tabular-nums text-ink-2">{range}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 empty:hidden">
          {subline.some && <p className="text-sm tabular-nums text-muted-foreground">{subline.val}</p>}
          {filter.some && filter.val.selected.some && (
            <FilterChip label={filter.val.selected.val.fullName} onClear={filter.val.onClear} />
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {filter.some && <WeekFilter {...filter.val} />}
        <WeekNavigationControls navigation={navigation} />
        {onSchedule.some && (
          <Button
            size="sm"
            className="bg-brand px-4 text-[13px] hover:bg-brand/90"
            disabled={readOnly}
            onClick={onSchedule.val}
          >
            <Plus aria-hidden />
            Schedule session
          </Button>
        )}
      </div>
    </div>
  );
}

const ARROW_CLASS = "[&_svg]:size-[15px]";

function WeekNavigationControls({ navigation }: { navigation: WeekNavigation }) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="icon-sm"
        className={ARROW_CLASS}
        aria-label="Previous week"
        disabled={!navigation.canGoEarlier}
        onClick={navigation.onPrevious}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <Button
        variant="secondary"
        size="sm"
        className="hidden text-[13px] disabled:text-faint disabled:opacity-100 lg:inline-flex"
        disabled={navigation.isCurrentWeek}
        onClick={navigation.onThisWeek}
      >
        This week
      </Button>
      <Button
        variant="secondary"
        size="icon-sm"
        className={ARROW_CLASS}
        aria-label="Next week"
        disabled={!navigation.canGoLater}
        onClick={navigation.onNext}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}
