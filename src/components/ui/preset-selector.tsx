"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";
import { PopoverProps } from "@radix-ui/react-popover";

import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Preset } from "../../data/presets";

interface PresetSelectorProps extends PopoverProps {
  current: Preset[];
  future: Preset[];
  past: Preset[];
}

export function PresetSelector({
  current,
  future,
  past,
  ...props
}: PresetSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedPreset, setSelectedPreset] = React.useState<Preset>();
  const router = useRouter();

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label="Select a coaching session"
          aria-expanded={open}
          className="flex-1 justify-between md:max-w-[200px] lg:max-w-[300px]"
        >
          {selectedPreset
            ? selectedPreset.date_time
            : "Select a coaching session"}
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search for coaching sessions" />
          <CommandEmpty>No sessions found.</CommandEmpty>
          <CommandGroup heading="Current session">
            {current.map((current) => (
              <CommandItem
                key={current.id}
                onSelect={() => {
                  setSelectedPreset(current);
                  setOpen(false);
                }}
              >
                {current.date_time}
                <CheckIcon
                  className={cn(
                    "ml-auto h-4 w-4",
                    selectedPreset?.id === current.id
                      ? "opacity-100"
                      : "opacity-0"
                  )}
                />
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Future sessions">
            {future.map((future) => (
              <CommandItem
                key={future.id}
                onSelect={() => {
                  setSelectedPreset(future);
                  setOpen(false);
                }}
              >
                {future.date_time}
                <CheckIcon
                  className={cn(
                    "ml-auto h-4 w-4",
                    selectedPreset?.id === future.id
                      ? "opacity-100"
                      : "opacity-0"
                  )}
                />
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Past sessions">
            {past.map((past) => (
              <CommandItem
                key={past.id}
                onSelect={() => {
                  setSelectedPreset(past);
                  setOpen(false);
                }}
              >
                {past.date_time}
                <CheckIcon
                  className={cn(
                    "ml-auto h-4 w-4",
                    selectedPreset?.id === past.id ? "opacity-100" : "opacity-0"
                  )}
                />
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup className="pt-0">
            <CommandItem onSelect={() => router.push("/examples")}>
              More past sessions
            </CommandItem>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
