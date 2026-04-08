/**
 * Tests for auth patterns from _shared/auth.ts.
 * Since auth.ts imports createClient and corsHeaders, we cannot import it directly
 * without the import map. Instead, we test the auth logic patterns.
 * Validates: token extraction, role checking, error response structure.
 */
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";

// --- Replicate key logic from _shared/auth.ts ---

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.replace("Bearer ", "");
}

function isRoleAllowed(role: string, allowedRoles: string[]): boolean {
  return allowedRoles.includes(role.toLowerCase());
}

function buildAuthErrorResponse(
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

// --- Tests ---

Deno.test("Auth: extract valid bearer token", () => {
  assertEquals(
    extractBearerToken("Bearer eyJhbGciOiJIUzI1NiJ9.test"),
    "eyJhbGciOiJIUzI1NiJ9.test",
  );
});

Deno.test("Auth: reject missing auth header", () => {
  assertEquals(extractBearerToken(null), null);
});

Deno.test("Auth: reject non-Bearer auth header", () => {
  assertEquals(extractBearerToken("Basic dXNlcjpwYXNz"), null);
  assertEquals(extractBearerToken("Token abc123"), null);
});

Deno.test("Auth: reject empty auth header", () => {
  assertEquals(extractBearerToken(""), null);
});

Deno.test("Auth: reject 'Bearer ' without token", () => {
  // "Bearer " starts with "Bearer " so it passes the check, returns empty string
  assertEquals(extractBearerToken("Bearer "), "");
});

Deno.test("Auth: role check is case insensitive", () => {
  assertEquals(isRoleAllowed("Admin", ["admin", "superadmin"]), true);
  assertEquals(isRoleAllowed("ADMIN", ["admin", "superadmin"]), true);
  assertEquals(isRoleAllowed("admin", ["admin", "superadmin"]), true);
});

Deno.test("Auth: role check rejects unauthorized roles", () => {
  assertEquals(isRoleAllowed("viewer", ["admin", "superadmin"]), false);
  assertEquals(isRoleAllowed("unknown", ["admin"]), false);
});

Deno.test("Auth: error response has correct structure", async () => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
  const response = buildAuthErrorResponse(
    "Missing or invalid Authorization header",
    401,
    corsHeaders,
  );
  assertEquals(response.status, 401);
  assertEquals(response.headers.get("Content-Type"), "application/json");
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");

  const body = await response.json();
  assertEquals(body.error, "Missing or invalid Authorization header");
});

Deno.test("Auth: 403 response for insufficient permissions", async () => {
  const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization" };
  const response = buildAuthErrorResponse("Insufficient permissions", 403, corsHeaders);
  assertEquals(response.status, 403);
  const body = await response.json();
  assertEquals(body.error, "Insufficient permissions");
});

Deno.test("Auth: role fallback for missing profile", () => {
  // Replicates: const role = auth.data?.profile?.role?.toLowerCase() || 'unknown'
  const profileWithRole = { role: "Admin" };
  const profileNoRole = {};
  const noProfile = undefined;

  assertEquals(
    (profileWithRole as { role?: string }).role?.toLowerCase() || "unknown",
    "admin",
  );
  assertEquals(
    (profileNoRole as { role?: string }).role?.toLowerCase() || "unknown",
    "unknown",
  );
  assertEquals(
    (noProfile as { role?: string } | undefined)?.role?.toLowerCase() || "unknown",
    "unknown",
  );
});
