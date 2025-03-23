"use client";

import { Button } from "@/components/ui/button";

interface AddMemberButtonProps {
  onClick?: () => void;
}

export function AddMemberButton({ onClick }: AddMemberButtonProps) {
  return (
    <Button onClick={onClick} variant="outline" size="sm">
      Add Member
    </Button>
  );
}
