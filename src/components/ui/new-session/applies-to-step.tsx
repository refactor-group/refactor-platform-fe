"use client";

import { RadioCardItem, RadioGroup } from "@/components/ui/radio-group";
import type { AppliesToModel } from "@/lib/new-session-dialog-model";
import { MoveScope } from "@/lib/scheduling";
import { moveScopeTitle } from "@/lib/scheduling-copy";

const CHOICES: { scope: MoveScope; description: string }[] = [
  { scope: MoveScope.This, description: "The rest of the series stays where it is." },
  { scope: MoveScope.Following, description: "Future sessions move to the new weekday and time." },
];

function scopeOf(value: string): MoveScope {
  return value === MoveScope.Following ? MoveScope.Following : MoveScope.This;
}

export function AppliesToStep({ scope, onScopeChange }: AppliesToModel) {
  return (
    <RadioGroup aria-label="Applies to" value={scope} onValueChange={(value) => onScopeChange(scopeOf(value))} className="gap-2.5">
      {CHOICES.map((choice) => (
        <RadioCardItem
          key={choice.scope}
          value={choice.scope}
          title={moveScopeTitle(choice.scope)}
          description={choice.description}
        />
      ))}
    </RadioGroup>
  );
}
