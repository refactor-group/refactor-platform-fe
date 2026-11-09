"use client";

import { AppliesToStep } from "@/components/ui/new-session/applies-to-step";
import { RepeatStep } from "@/components/ui/new-session/repeat-step";
import { ResolveStep } from "@/components/ui/new-session/resolve-step";
import { RescheduleSummary } from "@/components/ui/new-session/reschedule-summary";
import { ScheduleSummary } from "@/components/ui/new-session/schedule-summary";
import { WhenStep } from "@/components/ui/new-session/when-step";
import { WhoStep } from "@/components/ui/new-session/who-step";
import { PersonHeader } from "@/components/ui/person-header";
import { StepDialog, StepDialogHeight, StepDialogVariant } from "@/components/ui/step-dialog";
import { useNewSessionDialog } from "@/lib/hooks/use-new-session-dialog";
import { NO_SERIES, type SeriesLoad, useLoadedSeries } from "@/lib/hooks/use-schedule-data";
import type { MoverModel, NewSessionDialogModel } from "@/lib/new-session-dialog-model";
import { StepKind } from "@/lib/scheduling";
import type { NewSessionRequest } from "@/lib/stores/new-session-dialog-store";
import type { Id } from "@/types/general";
import { None, Some } from "@/types/option";
import type { ReactNode } from "react";

interface StepContent {
  title: string;
  subline?: string;
  body: ReactNode;
}

function stepContent(model: NewSessionDialogModel): StepContent {
  switch (model.step) {
    case StepKind.Who:
      return { title: "Who this session is with", body: <WhoStep {...model.who} /> };
    case StepKind.When:
      return { title: "When", body: <WhenStep {...model.when} /> };
    case StepKind.Repeat:
      return { title: "Repeat", body: <RepeatStep {...model.repeat} /> };
    case StepKind.Resolve:
      return model.resolve.some
        ? { title: "Resolve overlap", subline: model.resolve.val.subline, body: <ResolveStep {...model.resolve.val} /> }
        : { title: "Resolve overlap", body: null };
    case StepKind.AppliesTo: {
      const { subline } = model.appliesTo;
      return {
        title: "Applies to",
        subline: subline.some ? subline.val : undefined,
        body: <AppliesToStep {...model.appliesTo} />,
      };
    }
    default: {
      const _exhaustive: never = model.step;
      throw new Error(`Unhandled step: ${_exhaustive}`);
    }
  }
}

interface NewSessionDialogProps {
  request: NewSessionRequest;
  onClose: () => void;
}

export function NewSessionDialog({ request, onClose }: NewSessionDialogProps) {
  const seriesId = request.kind === "move" ? request.session.coaching_session_series_id : None;
  return seriesId.some ? (
    <SeriesSessionDialog seriesId={seriesId.val} request={request} onClose={onClose} />
  ) : (
    <NewSessionDialogView request={request} series={NO_SERIES} onClose={onClose} />
  );
}

/** Mounted only for a session in a series, so a one-off never fetches one. */
function SeriesSessionDialog({ seriesId, ...props }: NewSessionDialogProps & { seriesId: Id }) {
  const series = useLoadedSeries(seriesId);
  return <NewSessionDialogView {...props} series={series} />;
}

function railFooter({ summary, moves }: NewSessionDialogModel) {
  if (summary.some) return <ScheduleSummary {...summary.val} />;
  if (moves.some) return <RescheduleSummary moves={moves.val} />;
  return undefined;
}

function MoverHeader({ currently, ...person }: MoverModel) {
  return <PersonHeader {...person} detail={Some(currently)} />;
}

function NewSessionDialogView({
  request,
  series,
  onClose,
}: NewSessionDialogProps & { series: SeriesLoad }) {
  const model = useNewSessionDialog(request, series, onClose);
  const content = stepContent(model);
  return (
    <StepDialog
      open
      onClose={onClose}
      title={model.title}
      height={StepDialogHeight.Tall}
      variant={StepDialogVariant.Steps}
      railHeader={model.mover.some ? <MoverHeader {...model.mover.val} /> : undefined}
      steps={model.rail}
      railFooter={railFooter(model)}
      stepTitle={content.title}
      stepSubline={content.subline}
      lead={model.lead}
      position={model.position}
      onPrev={model.onPrev}
      onNext={model.onNext}
    >
      {content.body}
    </StepDialog>
  );
}
