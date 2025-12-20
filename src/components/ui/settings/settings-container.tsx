"use client";

import { useState } from "react";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useUserIntegration } from "@/lib/api/user-integrations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IntegrationSettings } from "./integration-settings";
import { RelationshipSettings } from "./relationship-settings";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { isUserCoach } from "@/types/coaching-relationship";

export function SettingsContainer() {
  const { userId } = useAuthStore((state) => ({
    userId: state.userId,
  }));
  const { currentOrganizationId } = useCurrentOrganization();
  const { integration, isLoading: integrationLoading, refresh: refreshIntegration } = useUserIntegration(userId);
  const { relationships, isLoading: relationshipsLoading } = useCoachingRelationshipList(currentOrganizationId || "");
  const [activeTab, setActiveTab] = useState("integrations");

  const isCoach = isUserCoach(userId, relationships);
  const isLoading = integrationLoading || relationshipsLoading;

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

  // If user is not a coach, show a message
  if (!isCoach) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Account settings and preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Integration settings are only available for coaches.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Contact your coach if you have questions about meeting recordings or transcriptions.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Manage your integrations and coaching relationship settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="relationships">Relationships</TabsTrigger>
          </TabsList>
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
        </Tabs>
      </CardContent>
    </Card>
  );
}
