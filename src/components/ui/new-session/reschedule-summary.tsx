"use client";

export function RescheduleSummary({ moves }: { moves: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">Rescheduling will</p>
      <p className="mt-2.5 text-item font-medium tabular-nums">{moves}</p>
    </div>
  );
}
