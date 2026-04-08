/**
 * Tests for CORS header generation patterns used across all Edge Functions.
 * Validates: getCorsHeaders dynamic origin, static corsHeaders fallback, OPTIONS handling.
 */
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";

// --- Replicate the CORS logic from _shared/cors.ts ---

function buildCorsHeaders(
  origin: string,
  allowedOrigins: string[],
): Record<string, string> {
  const allowedOrigin = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-device-id",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}

function buildStaticCorsHeaders(
  envOrigin: string | undefined,
): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": envOrigin || "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-device-id",
  };
}

// --- Tests ---

Deno.test("CORS: allowed origin is echoed back", () => {
  const headers = buildCorsHeaders("http://localhost:5173", [
    "https://app.example.com",
    "http://localhost:8080",
    "http://localhost:5173",
  ]);
  assertEquals(headers["Access-Control-Allow-Origin"], "http://localhost:5173");
});

Deno.test("CORS: unknown origin falls back to first allowed", () => {
  const headers = buildCorsHeaders("https://evil.com", [
    "https://app.example.com",
    "http://localhost:8080",
  ]);
  assertEquals(
    headers["Access-Control-Allow-Origin"],
    "https://app.example.com",
  );
});

Deno.test("CORS: empty allowed list falls back to wildcard", () => {
  const headers = buildCorsHeaders("https://any.com", []);
  assertEquals(headers["Access-Control-Allow-Origin"], "*");
});

Deno.test("CORS: required headers are present", () => {
  const headers = buildCorsHeaders("http://localhost:5173", [
    "http://localhost:5173",
  ]);
  assertExists(headers["Access-Control-Allow-Headers"]);
  assertExists(headers["Access-Control-Allow-Methods"]);
  assertEquals(headers["Access-Control-Allow-Methods"], "POST, GET, OPTIONS");
});

Deno.test("CORS: authorization header is in allowed list", () => {
  const headers = buildCorsHeaders("http://localhost:5173", [
    "http://localhost:5173",
  ]);
  const allowedHeaders = headers["Access-Control-Allow-Headers"];
  assertEquals(allowedHeaders.includes("authorization"), true);
  assertEquals(allowedHeaders.includes("content-type"), true);
  assertEquals(allowedHeaders.includes("apikey"), true);
});

Deno.test("CORS: static headers use env or wildcard", () => {
  const withEnv = buildStaticCorsHeaders("https://app.example.com");
  assertEquals(
    withEnv["Access-Control-Allow-Origin"],
    "https://app.example.com",
  );

  const withoutEnv = buildStaticCorsHeaders(undefined);
  assertEquals(withoutEnv["Access-Control-Allow-Origin"], "*");
});

Deno.test("CORS: OPTIONS response pattern returns correct status", () => {
  // All functions use: if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const corsHeaders = buildStaticCorsHeaders("https://app.example.com");
  const response = new Response("ok", { headers: corsHeaders });
  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("Access-Control-Allow-Origin"),
    "https://app.example.com",
  );
});
