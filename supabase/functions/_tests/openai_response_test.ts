/**
 * Tests for OpenAI response parsing patterns used in analyze-leads and process-samurai-response.
 * Validates: choices extraction, JSON parsing, error detection, empty response handling.
 */
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";

// --- Replicate the OpenAI response parsing patterns ---

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message: string };
}

function extractAIContent(aiData: OpenAIResponse): string {
  return aiData.choices?.[0]?.message?.content || "";
}

function detectOpenAIError(aiData: OpenAIResponse): string | null {
  return aiData.error?.message || null;
}

interface AnalysisResult {
  ciudad: string;
  email: string;
  intent: string;
}

function parseAnalysisJSON(content: string): AnalysisResult | null {
  try {
    return JSON.parse(content) as AnalysisResult;
  } catch {
    return null;
  }
}

function sanitizeIntent(
  rawIntent: string,
  currentIntent: string,
): string {
  const allowed = ["BAJO", "MEDIO", "ALTO"];
  const normalized = rawIntent ? rawIntent.toUpperCase() : "";
  if (allowed.includes(normalized)) return normalized;
  // Fallback: keep current if valid, else BAJO
  return allowed.includes(currentIntent) ? currentIntent : "BAJO";
}

// --- Tests ---

Deno.test("OpenAI: extract content from valid response", () => {
  const response: OpenAIResponse = {
    choices: [{ message: { content: "Hello world" } }],
  };
  assertEquals(extractAIContent(response), "Hello world");
});

Deno.test("OpenAI: empty choices returns empty string", () => {
  assertEquals(extractAIContent({ choices: [] }), "");
  assertEquals(extractAIContent({}), "");
});

Deno.test("OpenAI: missing message returns empty string", () => {
  assertEquals(extractAIContent({ choices: [{}] }), "");
  assertEquals(extractAIContent({ choices: [{ message: {} }] }), "");
});

Deno.test("OpenAI: detect error in response", () => {
  const withError: OpenAIResponse = {
    error: { message: "Rate limit exceeded" },
  };
  assertEquals(detectOpenAIError(withError), "Rate limit exceeded");

  const noError: OpenAIResponse = {
    choices: [{ message: { content: "ok" } }],
  };
  assertEquals(detectOpenAIError(noError), null);
});

Deno.test("OpenAI: parse valid analysis JSON", () => {
  const content = '{"ciudad": "CDMX", "email": "test@mail.com", "intent": "ALTO"}';
  const result = parseAnalysisJSON(content);
  assertExists(result);
  assertEquals(result!.ciudad, "CDMX");
  assertEquals(result!.email, "test@mail.com");
  assertEquals(result!.intent, "ALTO");
});

Deno.test("OpenAI: parse invalid JSON returns null", () => {
  assertEquals(parseAnalysisJSON("not json at all"), null);
  assertEquals(parseAnalysisJSON(""), null);
  assertEquals(parseAnalysisJSON("{broken"), null);
});

Deno.test("OpenAI: sanitize valid intents", () => {
  assertEquals(sanitizeIntent("BAJO", "MEDIO"), "BAJO");
  assertEquals(sanitizeIntent("MEDIO", "BAJO"), "MEDIO");
  assertEquals(sanitizeIntent("ALTO", "BAJO"), "ALTO");
  assertEquals(sanitizeIntent("alto", "BAJO"), "ALTO"); // case insensitive
});

Deno.test("OpenAI: sanitize rejects PERDIDO and falls back", () => {
  // PERDIDO is never a valid AI output
  assertEquals(sanitizeIntent("PERDIDO", "MEDIO"), "MEDIO");
  assertEquals(sanitizeIntent("PERDIDO", "INVALID"), "BAJO");
});

Deno.test("OpenAI: sanitize rejects unknown intents", () => {
  assertEquals(sanitizeIntent("GARBAGE", "ALTO"), "ALTO");
  assertEquals(sanitizeIntent("", "MEDIO"), "MEDIO");
  assertEquals(sanitizeIntent("", ""), "BAJO");
});
