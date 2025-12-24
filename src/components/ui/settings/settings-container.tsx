"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useUserIntegration } from "@/lib/api/user-integrations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IntegrationSettings } from "./integration-settings";
import { RelationshipSettings } from "./relationship-settings";
import { CoacheeRelationshipSettings } from "./coachee-relationship-settings";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { isUserCoach, isUserCoachee } from "@/types/coaching-relationship";
import { toast } from "sonner";

export function SettingsContainer() {
  const searchParams = useSearchParams();
  const { userId } = useAuthStore((state) => ({
    userId: state.userId,
  }));
  const { currentOrganizationId } = useCurrentOrganization();
  const { integration, isLoading: integrationLoading, refresh: refreshIntegration } = useUserIntegration(userId);
  const { relationships, isLoading: relationshipsLoading } = useCoachingRelationshipList(currentOrganizationId || "");

  const isCoach = isUserCoach(userId, relationships);
  const isCoachee = isUserCoachee(userId, relationships);
  const isLoading = integrationLoading || relationshipsLoading;

  // Determine default tab based on role - coaches see integrations first, coachees see privacy
  // If returning from Google OAuth, always show integrations tab
  const googleConnected = searchParams.get("google") === "connected";
  const defaultTab = googleConnected ? "integrations" : isCoach ? "integrations" : isCoachee ? "privacy" : "integrations";
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Handle Google OAuth success notification
  useEffect(() => {
    if (googleConnected) {
      toast.success("Google account connected successfully!");
      // Clean up URL by removing the query parameter
      window.history.replaceState({}, "", "/settings");
      // Refresh integration data to show updated status
      refreshIntegration();
    }
  }, [googleConnected, refreshIntegration]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  // User has no relationships at all
  if (!isCoach && !isCoachee) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Account settings and preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Settings are available once you have coaching relationships.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Contact your organization administrator to be added to a coaching relationship.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate number of tabs to determine grid columns
  const tabCount = (isCoach ? 2 : 0) + (isCoachee ? 1 : 0);
  const gridCols = tabCount === 3 ? "grid-cols-3" : tabCount === 2 ? "grid-cols-2" : "grid-cols-1";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          {isCoach && isCoachee
            ? "Manage your integrations, coaching relationships, and privacy settings"
            : isCoach
            ? "Manage your integrations and coaching relationship settings"
            : "Manage your AI privacy settings for coaching sessions"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full ${gridCols}`}>
            {isCoach && (
              <>
                <TabsTrigger value="integrations">Integrations</TabsTrigger>
                <TabsTrigger value="relationships">Relationships</TabsTrigger>
              </>
            )}
            {isCoachee && (
              <TabsTrigger value="privacy">My Privacy</TabsTrigger>
            )}
          </TabsList>
          {isCoach && (
            <>
              <TabsContent value="integrations" className="mt-6">
                <IntegrationSettings
                  userId={userId}
                  integration={integration}
                  onRefresh={refreshIntegration}
                />
              </TabsContent>
              <TabsContent value="relationships" className="mt-6">
                <RelationshipSettings
                  userId={userId}
                  relationships={relationships.filter(r => r.coach_id === userId)}
                />
              </TabsContent>
            </>
          )}
          {isCoachee && (
            <TabsContent value="privacy" className="mt-6">
              <CoacheeRelationshipSettings
                userId={userId}
                relationships={relationships}
              />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
