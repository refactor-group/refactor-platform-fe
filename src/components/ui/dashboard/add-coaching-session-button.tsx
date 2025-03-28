import { useState, forwardRef } from "react";
import { Calendar, Plus } from "lucide-react";
import { cn } from "@/components/lib/utils";

interface AddCoachingSessionButtonProps
  extends React.ComponentPropsWithoutRef<"button"> {
  onClick?: () => void;
}

export const AddCoachingSessionButton = forwardRef<
  HTMLButtonElement,
  AddCoachingSessionButtonProps
>(({ className, onClick, ...props }, ref) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const handleMouseEnter = (item: string) => {
    setHoveredItem(item);
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
  };

  return (
    <button
      ref={ref}
      className={cn(
        "flex items-center rounded-lg border border-border bg-card p-4 text-left transition-all hover:shadow-md",
        hoveredItem === "coaching" && "shadow-md",
        className // Merges passed className with existing classes
      )}
      onMouseEnter={() => handleMouseEnter("coaching")}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      {...props} // Spread remaining props
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-md bg-primary/10">
        <Calendar className="h-8 w-8 text-primary" />
      </div>
      <span className="ml-4 text-lg font-medium">Coaching Session</span>
      {hoveredItem === "coaching" && (
        <Plus className="ml-auto h-6 w-6 text-primary" />
      )}
    </button>
  );
});

AddCoachingSessionButton.displayName = "AddCoachingSessionButton";
