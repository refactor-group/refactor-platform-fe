import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Role } from "@/types/user";

interface MemberRoleSelectProps {
  role: Role;
  disabled: boolean;
  memberName: string;
  onChange: (role: Role) => void;
}

/// SuperAdmin is deliberately not offered: the backend rejects it with a 422.
export function MemberRoleSelect({
  role,
  disabled,
  memberName,
  onChange,
}: MemberRoleSelectProps) {
  return (
    <Select
      value={role}
      disabled={disabled}
      onValueChange={(value) => onChange(value as Role)}
    >
      <SelectTrigger
        aria-label={`Role for ${memberName}`}
        className="h-8 w-[140px] text-xs"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {/* "Member" is the recipient-facing word for Role.User */}
        <SelectItem value={Role.User}>Member</SelectItem>
        <SelectItem value={Role.Admin}>Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}
