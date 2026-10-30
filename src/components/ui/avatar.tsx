"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/components/lib/utils";
import { AVATAR_TONE_CLASSES, avatarToneFor } from "@/lib/avatar-palette";
import type { Id } from "@/types/general";
import { organizationInitials } from "@/types/organization";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-avatar text-avatar-foreground",
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export type PersonAvatarSize = 26 | 28 | 36 | 40;

const PERSON_AVATAR_SIZE_CLASSES: Record<PersonAvatarSize, string> = {
  26: "h-[26px] w-[26px] text-[10px]",
  28: "h-7 w-7 text-[10px]",
  36: "h-9 w-9 text-xs",
  40: "h-10 w-10 text-xs",
};

interface PersonAvatarProps {
  userId: Id;
  initials: string;
  size: PersonAvatarSize;
  selected?: boolean;
  className?: string;
}

function PersonAvatar({
  userId,
  initials,
  size,
  selected = false,
  className,
}: PersonAvatarProps) {
  return (
    <Avatar
      data-selected={selected ? "true" : "false"}
      className={cn(
        PERSON_AVATAR_SIZE_CLASSES[size],
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-card",
        className
      )}
    >
      <AvatarFallback
        className={cn(
          "font-semibold",
          AVATAR_TONE_CLASSES[avatarToneFor(userId)]
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

interface OrgAvatarProps {
  name: string | undefined;
  logo: string | undefined;
  className?: string;
}

function OrgAvatar({ name, logo, className }: OrgAvatarProps) {
  return (
    <Avatar className={cn("h-7 w-7 rounded-lg", className)}>
      <AvatarImage src={logo} alt={name || "Organization"} />
      <AvatarFallback className="rounded-lg bg-avatar text-avatar-foreground text-[11px] font-medium">
        {organizationInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export { Avatar, AvatarImage, AvatarFallback, PersonAvatar, OrgAvatar };
