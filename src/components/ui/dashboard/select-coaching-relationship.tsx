"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useAuthStore } from "@/lib/providers/auth-store-provider"
import OrganizationSelector from "../organization-selector"
import CoachingRelationshipSelector from "../coaching-relationship-selector"
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider"
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider"

export default function SelectCoachingRelationship() {
    const { userId } = useAuthStore((state) => state)
    const { currentOrganizationId } = useOrganizationStateStore((state) => state)
    const { currentCoachingRelationshipId } = useCoachingRelationshipStateStore((state) => state)

    return (
        <Card className="w-full">
            <CardHeader className="space-y-2">
                <CardTitle className="text-xl sm:text-2xl">Choose a Coaching Relationship</CardTitle>
                <CardDescription className="text-sm">Select current organization and relationship</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="organization">Organization</Label>
                    <OrganizationSelector userId={userId} />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="relationship">Relationship</Label>
                    <CoachingRelationshipSelector organizationId={currentOrganizationId} disabled={!currentOrganizationId} />
                </div>
            </CardContent>
        </Card>
    )
}
