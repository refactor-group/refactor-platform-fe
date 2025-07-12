import { http, HttpResponse } from "msw";

export const handlers = [
  // Mock organization API
  http.get("/api/organizations", () => {
    return HttpResponse.json({
      data: [
        { id: "organization-1", name: "Acme Corp", logo: "/logo1.png" },
        { id: "organization-2", name: "Beta Inc", logo: "/logo2.png" },
      ],
    });
  }),

  // Mock coaching sessions API
  http.get("/api/coaching_sessions/:id", ({ params }) => {
    return HttpResponse.json({
      data: {
        id: params.id,
        title: "Session #1",
        coaching_relationship_id: "relationship-1",
        scheduled_date: "2025-07-04T10:00:00Z",
      },
    });
  }),

  // Mock coaching relationships API
  http.get("/api/organizations/:organizationId/coaching_relationships", () => {
    return HttpResponse.json({
      data: [
        {
          id: "rel-1",
          coach_name: "John Doe",
          coachee_name: "Jane Smith",
          organization_id: "org-1",
        },
      ],
    });
  }),

  // Mock user session validation
  http.post("/api/users/validate_session", () => {
    return HttpResponse.json({
      data: {
        user_id: "user-1",
        is_valid: true,
      },
    });
  }),
];
