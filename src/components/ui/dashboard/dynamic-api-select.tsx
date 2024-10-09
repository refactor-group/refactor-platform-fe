import React, { useState } from "react";
import { useApiData } from "@/hooks/use-api-data";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CoachingSession, isCoachingSession } from "@/types/coaching-session";
import { DateTime } from "ts-luxon";

interface DynamicApiSelectProps<T> {
  url: string;
  method?: "GET" | "POST";
  params?: Record<string, any>;
  onChange: (value: string) => void;
  placeholder?: string;
  getOptionLabel: (item: T) => string;
  getOptionValue: (item: T) => string;
  elementId: string;
  groupByDate?: boolean;
}

interface ApiResponse<T> {
  status_code: number;
  data: T[];
}

export function DynamicApiSelect<T>({
  url,
  method = "GET",
  params = {},
  onChange,
  placeholder = "Select an option",
  getOptionLabel,
  getOptionValue,
  elementId,
  groupByDate = false,
}: DynamicApiSelectProps<T>) {
  const {
    data: response,
    isLoading,
    error,
  } = useApiData<ApiResponse<T>>(url, { method, params });
  const [value, setValue] = useState<string>("");

  const handleValueChange = (newValue: string) => {
    setValue(newValue);
    onChange(newValue);
  };

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (!response || response.status_code !== 200)
    return <p>Error: Invalid response</p>;

  const items = response.data;

  const renderSessions = (
    sessions: CoachingSession[],
    label: string,
    filterFn: (session: CoachingSession) => boolean
  ) => {
    const filteredSessions = sessions.filter(filterFn);
    return (
      filteredSessions.length > 0 && (
        <SelectGroup>
          <SelectLabel>{label}</SelectLabel>
          {filteredSessions.map((session) => (
            <SelectItem value={session.id} key={session.id}>
              {DateTime.fromISO(session.date.toString()).toLocaleString(
                DateTime.DATETIME_FULL
              )}
            </SelectItem>
          ))}
        </SelectGroup>
      )
    );
  };

  const renderCoachingSessions = (sessions: CoachingSession[]) => (
    <SelectContent>
      {sessions.length === 0 ? (
        <SelectItem disabled value="none">
          None found
        </SelectItem>
      ) : (
        <>
          {renderSessions(
            sessions,
            "Previous Sessions",
            (session) =>
              DateTime.fromISO(session.date.toString()) < DateTime.now()
          )}
          {renderSessions(
            sessions,
            "Upcoming Sessions",
            (session) =>
              DateTime.fromISO(session.date.toString()) >= DateTime.now()
          )}
        </>
      )}
    </SelectContent>
  );

  const renderOtherItems = (items: T[]) => (
    <SelectContent>
      {items.length === 0 ? (
        <SelectItem disabled value="none">
          None found
        </SelectItem>
      ) : (
        items.map((item, index) => (
          <SelectItem key={index} value={getOptionValue(item)}>
            {getOptionLabel(item)}
          </SelectItem>
        ))
      )}
    </SelectContent>
  );

  const coachingSessions = groupByDate
    ? (items.filter(isCoachingSession) as CoachingSession[])
    : [];

  return (
    <Select value={value} onValueChange={handleValueChange}>
      <SelectTrigger id={elementId}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      {groupByDate && coachingSessions.length > 0
        ? renderCoachingSessions(coachingSessions)
        : renderOtherItems(items)}
    </Select>
  );
}
