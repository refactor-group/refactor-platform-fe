"use client";

import { type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonCarousel } from "@/components/ui/join-session/person-carousel";
import { SessionDotStrip } from "@/components/ui/join-session/session-dot-strip";
import { SessionRow } from "@/components/ui/join-session/session-row";
import { TodayBlock } from "@/components/ui/join-session/today-block";
import type { MenuPerson, MenuSession } from "@/components/ui/join-session/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type JoinSessionMenuModel,
  type PersonSessionsState,
  useJoinSessionMenu,
} from "@/lib/hooks/use-join-session-menu";
import { shortDate } from "@/lib/session-window";
import { toast } from "@/lib/toast";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";

type OpenSession = (session: MenuSession, person: MenuPerson) => void;

function openedMessage(session: MenuSession, person: MenuPerson): string {
  return `Opened ${person.firstName} · ${shortDate(session.start)} · ${session.title}`;
}

function TriggerPill() {
  return (
    <PopoverTrigger asChild>
      <Button
        variant="secondary"
        size="sm"
        aria-label="Join session"
        className="px-2.5 data-[state=open]:bg-brand-tint sm:px-3.5"
      >
        <Video />
        <span className="hidden sm:inline">Join session</span>
        <ChevronDown />
      </Button>
    </PopoverTrigger>
  );
}

function LoadingRows() {
  return (
    <div aria-busy="true" aria-label="Loading sessions">
      {[0, 1, 2].map((n) => (
        <div key={n} className="flex min-h-11 items-center gap-2.5 px-2.5 py-[5px]">
          <Skeleton className="h-3.5 w-[72px]" />
          <Skeleton className="h-3.5 flex-1" />
        </div>
      ))}
    </div>
  );
}

function ErrorRow({ retry }: { retry: () => void }) {
  return (
    <div className="flex min-h-11 items-center gap-2 px-2.5 text-sm text-muted-foreground">
      Couldn&apos;t load sessions
      <Button variant="link" className="h-auto p-0 text-sm" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}

function EmptyRow({ person }: { person: MenuPerson }) {
  return (
    <p className="flex min-h-11 items-center px-2.5 text-sm text-muted-foreground">
      No sessions with {person.firstName} yet
    </p>
  );
}

type LoadedSessions = Extract<PersonSessionsState, { kind: "loaded" }>;

function findIn(state: LoadedSessions, id: Id): Option<MenuSession> {
  const found = [...state.list, ...state.groups.flatMap((g) => g.sessions)].find((s) => s.id === id);
  return found ? Some(found) : None;
}

interface LoadedSectionProps {
  state: LoadedSessions;
  current: JoinSessionMenuModel["current"];
  now: JoinSessionMenuModel["now"];
  onOpen: OpenSession;
}

function LoadedSection({ state, current, now, onOpen }: LoadedSectionProps) {
  const select = (id: Id) => {
    const session = findIn(state, id);
    if (session.some) onOpen(session.val, state.person);
  };
  if (state.list.length === 0 && state.groups.length === 0) {
    return <EmptyRow person={state.person} />;
  }
  return (
    <>
      <SessionDotStrip
        personName={state.person.fullName}
        groups={state.groups}
        kindOf={state.kindOf}
        onSelect={select}
      />
      {state.list.map((session) => (
        <SessionRow
          key={session.id}
          variant="list"
          session={session}
          isCurrent={current.some && current.val === session.id}
          now={now}
          onSelect={select}
        />
      ))}
    </>
  );
}

function PersonSection({ menu, onOpen }: { menu: JoinSessionMenuModel; onOpen: OpenSession }) {
  const { sessions } = menu;
  switch (sessions.kind) {
    case "no-people":
      return null;
    case "loading":
      return <Section><LoadingRows /></Section>;
    case "error":
      return <Section><ErrorRow retry={sessions.retry} /></Section>;
    case "loaded":
      return (
        <Section>
          <LoadedSection state={sessions} current={menu.current} now={menu.now} onOpen={onOpen} />
        </Section>
      );
    default: {
      const _exhaustive: never = sessions;
      throw new Error(`Unhandled sessions state: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function Section({ children }: { children: ReactNode }) {
  return <section className="px-1.5 pb-2.5 pt-1.5">{children}</section>;
}

function MenuBody({ menu, onOpen }: { menu: JoinSessionMenuModel; onOpen: OpenSession }) {
  const openToday = (id: Id) => {
    const entry = menu.today.find((e) => e.session.id === id);
    if (entry) onOpen(entry.session, entry.person);
  };
  return (
    <div className="min-h-0 overflow-y-auto">
      <TodayBlock entries={menu.today} onSelect={openToday} />
      {menu.selectedId.some && (
        <PersonCarousel
          people={menu.people}
          selectedId={menu.selectedId.val}
          page={menu.page}
          onPageChange={menu.setPage}
          onSelect={menu.selectPerson}
        />
      )}
      <PersonSection menu={menu} onOpen={onOpen} />
    </div>
  );
}

export function JoinSessionMenu() {
  const [open, setOpen] = useState(false);
  const menu = useJoinSessionMenu();
  const router = useRouter();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) menu.reset();
  };

  const openSession: OpenSession = (session, person) => {
    setOpen(false);
    router.push(`/coaching-sessions/${session.id}`);
    toast.success(openedMessage(session, person));
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <TriggerPill />
      <PopoverContent
        align="end"
        collisionPadding={16}
        aria-label="Join session"
        className="flex max-h-[min(600px,80vh)] w-[420px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-popover p-0 shadow-popover"
      >
        <MenuBody menu={menu} onOpen={openSession} />
      </PopoverContent>
    </Popover>
  );
}
