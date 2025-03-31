import { useState, forwardRef } from "react";
import { Calendar, Plus } from "lucide-react";
import { cn } from "@/components/lib/utils";

interface AddCoachingSessionButtonProps
  extends React.ComponentPropsWithoutRef<"button"> {
  disabled?: boolean;
  onClick?: () => void;
}

export const AddCoachingSessionButton = forwardRef<
  HTMLButtonElement,
  AddCoachingSessionButtonProps
>(({ className, disabled, onClick, ...props }, ref) => {
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
      disabled={disabled}
      className={cn(
        "flex items-center rounded-lg border border-border bg-card p-4 text-left",
        disabled
          ? "text-gray-300 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400"
          : "bg-card text-black hover:shadow-md transition-all dark:bg-gray-800 dark:text-white",
        className
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
      {!disabled && hoveredItem === "coaching" && (
        <Plus className="ml-auto h-6 w-6 text-primary" />
      )}
    </button>
  );
});

AddCoachingSessionButton.displayName = "AddCoachingSessionButton";
