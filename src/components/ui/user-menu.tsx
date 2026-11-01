"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Building2,
  Check,
  ChevronRight,
  LogOut,
  Settings,
  SunMoon,
  User,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/components/lib/utils";
import { OrgAvatar, PersonAvatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { optionsMessage } from "@/components/ui/organization-switcher-parts";
import { useOrganizationList } from "@/lib/api/organizations";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCurrentUserRole } from "@/lib/hooks/use-current-user-role";
import { useIsSuperAdmin } from "@/lib/hooks/use-is-super-admin";
import { useLogoutUser } from "@/lib/hooks/use-logout-user";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import type { Id } from "@/types/general";
import { isAdminOrSuperAdmin } from "@/types/user";
import {
  userSessionFirstLastLettersToString,
  type UserSession,
} from "@/types/user-session";

const ROW = "min-h-9 gap-2.5 rounded-lg px-2.5 py-1.5 text-item";
const ICON = "h-[15px] w-[15px] shrink-0 text-ink-2";
// Lines labels up with the org names: row padding + 22px tile + gap.
const INDENTED = "pl-[42px]";

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Auto" },
] as const;

export function UserMenu() {
  const { userSession, isACoach } = useAuthStore((state) => ({
    userSession: state.userSession,
    isACoach: state.isACoach,
  }));
  const logoutUser = useLogoutUser();
  const { currentOrganizationId } = useCurrentOrganization();
  const roleState = useCurrentUserRole();
  const isSuperAdmin = useIsSuperAdmin();
  const canSeeMembers =
    !!currentOrganizationId && (isSuperAdmin || isAdminOrSuperAdmin(roleState));
  const initials = userSessionFirstLastLettersToString(
    userSession.first_name,
    userSession.last_name
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="shrink-0 rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <PersonAvatar userId={userSession.id} initials={initials} size={36} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[268px] p-1.5">
        <AccountHeader userSession={userSession} initials={initials} />
        <MenuSeparator />
        <OrganizationSection />
        {canSeeMembers && (
          <DropdownMenuItem asChild className={cn(ROW, INDENTED)}>
            <Link href={`/organizations/${currentOrganizationId}/members`}>
              Members
              <ChevronRight className="ml-auto h-[15px] w-[15px] text-faint" />
            </Link>
          </DropdownMenuItem>
        )}
        {isSuperAdmin && (
          <DropdownMenuItem asChild className={ROW}>
            <Link href="/admin/organizations">
              <span className="flex w-[22px] justify-center">
                <Building2 className={ICON} />
              </span>
              Organizations
            </Link>
          </DropdownMenuItem>
        )}
        <MenuSeparator />
        <LinkRow href={`/members/${userSession.id}/profile`} icon={User} label="Profile" />
        {isACoach && <LinkRow href="/settings" icon={Settings} label="Settings" />}
        <AppearanceRow />
        <MenuSeparator />
        <DropdownMenuItem className={ROW} onSelect={logoutUser}>
          <LogOut className={ICON} />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuSeparator() {
  return <DropdownMenuSeparator className="-mx-1.5 bg-hairline" />;
}

function AccountHeader({
  userSession,
  initials,
}: {
  userSession: UserSession;
  initials: string;
}) {
  return (
    <DropdownMenuLabel className="flex items-center gap-2.5 px-2.5 py-2 font-normal">
      <PersonAvatar userId={userSession.id} initials={initials} size={36} />
      <div className="min-w-0">
        <p className="text-sm font-medium">{`${userSession.first_name} ${userSession.last_name}`}</p>
        <p className="truncate text-xs text-muted-foreground">{userSession.email}</p>
      </div>
    </DropdownMenuLabel>
  );
}

function LinkRow({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <DropdownMenuItem asChild className={ROW}>
      <Link href={href}>
        <Icon className={ICON} />
        {label}
      </Link>
    </DropdownMenuItem>
  );
}

function OrganizationSection() {
  const userId = useAuthStore((state) => state.userId);
  const { organizations, isLoading, isError } = useOrganizationList(userId);
  const { currentOrganizationId } = useCurrentOrganization();
  const switchOrganization = useSwitchOrganization();
  const options = organizations ?? [];
  const message = optionsMessage(isLoading, isError, options.length === 0);

  return (
    <>
      <p className="px-2.5 pb-1 pt-1 text-xs font-medium text-muted-foreground">
        Organization
      </p>
      <div className="max-h-[216px] overflow-y-auto">
        {message.some ? (
          <p className={cn("flex items-center text-muted-foreground", ROW)}>{message.val}</p>
        ) : (
          options.map((org) => {
            const isCurrent = org.id === currentOrganizationId;
            return (
              <DropdownMenuItem
                key={org.id}
                aria-current={isCurrent ? "true" : undefined}
                className={cn(ROW, isCurrent && "bg-fill font-medium")}
                onSelect={() => switchOrganization(org.id)}
              >
                <OrgAvatar name={org.name} logo={org.logo} className="h-[22px] w-[22px]" />
                <span className="truncate">{org.name}</span>
                {isCurrent && <Check className="ml-auto h-[15px] w-[15px] shrink-0 text-brand" />}
              </DropdownMenuItem>
            );
          })
        )}
      </div>
    </>
  );
}

/** Selects an organization, staying on the same org-scoped page when there is one. */
function useSwitchOrganization() {
  const router = useRouter();
  const pathname = usePathname();
  const userId = useAuthStore((state) => state.userId);
  const { setCurrentOrganizationId, rememberOrganizationForUser } = useCurrentOrganization();

  return (orgId: Id) => {
    setCurrentOrganizationId(orgId);
    rememberOrganizationForUser(userId, orgId);
    const orgRouteMatch = pathname?.match(/^\/organizations\/[^/]+(.*)$/);
    router.push(orgRouteMatch ? `/organizations/${orgId}${orgRouteMatch[1]}` : "/dashboard");
  };
}

function AppearanceRow() {
  const { theme, setTheme } = useTheme();

  return (
    <div className={cn("flex items-center", ROW, "gap-2")}>
      <SunMoon className={ICON} />
      <span className="whitespace-nowrap">Appearance</span>
      <DropdownMenuRadioGroup
        value={theme}
        onValueChange={setTheme}
        className="ml-auto inline-flex rounded-full bg-fill p-0.5"
      >
        {THEMES.map(({ value, label }) => (
          <DropdownMenuRadioItem
            key={value}
            value={value}
            // Keeps the menu open so the change is visible in place.
            onSelect={(event) => event.preventDefault()}
            className="h-[22px] rounded-full px-2 py-0 text-pill font-medium text-muted-foreground focus:bg-fill-hover focus:text-foreground data-[state=checked]:bg-background data-[state=checked]:text-foreground data-[state=checked]:shadow-sm [&>span:first-child]:hidden"
          >
            {label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </div>
  );
}
