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

  // Google OAuth status
  http.get("*/oauth/google/status", () => {
    return HttpResponse.json({
      status_code: 200,
      data: { status: "disconnected" },
    });
  }),

  // Google OAuth disconnect
  http.delete("*/oauth/google", () => {
    return new HttpResponse(null, { status: 200 });
  }),

  // User lookup by exact email: 0 or 1 results, never a 404. Tests that care
  // about a match override this with server.use().
  http.get("*/users", ({ request }) => {
    const email = new URL(request.url).searchParams.get("email");
    if (!email) {
      return new HttpResponse(null, { status: 400 });
    }
    return HttpResponse.json({ status_code: 200, data: [] });
  }),

  // Grant an existing user membership of an organization
  http.post("*/organizations/:organizationId/users/:userId/role", () => {
    return HttpResponse.json({ status_code: 200, data: { id: "user-1" } });
  }),

  // Remove a user's membership of an organization (account untouched)
  http.delete("*/organizations/:organizationId/users/:userId/role", () => {
    return HttpResponse.json({ status_code: 200, data: null });
  }),

];
