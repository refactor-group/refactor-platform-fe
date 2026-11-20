import { ActionsViewMode } from "@/types/assigned-actions";
import { type CoachingRelationship, viewerOf } from "@/types/coaching-relationship";
import { RelationshipRole } from "@/types/relationship-role";

function viewerIs(role: RelationshipRole) {
  return (r: CoachingRelationship): boolean => {
    const viewer = viewerOf(r);
    return viewer.some && viewer.val.role === role;
  };
}

/** The views the viewer's roles give them, in toggle order; just My Actions for a coachee. */
export function actionsViewsFor(relationships: readonly CoachingRelationship[]): ActionsViewMode[] {
  const views = [ActionsViewMode.MyActions];
  if (relationships.some(viewerIs(RelationshipRole.Coach))) views.push(ActionsViewMode.CoacheeActions);
  if (relationships.some(viewerIs(RelationshipRole.Colleague))) views.push(ActionsViewMode.ColleagueActions);
  return views;
}

/** The relationships a view can be narrowed to: the ones its scope reads. */
export function relationshipsInView<R extends CoachingRelationship>(
  view: ActionsViewMode,
  relationships: readonly R[]
): R[] {
  switch (view) {
    case ActionsViewMode.MyActions:
      return [...relationships];
    case ActionsViewMode.CoacheeActions:
      return relationships.filter(viewerIs(RelationshipRole.Coach));
    case ActionsViewMode.ColleagueActions:
      return relationships.filter(viewerIs(RelationshipRole.Colleague));
    default: {
      const _exhaustive: never = view;
      throw new Error(`Unhandled actions view: ${_exhaustive}`);
    }
  }
}

export function actionsViewLabel(view: ActionsViewMode): string {
  switch (view) {
    case ActionsViewMode.MyActions:
      return "My Actions";
    case ActionsViewMode.CoacheeActions:
      return "Coachee Actions";
    case ActionsViewMode.ColleagueActions:
      return "Colleagues' Actions";
    default: {
      const _exhaustive: never = view;
      throw new Error(`Unhandled actions view: ${_exhaustive}`);
    }
  }
}
