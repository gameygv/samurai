/**
 * Tests for system prompt assembly patterns from get-samurai-context.
 * Validates: config parsing, media context building, lead memory, handoff rules,
 * WooCommerce checkout link generation, date filtering.
 */
import {
  assertEquals,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";

// --- Replicate key logic from get-samurai-context ---

function getConfig(
  configs: Array<{ key: string; value: unknown }>,
  key: string,
  def = "",
): string {
  const found = configs.find((c) => c.key === key);
  return (found?.value as string) || def;
}

function buildActiveLeadMemory(lead: {
  nombre?: string;
  email?: string;
  ciudad?: string;
}): string {
  const nombre = lead.nombre && !lead.nombre.includes("Nuevo")
    ? lead.nombre
    : "NO PROPORCIONADO";
  const email = lead.email || "NO PROPORCIONADO";
  const ciudad = lead.ciudad || "NO PROPORCIONADA";
  return `Nombre conocido: ${nombre}\nEmail capturado: ${email}\nCiudad: ${ciudad}`;
}

function buildWcCheckoutLink(
  wcUrl: string,
  checkoutPath: string,
  wcId: string,
): string {
  const cleanUrl = wcUrl.replace(/\/$/, "");
  let path = checkoutPath;
  if (!path.startsWith("/")) path = "/" + path;
  return `${cleanUrl}${path}?add-to-cart=${wcId}`;
}

function buildMediaContext(
  assets: Array<{
    title: string;
    url: string;
    ai_instructions: string;
    sede?: string;
    nivel?: string;
    profesor?: string;
    presale_price?: number;
    presale_ends_at?: string;
    normal_price?: number;
    friday_concert?: boolean;
    ocr_content?: string;
  }>,
  today: string,
): string {
  let context = "";
  assets.forEach((m) => {
    let meta = `- ${m.title}: ${m.ai_instructions} -> <<MEDIA:${m.url}>>`;
    if (m.sede) meta += ` | Sede: ${m.sede}`;
    if (m.nivel) meta += ` | Nivel: ${m.nivel}`;
    if (m.profesor) meta += ` | Profesor: ${m.profesor}`;
    if (m.presale_price && m.presale_ends_at && m.presale_ends_at >= today) {
      meta += ` | PREVENTA: $${m.presale_price} (hasta ${m.presale_ends_at})`;
    } else if (m.normal_price) {
      meta += ` | Precio: $${m.normal_price}`;
    }
    if (m.friday_concert) meta += ` | Incluye concierto del viernes`;
    context += meta + "\n";
    if (m.ocr_content) {
      context += `  DETALLE DEL POSTER: ${m.ocr_content.substring(0, 500)}\n`;
    }
  });
  return context;
}

function shouldAutoClose(closingConfigRaw: string): boolean {
  if (!closingConfigRaw) return true;
  try {
    const config = JSON.parse(closingConfigRaw);
    return config.auto_close !== false;
  } catch {
    return true;
  }
}

// --- Tests ---

Deno.test("Context: getConfig returns value when found", () => {
  const configs = [
    { key: "prompt_alma", value: "Soul of samurai" },
    { key: "openai_api_key", value: "sk-xxx" },
  ];
  assertEquals(getConfig(configs, "prompt_alma"), "Soul of samurai");
});

Deno.test("Context: getConfig returns default when not found", () => {
  const configs = [{ key: "other", value: "val" }];
  assertEquals(getConfig(configs, "missing", "default_val"), "default_val");
  assertEquals(getConfig(configs, "missing"), "");
});

Deno.test("Context: getConfig returns default when value is empty", () => {
  const configs = [{ key: "empty", value: "" }];
  assertEquals(getConfig(configs, "empty", "fallback"), "fallback");
});

Deno.test("Context: lead memory shows name when not 'Nuevo'", () => {
  const memory = buildActiveLeadMemory({
    nombre: "Juan Garcia",
    email: "juan@mail.com",
    ciudad: "CDMX",
  });
  assertEquals(memory.includes("Juan Garcia"), true);
  assertEquals(memory.includes("juan@mail.com"), true);
  assertEquals(memory.includes("CDMX"), true);
});

Deno.test("Context: lead memory hides name containing 'Nuevo'", () => {
  const memory = buildActiveLeadMemory({ nombre: "Nuevo Lead 123" });
  assertEquals(memory.includes("NO PROPORCIONADO"), true);
  assertEquals(memory.includes("Nuevo Lead"), false);
});

Deno.test("Context: lead memory handles missing fields", () => {
  const memory = buildActiveLeadMemory({});
  assertEquals(memory.includes("NO PROPORCIONADO"), true);
  assertEquals(memory.includes("NO PROPORCIONADA"), true);
});

Deno.test("Context: WooCommerce checkout link is built correctly", () => {
  assertEquals(
    buildWcCheckoutLink("https://shop.com/", "/checkout/", "42"),
    "https://shop.com/checkout/?add-to-cart=42",
  );
  assertEquals(
    buildWcCheckoutLink("https://shop.com", "checkout/", "100"),
    "https://shop.com/checkout/?add-to-cart=100",
  );
});

Deno.test("Context: media context includes presale when active", () => {
  const assets = [{
    title: "Taller Salsa",
    url: "https://img.com/salsa.jpg",
    ai_instructions: "Envia este poster cuando pregunten por salsa",
    presale_price: 500,
    presale_ends_at: "2099-12-31",
    normal_price: 800,
    sede: "CDMX",
  }];
  const context = buildMediaContext(assets, "2026-04-08");
  assertEquals(context.includes("PREVENTA: $500"), true);
  assertEquals(context.includes("Sede: CDMX"), true);
});

Deno.test("Context: media context shows normal price when presale expired", () => {
  const assets = [{
    title: "Taller Bachata",
    url: "https://img.com/bachata.jpg",
    ai_instructions: "Poster de bachata",
    presale_price: 500,
    presale_ends_at: "2020-01-01",
    normal_price: 800,
  }];
  const context = buildMediaContext(assets, "2026-04-08");
  assertEquals(context.includes("PREVENTA"), false);
  assertEquals(context.includes("Precio: $800"), true);
});

Deno.test("Context: media context includes OCR content truncated", () => {
  const longOcr = "A".repeat(600);
  const assets = [{
    title: "Poster",
    url: "https://img.com/p.jpg",
    ai_instructions: "Send this",
    ocr_content: longOcr,
  }];
  const context = buildMediaContext(assets, "2026-04-08");
  assertEquals(context.includes("DETALLE DEL POSTER:"), true);
  // OCR should be truncated to 500 chars
  const ocrLine = context.split("\n").find((l) => l.includes("DETALLE DEL POSTER:"));
  const ocrContent = ocrLine!.replace("  DETALLE DEL POSTER: ", "");
  assertEquals(ocrContent.length, 500);
});

Deno.test("Context: media context includes friday concert flag", () => {
  const assets = [{
    title: "Festival",
    url: "https://img.com/fest.jpg",
    ai_instructions: "Festival poster",
    friday_concert: true,
  }];
  const context = buildMediaContext(assets, "2026-04-08");
  assertEquals(context.includes("Incluye concierto del viernes"), true);
});

Deno.test("Context: auto close is true by default", () => {
  assertEquals(shouldAutoClose(""), true);
  assertEquals(shouldAutoClose("invalid json"), true);
});

Deno.test("Context: auto close respects explicit false", () => {
  assertEquals(shouldAutoClose('{"auto_close": false}'), false);
});

Deno.test("Context: auto close is true when explicitly true", () => {
  assertEquals(shouldAutoClose('{"auto_close": true}'), true);
});
