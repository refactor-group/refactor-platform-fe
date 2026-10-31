import { SessionRow } from "@/components/ui/join-session/session-row";
import type { MenuPerson, MenuSession } from "@/components/ui/join-session/types";
import type { Id } from "@/types/general";

interface TodayBlockProps {
  entries: { session: MenuSession; person: MenuPerson }[];
  onSelect: (id: Id) => void;
}

export function TodayBlock({ entries, onSelect }: TodayBlockProps) {
  if (entries.length === 0) return null;
  return (
    <>
      <section className="mx-2.5 mb-1 mt-2 rounded-xl border border-brand-border bg-hero-wash p-1.5">
        <div className="px-2.5 pb-1.5 pt-1 text-xs font-medium text-brand">Today</div>
        {entries.map(({ session, person }) => (
          <SessionRow
            key={session.id}
            variant="today"
            session={session}
            person={person}
            onSelect={onSelect}
          />
        ))}
      </section>
      <div className="my-1 h-px bg-hairline" />
    </>
  );
}
