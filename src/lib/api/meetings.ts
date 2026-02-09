// Interacts with the meeting management endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import { MeetingSpace } from "@/types/meeting-space";
import { EntityApi } from "./entity-api";

const MEETINGS_BASEURL = `${siteConfig.env.backendServiceURL}/meetings/google`;

interface CreateGoogleMeetRequest {
  organization_id: Id;
  coaching_relationship_id: Id;
}

export const MeetingApi = {
  /**
   * Creates a new Google Meet meeting for a coaching relationship.
   * Requires the user to have a connected Google OAuth account.
   *
   * @param organizationId The organization ID
   * @param relationshipId The coaching relationship ID
   * @returns Promise resolving to the created MeetingSpace with join_url
   */
  createGoogleMeet: async (
    organizationId: Id,
    relationshipId: Id
  ): Promise<MeetingSpace> =>
    EntityApi.createFn<CreateGoogleMeetRequest, MeetingSpace>(
      `${MEETINGS_BASEURL}/create`,
      {
        organization_id: organizationId,
        coaching_relationship_id: relationshipId,
      }
    ),
};
