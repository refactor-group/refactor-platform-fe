// Interacts with the coaching_relationship endpoints

import { siteConfig } from "@/site.config";
import {
  CoachingRelationshipWithUserNames,
  coachingRelationshipsWithUserNamesToString,
  defaultCoachingRelationshipWithUserNames,
  defaultCoachingRelationshipsWithUserNames,
  isCoachingRelationshipWithUserNames,
  isCoachingRelationshipWithUserNamesArray,
  parseCoachingRelationshipWithUserNames,
} from "@/types/coaching_relationship_with_user_names";
import { Id } from "@/types/general";
import axios, { AxiosError, AxiosResponse } from "axios";
import useSWR from "swr";

interface ApiResponse {
  status_code: number;
  data: CoachingRelationshipWithUserNames[];
}

const fetcher = async (
  url: string
): Promise<CoachingRelationshipWithUserNames[]> =>
  axios
    .get<ApiResponse>(url, {
      withCredentials: true,
      timeout: 5000,
      headers: {
        "X-Version": siteConfig.env.backendApiVersion,
      },
    })
    .then((res) => res.data.data);

/// A hook to retrieve all CoachingRelationships associated with organizationId
export function useCoachingRelationships(organizationId: Id) {
  console.debug(`organizationId: ${organizationId}`);

  const { data, error, isLoading } = useSWR<
    CoachingRelationshipWithUserNames[]
  >(
    organizationId ?
      `${siteConfig.env.backendServiceURL}/organizations/${organizationId}/coaching_relationships` : null,
    fetcher
  );

  console.debug(`data: ${JSON.stringify(data)}`);

  return {
    relationships: Array.isArray(data) ? data : [],
    isLoading,
    isError: error,
  };
}

export const fetchCoachingRelationshipWithUserNames = async (
  organization_id: Id,
  relationship_id: Id
): Promise<CoachingRelationshipWithUserNames> => {
  const axios = require("axios");

  var relationship: CoachingRelationshipWithUserNames =
    defaultCoachingRelationshipWithUserNames();
  var err: string = "";

  const data = await axios
    .get(
      `${siteConfig.env.backendServiceURL}/organizations/${organization_id}/coaching_relationships/${relationship_id}`,
      {
        withCredentials: true,
        setTimeout: 5000, // 5 seconds before timing out trying to log in with the backend
        headers: {
          "X-Version": siteConfig.env.backendApiVersion,
        },
      }
    )
    .then(function (response: AxiosResponse) {
      // handle success
      const relationshipData = response.data.data;
      if (isCoachingRelationshipWithUserNames(relationshipData)) {
        relationship = parseCoachingRelationshipWithUserNames(relationshipData);
      }
    })
    .catch(function (error: AxiosError) {
      // handle error
      console.error(error.response?.status);
      if (error.response?.status == 401) {
        err =
          "Retrieval of CoachingRelationshipWithUserNames failed: unauthorized.";
      } else if (error.response?.status == 500) {
        err =
          "Retrieval of CoachingRelationshipWithUserNames failed, system error: " +
          error.response.data;
      } else {
        err =
          `Retrieval of CoachingRelationshipWithUserNames(` +
          relationship_id +
          `) failed: ` +
          error.response?.data;
      }
    });

  if (err) {
    console.error(err);
    throw err;
  }

  return relationship;
};

export const fetchCoachingRelationshipsWithUserNames = async (
  organizationId: Id
): Promise<[CoachingRelationshipWithUserNames[], string]> => {
  const axios = require("axios");

  var relationships: CoachingRelationshipWithUserNames[] =
    defaultCoachingRelationshipsWithUserNames();
  var err: string = "";

  const data = await axios
    .get(
      `${siteConfig.env.backendServiceURL}/organizations/${organizationId}/coaching_relationships`,
      {
        withCredentials: true,
        setTimeout: 5000, // 5 seconds before timing out trying to log in with the backend
        headers: {
          "X-Version": siteConfig.env.backendApiVersion,
        },
      }
    )
    .then(function (response: AxiosResponse) {
      // handle success
      console.debug(response);
      if (isCoachingRelationshipWithUserNamesArray(response.data.data)) {
        relationships = response.data.data;
        console.debug(
          `CoachingRelationshipsWithUserNames: ` +
          coachingRelationshipsWithUserNamesToString(relationships) +
          `.`
        );
      }
    })
    .catch(function (error: AxiosError) {
      // handle error
      console.error(error.response?.status);
      if (error.response?.status == 401) {
        console.error(
          "Retrieval of CoachingRelationshipsWithUserNames failed: unauthorized."
        );
        err =
          "Retrieval of CoachingRelationshipsWithUserNames failed: unauthorized.";
      } else {
        console.log(error);
        console.error(
          `Retrieval of CoachingRelationshipsWithUserNames by organization Id (` +
          organizationId +
          `) failed.`
        );
        err =
          `Retrieval of CoachingRealtionshipsWithUserNames by organization Id (` +
          organizationId +
          `) failed.`;
      }
    });

  return [relationships, err];
};
