"use client";

import type * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { BarChart3, Gift, Home, Settings, Users } from "lucide-react";

import { OrganizationSwitcher } from "./organization-switcher";
import { Icons } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/components/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { SidebarCollapsible } from "@/types/sidebar";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import type { Id } from "@/types/general";

// Custom styles for menu buttons to ensure consistent centering
const menuButtonStyles = {
  button: "flex items-center gap-2 w-full",
  buttonCollapsed:
    "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
  iconWrapper: "flex items-center justify-center w-9",
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { currentOrganizationId } = useCurrentOrganization();
  const router = useRouter();
  const pathname = usePathname();

  const handleOrgChange = (newOrgId: Id) => {
    // Check if current path is organization-scoped
    const orgRouteMatch = pathname?.match(/^\/organizations\/[^\/]+(.*)$/);
    
    if (orgRouteMatch) {
      // Preserve everything after the org ID and reconstruct with new org ID
      const routeSuffix = orgRouteMatch[1] || '';
      router.push(`/organizations/${newOrgId}${routeSuffix}`);
    } else {
      // Not on an org-scoped route, go to dashboard
      router.push('/dashboard');
    }
  };

  return (
    <Sidebar collapsible={SidebarCollapsible.Icon} {...props}>
      <SidebarHeader className="h-16 flex flex-col justify-between pb-0">
        {/* Logo and Refactor text */}
        <div className="flex items-center px-3 h-full transition-all duration-200 group-data-[collapsible=icon]:justify-center">
          <Link href="/dashboard" className="flex items-center">
            <div
              className={cn(
                buttonVariants({
                  variant: "ghost",
                }),
                "w-9 px-0"
              )}
            >
              <Icons.refactor_logo className="h-5 w-5" />
              <span className="sr-only">Refactor</span>
            </div>
          </Link>
          <h2 className="text-lg font-semibold ml-2 transition-all duration-200 group-data-[collapsible=icon]:hidden">
            Refactor
          </h2>
        </div>

        {/* Border that aligns with the header border */}
        <div className="border-b border-sidebar-border w-full" />
      </SidebarHeader>

      {/* Organization Switcher */}
      <SidebarContent className="pt-2">
        <SidebarGroup className="pb-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <OrganizationSwitcher onSelect={handleOrgChange} />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Main navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Dashboard"
                  className={cn(
                    menuButtonStyles.button,
                    menuButtonStyles.buttonCollapsed
                  )}
                >
                  <Link href="/dashboard">
                    <span className={menuButtonStyles.iconWrapper}>
                      <Home className="h-4 w-4" />
                    </span>
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Members"
                  className={cn(
                    menuButtonStyles.button,
                    menuButtonStyles.buttonCollapsed
                  )}
                >
                  <Link href={`/organizations/${currentOrganizationId}/members`}>
                    <span className={menuButtonStyles.iconWrapper}>
                      <Users className="h-4 w-4" />
                    </span>
                    <span>Members</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {/* Settings and support */}
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Referrals"
                className={cn(
                  menuButtonStyles.button,
                  menuButtonStyles.buttonCollapsed
                )}
              >
                <Link href="/referrals">
                  <span className={menuButtonStyles.iconWrapper}>
                    <Gift className="h-4 w-4" />
                  </span>
                  <span>Referrals</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Organization settings"
                className={cn(
                  menuButtonStyles.button,
                  menuButtonStyles.buttonCollapsed
                )}
              >
                <Link href="/settings">
                  <span className={menuButtonStyles.iconWrapper}>
                    <Settings className="h-4 w-4" />
                  </span>
                  <span>Organization settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* System status */}
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="System status"
                className={cn(
                  menuButtonStyles.button,
                  menuButtonStyles.buttonCollapsed
                )}
              >
                <Link href="/status">
                  <span className={menuButtonStyles.iconWrapper}>
                    <BarChart3 className="h-4 w-4" />
                  </span>
                  <span>System status</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarRail />
    </Sidebar>
  );
}
