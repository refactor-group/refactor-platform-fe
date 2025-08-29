import { DateTime } from "ts-luxon";
import { CoachingRelationshipWithUserNames } from "./coaching_relationship";
import { CoachingSession } from "./coaching-session";
import { siteConfig } from "@/site.config";
import { getDateTimeFromString } from "./general";

// This is a frontend type only, it does not reflect any literal entity model
// from the backend.
export interface SessionTitle {
  title: string;
  style: SessionTitleStyle;
}

// Different title rendering styles
export enum SessionTitleStyle {
  CoachFirstCoacheeFirst,
  CoachFirstLastCoacheeFirstLast,
  CoachFirstCoacheeFirstDate,
  CoachFirstCoacheeFirstDateTime,
}

function constructCoachFirstCoacheeFirstTitle(
  coach_first_name: string,
  coachee_first_name: string
): string {
  return coach_first_name + " / " + coachee_first_name;
}

function constructCoachFirstLastCoacheeFirstLastTitle(
  coach_first_name: string,
  coach_last_name: string,
  coachee_first_name: string,
  coachee_last_name: string
): string {
  return (
    coach_first_name +
    " " +
    coach_last_name +
    " / " +
    coachee_first_name +
    " " +
    coachee_last_name
  );
}

function constructCoachFirstCoacheeFirstDate(
  coach_first_name: string,
  coachee_first_name: string,
  date: string,
  locale: string
): string {
  var title = coach_first_name + " / " + coachee_first_name;
  var formattedDateTime =
    " @ " +
    getDateTimeFromString(date)
      .setLocale(locale)
      .toLocaleString(DateTime.DATE_MED);

  return coach_first_name + " / " + coachee_first_name + formattedDateTime;
}

function constructCoachFirstCoacheeFirstDateTime(
  coach_first_name: string,
  coachee_first_name: string,
  date: string,
  locale: string
): string {
  var title = coach_first_name + " / " + coachee_first_name;
  var formattedDateTime =
    " @ " +
    getDateTimeFromString(date)
      .setLocale(locale)
      .toLocaleString(DateTime.DATETIME_MED);

  return coach_first_name + " / " + coachee_first_name + formattedDateTime;
}

export function generateSessionTitle(
  session: CoachingSession,
  relationship: CoachingRelationshipWithUserNames,
  style: SessionTitleStyle,
  locale: string
): SessionTitle {
  var sessionTitleStr = "";

  if (style == SessionTitleStyle.CoachFirstCoacheeFirst) {
    sessionTitleStr = constructCoachFirstCoacheeFirstTitle(
      relationship.coach_first_name,
      relationship.coachee_first_name
    );
  } else if (style == SessionTitleStyle.CoachFirstLastCoacheeFirstLast) {
    sessionTitleStr = constructCoachFirstLastCoacheeFirstLastTitle(
      relationship.coach_first_name,
      relationship.coach_last_name,
      relationship.coachee_first_name,
      relationship.coachee_last_name
    );
  } else if (style == SessionTitleStyle.CoachFirstCoacheeFirstDate) {
    sessionTitleStr = constructCoachFirstCoacheeFirstDate(
      relationship.coach_first_name,
      relationship.coachee_first_name,
      session.date,
      locale
    );
  } else if (style == SessionTitleStyle.CoachFirstCoacheeFirstDateTime) {
    sessionTitleStr = constructCoachFirstCoacheeFirstDateTime(
      relationship.coach_first_name,
      relationship.coachee_first_name,
      session.date,
      locale
    );
  }

  return {
    title: sessionTitleStr,
    style: style,
  };
}

export function defaultSessionTitle(): SessionTitle {
  return {
    title: "Untitled Session",
    style: siteConfig.titleStyle,
  };
}

export function sessionTitleToString(sessionTitle: SessionTitle): string {
  return JSON.stringify(sessionTitle);
}
