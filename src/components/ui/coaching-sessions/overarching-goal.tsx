"use client";

import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import { cn } from "@/components/lib/utils";
import {
  defaultOverarchingGoal,
  OverarchingGoal,
} from "@/types/overarching-goal";

const OverarchingGoalComponent: React.FC<{
  initialValue: OverarchingGoal;
  onOpenChange: (open: boolean) => void;
  onGoalChange: (goal: OverarchingGoal) => void;
}> = ({ initialValue, onOpenChange, onGoalChange }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [tempGoalTitle, setTempGoalTitle] = useState<string>("");
  const [overarchingGoal, setOverarchingGoal] = useState<OverarchingGoal>(
    defaultOverarchingGoal()
  );

  useEffect(() => {
    setOverarchingGoal(initialValue);
    setTempGoalTitle(initialValue.title);
  }, [initialValue]);

  const toggleDrawer = () => {
    onOpenChange(!isOpen);
    setIsOpen(!isOpen);
  };

  const handleSetGoal = async () => {
    var tempGoal = overarchingGoal;
    tempGoal.title = tempGoalTitle;
    setOverarchingGoal(tempGoal);
    onGoalChange(tempGoal);
    toggleDrawer();
  };

  return (
    <div className="flex items-center justify-between px-4">
      <div
        className={cn(
          "relative h-8 w-full justify-start rounded-[0.5rem] bg-muted hover:bg-gray-200 text-sm font-semibold text-muted-foreground shadow-inner flex items-center pl-0 pr-2"
        )}
        onClick={toggleDrawer}
      >
        <div className="flex items-center justify-between w-full">
          <div id="label" className="flex w-full mr-2 min-w-0">
            {isOpen ? (
              <Input
                value={tempGoalTitle}
                onChange={(e) => setTempGoalTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetGoal()}
                onClick={(e) => e.stopPropagation()} // Ensure clicking the input component does not call toggleDrawer
                className={cn("w-full h-6 bg-inherit border-0 px-2 py-1")}
                placeholder="Insert a new overarching goal"
              />
            ) : (
              /* Ensure that clicking the overarching goal text (e.g. if the user wants to highlight the text)
                   does not call toggleDrawer */
              <div className="ml-2 mr-2">
                <span className="hidden md:inline-flex truncate">
                  <div className="mr-1">{"Overarching goal: "}</div>
                  <div onClick={(e) => e.stopPropagation()}>
                    {overarchingGoal.title}
                  </div>
                </span>
                <span
                  className="inline-flex md:hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {overarchingGoal.title}
                </span>
              </div>
            )}
          </div>
          <div
            id="buttons"
            className="flex items-center space-x-2 flex-shrink-0 ml-auto"
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* FIXME: causes a React hydration error to put a checkbox here, not sure why */}
                  {/* <Checkbox id="oa_achieved" /> */}
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-normal">Achieved?</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="flex items-center space-x-2">
              {isOpen && (
                <Button
                  variant="ghost"
                  className={cn("h-6 hover:bg-gray-400")}
                  onClick={handleSetGoal}
                >
                  Set
                </Button>
              )}
              <Button
                onClick={toggleDrawer}
                variant="ghost"
                size="icon"
                className={cn("h-6 p-0 hover:bg-gray-400")}
              >
                {isOpen ? (
                  <ChevronUp className="h-6 w-6" />
                ) : (
                  <ChevronDown className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { OverarchingGoalComponent };
