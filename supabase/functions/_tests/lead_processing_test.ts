/**
 * Tests for lead processing logic patterns from analyze-leads.
 * Validates: COMPRADO blindaje, PERDIDO rescue, intent validation, city/email extraction, CAPI trigger logic.
 */
import {
  assertEquals,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";

// --- Replicate key logic patterns from analyze-leads ---

function shouldSkipAnalysis(buyingIntent: string): { skip: boolean; reason?: string } {
  if (buyingIntent === "COMPRADO") {
    return { skip: true, reason: "Lead ya esta ganado" };
  }
  return { skip: false };
}

function rescuePerdido(buyingIntent: string): string {
  if (buyingIntent === "PERDIDO") return "BAJO";
  return buyingIntent;
}

function buildUpdates(
  parsed: { ciudad?: string; email?: string; intent?: string },
  currentIntent: string,
): Record<string, string> {
  const updates: Record<string, string> = {};
  const allowedIntents = ["BAJO", "MEDIO", "ALTO"];

  let newIntent = parsed.intent ? String(parsed.intent).toUpperCase() : "";
  if (allowedIntents.includes(newIntent)) {
    updates.buying_intent = newIntent;
  } else {
    updates.buying_intent = allowedIntents.includes(currentIntent)
      ? currentIntent
      : "BAJO";
  }

  // Double validation: PERDIDO must never persist
  if (updates.buying_intent === "PERDIDO") updates.buying_intent = "BAJO";

  if (parsed.ciudad && parsed.ciudad.length > 2) {
    updates.ciudad = parsed.ciudad;
  }
  if (parsed.email && parsed.email.includes("@")) {
    updates.email = parsed.email;
  }

  return updates;
}

function shouldFireCAPI(
  oldIntent: string,
  newIntent: string,
  hasPixelId: boolean,
  hasAccessToken: boolean,
): boolean {
  const intentOrder: Record<string, number> = { BAJO: 0, MEDIO: 1, ALTO: 2 };
  const oldLevel = intentOrder[oldIntent] ?? 0;
  const newLevel = intentOrder[newIntent] ?? 0;
  return newLevel > oldLevel && hasPixelId && hasAccessToken;
}

function normalizeCity(city: string): string {
  return city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// --- Tests ---

Deno.test("Lead: COMPRADO leads are skipped", () => {
  const result = shouldSkipAnalysis("COMPRADO");
  assertEquals(result.skip, true);
});

Deno.test("Lead: non-COMPRADO leads are not skipped", () => {
  assertEquals(shouldSkipAnalysis("BAJO").skip, false);
  assertEquals(shouldSkipAnalysis("MEDIO").skip, false);
  assertEquals(shouldSkipAnalysis("ALTO").skip, false);
  assertEquals(shouldSkipAnalysis("PERDIDO").skip, false);
});

Deno.test("Lead: PERDIDO is rescued to BAJO", () => {
  assertEquals(rescuePerdido("PERDIDO"), "BAJO");
  assertEquals(rescuePerdido("BAJO"), "BAJO");
  assertEquals(rescuePerdido("ALTO"), "ALTO");
});

Deno.test("Lead: buildUpdates with valid intent", () => {
  const updates = buildUpdates(
    { ciudad: "Guadalajara", email: "test@mail.com", intent: "ALTO" },
    "BAJO",
  );
  assertEquals(updates.buying_intent, "ALTO");
  assertEquals(updates.ciudad, "Guadalajara");
  assertEquals(updates.email, "test@mail.com");
});

Deno.test("Lead: buildUpdates rejects PERDIDO from AI", () => {
  const updates = buildUpdates({ intent: "PERDIDO" }, "MEDIO");
  assertEquals(updates.buying_intent, "MEDIO");
});

Deno.test("Lead: buildUpdates rejects unknown intent, falls back to current", () => {
  const updates = buildUpdates({ intent: "FANTASMA" }, "ALTO");
  assertEquals(updates.buying_intent, "ALTO");
});

Deno.test("Lead: buildUpdates with invalid current intent falls back to BAJO", () => {
  const updates = buildUpdates({ intent: "UNKNOWN" }, "INVALID");
  assertEquals(updates.buying_intent, "BAJO");
});

Deno.test("Lead: buildUpdates ignores short city names", () => {
  const updates = buildUpdates({ ciudad: "MX", intent: "BAJO" }, "BAJO");
  assertEquals(updates.ciudad, undefined);
});

Deno.test("Lead: buildUpdates ignores invalid emails", () => {
  const updates = buildUpdates(
    { email: "notanemail", intent: "BAJO" },
    "BAJO",
  );
  assertEquals(updates.email, undefined);
});

Deno.test("Lead: CAPI fires when intent upgrades", () => {
  assertEquals(shouldFireCAPI("BAJO", "MEDIO", true, true), true);
  assertEquals(shouldFireCAPI("BAJO", "ALTO", true, true), true);
  assertEquals(shouldFireCAPI("MEDIO", "ALTO", true, true), true);
});

Deno.test("Lead: CAPI does not fire when intent stays or downgrades", () => {
  assertEquals(shouldFireCAPI("ALTO", "ALTO", true, true), false);
  assertEquals(shouldFireCAPI("ALTO", "BAJO", true, true), false);
  assertEquals(shouldFireCAPI("MEDIO", "BAJO", true, true), false);
});

Deno.test("Lead: CAPI does not fire without credentials", () => {
  assertEquals(shouldFireCAPI("BAJO", "ALTO", false, true), false);
  assertEquals(shouldFireCAPI("BAJO", "ALTO", true, false), false);
});

Deno.test("Lead: city normalization strips accents and lowercases", () => {
  assertEquals(normalizeCity("México"), "mexico");
  assertEquals(normalizeCity("CDMX"), "cdmx");
  assertEquals(normalizeCity("Querétaro"), "queretaro");
  assertEquals(normalizeCity("San José del Cabo"), "san jose del cabo");
});
