"use client";

import { PersonPicker } from "@/components/ui/new-session/person-picker";
import { Skeleton } from "@/components/ui/skeleton";
import type { WhoModel } from "@/lib/new-session-dialog-model";

const SKELETON_CARDS = 4;

function WhoSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <Skeleton className="h-11 max-w-[360px] rounded-input motion-reduce:animate-none modal:h-10" />
      <div className="grid grid-cols-1 gap-2 modal:grid-cols-2">
        {Array.from({ length: SKELETON_CARDS }, (_, index) => (
          <div key={index} className="flex min-h-14 items-center gap-3 px-3 py-2.5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full motion-reduce:animate-none" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28 motion-reduce:animate-none" />
              <Skeleton className="h-3 w-36 motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WhoNote({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

export function WhoStep({ state, selectedId, onSelect }: WhoModel) {
  switch (state.kind) {
    case "loading":
      return <WhoSkeleton />;
    case "error":
      return <WhoNote text="Couldn't load the people you coach. Close and try again." />;
    case "empty":
      return <WhoNote text="You don't coach anyone in this organization yet." />;
    case "ready":
      return <PersonPicker people={state.people} selectedId={selectedId} onSelect={onSelect} />;
    default: {
      const _exhaustive: never = state;
      throw new Error(`Unhandled who state: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
