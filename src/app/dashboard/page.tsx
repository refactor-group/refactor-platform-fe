import type { Metadata } from "next";
import type * as React from "react";
import { cn } from "@/components/lib/utils";
import SelectCoachingRelationship from "@/components/ui/dashboard/select-coaching-relationship";
import CoachingSessionList from "@/components/ui/dashboard/coaching-session-list";
import AddEntities from "@/components/ui/dashboard/add-entities";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Coaching dashboard",
};

function DashboardContainer({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Base styles
        "p-4",
        // Mobile: stack vertically
        "flex flex-col gap-6",
        // Tablet and up (640px+): side by side
        "sm:grid sm:grid-cols-2",
        // Never grow wider than the site-header
        "max-w-screen-2xl",
        // Ensure full width for children
        "[&>*]:w-full",
        className
      )}
      {...props}
    />
  );
}

export default function DashboardPage() {
  return (
    <>
      <div className="p-4 max-w-screen-2xl">
        <div className="mb-8 w-full">
          <AddEntities />
        </div>
      </div>
      <DashboardContainer>
        <SelectCoachingRelationship />
        <CoachingSessionList />
      </DashboardContainer>
    </>
  );
}
