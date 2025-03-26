interface MemberCardProps {
  firstName: string;
  lastName: string;
  email?: string;
}

export function MemberCard({ firstName, lastName, email }: MemberCardProps) {
  return (
    <div className="flex items-center p-4 hover:bg-accent/50 transition-colors cursor-pointer">
      <div className="flex-1">
        <h3 className="font-medium">
          {firstName} {lastName}
        </h3>
        {email && <p className="text-sm text-muted-foreground">{email}</p>}
      </div>
    </div>
  );
}
