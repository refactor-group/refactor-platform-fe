"use client";

import { MoveHeader } from "@/components/ui/new-session/move-header";
import { RepeatStep } from "@/components/ui/new-session/repeat-step";
import { ResolveStep } from "@/components/ui/new-session/resolve-step";
import { ScheduleSummary } from "@/components/ui/new-session/schedule-summary";
import { WhenStep } from "@/components/ui/new-session/when-step";
import { WhoStep } from "@/components/ui/new-session/who-step";
import { StepDialog, StepDialogHeight } from "@/components/ui/step-dialog";
import { useNewSessionDialog } from "@/lib/hooks/use-new-session-dialog";
import type { NewSessionDialogModel } from "@/lib/new-session-dialog-model";
import { StepKind } from "@/lib/scheduling";
import type { NewSessionRequest } from "@/lib/stores/new-session-dialog-store";
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
    case StepKind.AppliesTo:
      throw new Error("Applies to isn't a step yet");
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
  const model = useNewSessionDialog(request, onClose);
  const content = stepContent(model);
  return (
    <StepDialog
      open
      onClose={onClose}
      title={model.title}
      height={StepDialogHeight.Tall}
      railHeader={model.mover.some ? <MoveHeader {...model.mover.val} /> : undefined}
      steps={model.rail}
      railFooter={model.summary.some ? <ScheduleSummary {...model.summary.val} /> : undefined}
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
