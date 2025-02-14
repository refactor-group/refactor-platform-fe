// Interacts with the coaching_session endpoints

import { siteConfig } from "@/site.config";
import {
  CoachingSession,
  defaultCoachingSession,
  isCoachingSession,
  isCoachingSessionArray,
  parseCoachingSession,
  sortCoachingSessionArray,
} from "@/types/coaching-session";
import { Id, SortOrder } from "@/types/general";
import axios, { AxiosError, AxiosResponse } from "axios";
import useSWR from "swr";
import { DateTime } from "ts-luxon";

// TODO: for now we hardcode a 2 month window centered around now,
// eventually we want to make this be configurable somewhere
// (either on the page or elsewhere)
const fromDate = DateTime.now().minus({ month: 1 }).toISODate();
const toDate = DateTime.now().plus({ month: 1 }).toISODate();

interface ApiResponse {
  status_code: number;
  data: CoachingSession[];
}

const fetcher = async (
  url: string,
  relationshipId: Id
): Promise<CoachingSession[]> =>
  axios
    .get<ApiResponse>(url, {
      params: {
        coaching_relationship_id: relationshipId,
        from_date: fromDate,
        to_date: toDate,
      },
      withCredentials: true,
      timeout: 5000,
      headers: {
        "X-Version": siteConfig.env.backendApiVersion,
      },
    })
    .then((res) => res.data.data);

/// A hook to retrieve all CoachingSessions associated with relationshipId
export function useCoachingSessions(relationshipId: Id) {
  console.debug(`relationshipId: ${relationshipId}`);
  console.debug("fromDate: " + fromDate);
  console.debug("toDate: " + toDate);


  const { data, error, isLoading } = useSWR<CoachingSession[]>(
    relationshipId ?
      [`${siteConfig.env.backendServiceURL}/coaching_sessions`, relationshipId] : null,
    ([url, _token]) => fetcher(url, relationshipId)
  );

  console.debug(`data: ${JSON.stringify(data)}`);

  return {
    coachingSessions: Array.isArray(data) ? data : [],
    isLoading,
    isError: error,
  };
}

export const createCoachingSession = async (
  coaching_relationship_id: Id,
  date: string,
): Promise<CoachingSession> => {
  const axios = require("axios");

  const newCoachingSessionJson = {
    coaching_relationship_id: coaching_relationship_id,
    date: date
  };
  console.debug("newCoachingSessiontJson: " + JSON.stringify(newCoachingSessionJson));
  // A full real note to be returned from the backend with the same body
  var createdCoachingSession: CoachingSession = defaultCoachingSession();
  var err: string = "";

  const data = await axios
    .post(`${siteConfig.env.backendServiceURL}/coaching_sessions`, newCoachingSessionJson, {
      withCredentials: true,
      setTimeout: 5000, // 5 seconds before timing out trying to log in with the backend
      headers: {
        "X-Version": siteConfig.env.backendApiVersion,
        "Content-Type": "application/json",
      },
    })
    .then(function (response: AxiosResponse) {
      // handle success
      const coaching_session_data = response.data.data;
      if (isCoachingSession(coaching_session_data)) {
        createdCoachingSession = parseCoachingSession(coaching_session_data);
      }
    })
    .catch(function (error: AxiosError) {
      // handle error
      console.error(error.response?.status);
      if (error.response?.status == 401) {
        err = "Creation of Coaching Session failed: unauthorized.";
      } else if (error.response?.status == 500) {
        err = "Creation of Coaching Session failed: internal server error.";
      } else {
        err = `Creation of Coaching Session failed.`;
      }
    });

  if (err) {
    console.error(err);
    throw err;
  }

  return createdCoachingSession;
};
