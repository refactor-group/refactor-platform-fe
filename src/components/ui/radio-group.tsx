"use client"

import * as React from "react"
import { useId } from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { Circle, Info } from "lucide-react"

import { cn } from "@/components/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
    />
  )
})
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-brand ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="h-2.5 w-2.5 fill-current text-current" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
})
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

interface RadioCardItemProps {
  value: string
  title: string
  description: string
  disabled?: boolean
  /** Shown from an (i) button on the card, for when the description isn't enough. */
  info?: string
}

function RadioCardItem({ value, title, description, disabled, info }: RadioCardItemProps) {
  const id = useId()
  const titleId = `${id}-title`
  const descriptionId = `${id}-description`
  const item = (
    <RadioGroupPrimitive.Item
      value={value}
      disabled={disabled}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={cn(
        "group flex min-h-14 w-full items-center gap-3 rounded-[12px] border bg-card px-4 py-2.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-brand motion-reduce:transition-none",
        info && "pr-14"
      )}
    >
      <span
        aria-hidden
        className="h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-faint bg-card group-data-[state=checked]:border-[6px] group-data-[state=checked]:border-brand"
      />
      <span className="flex min-w-0 flex-col">
        <span id={titleId} className="text-sm font-medium text-foreground">
          {title}
        </span>
        <span id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </RadioGroupPrimitive.Item>
  )
  if (!info) return item
  // A sibling, not a child: a button can't sit inside the radio's button.
  return (
    <div className="relative">
      {item}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`About ${title}`}
            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-2 transition-colors duration-150 hover:bg-fill hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Info className="h-4 w-4" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-3 text-sm">
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 text-muted-foreground">{info}</p>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export { RadioGroup, RadioGroupItem, RadioCardItem }
