"use client";

import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getTimezones } from "@/lib/timezone-utils";

interface TimezoneSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function TimezoneSelector({
  value,
  onValueChange,
  placeholder = "Select time zone",
  className,
}: TimezoneSelectorProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Memoize the timezones so they're only computed once per component lifecycle
  const timezones = useMemo(() => {
    const tz = getTimezones();
    setIsLoading(false);
    return tz;
  }, []);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue
          placeholder={isLoading ? "Loading timezones..." : placeholder}
        />
      </SelectTrigger>
      <SelectContent>
        {isLoading ? (
          <SelectItem value="" disabled>
            Loading timezones...
          </SelectItem>
        ) : (
          timezones.map((tz) => (
            <SelectItem key={tz.value} value={tz.value}>
              {tz.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
