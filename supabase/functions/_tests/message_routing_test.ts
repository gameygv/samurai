/**
 * Tests for message routing and phone normalization patterns from send-message-v3.
 * Validates: Mexico phone fix, provider routing, media type mapping, channel resolution chain.
 */
import {
  assertEquals,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";

// --- Replicate key logic from send-message-v3 ---

function cleanPhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  // Mexico fix: 521XXXXXXXXXX (13 digits) -> 52XXXXXXXXXX (12 digits)
  if (clean.startsWith("521") && clean.length === 13) {
    clean = "52" + clean.substring(3);
  }
  return clean;
}

function buildMetaEndpoint(instanceId: string): string {
  return `https://graph.facebook.com/v21.0/${instanceId}/messages`;
}

function buildMetaTextBody(phone: string, message: string): Record<string, unknown> {
  return {
    messaging_product: "whatsapp",
    to: phone,
    type: "text",
    text: { body: message },
  };
}

function buildMetaMediaBody(
  phone: string,
  mediaUrl: string,
  mediaType: string,
  caption: string,
): Record<string, unknown> {
  const typeMap: Record<string, string> = {
    image: "image",
    video: "video",
    audio: "audio",
    document: "document",
  };
  const metaType = typeMap[mediaType] || "document";
  return {
    messaging_product: "whatsapp",
    to: phone,
    type: metaType,
    [metaType]: { link: mediaUrl, caption },
  };
}

function buildGowaEndpoint(baseUrl: string, hasMedia: boolean, mediaType?: string): string {
  let endpoint = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  if (!hasMedia) return `${endpoint}/send/message`;
  if (mediaType === "image") return `${endpoint}/send/image`;
  return `${endpoint}/send/file`;
}

function buildEvolutionEndpoint(
  baseUrl: string,
  instanceId: string,
  hasMedia: boolean,
): string {
  let endpoint = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  if (hasMedia) return `${endpoint}/message/sendMedia/${instanceId}`;
  return `${endpoint}/message/sendText/${instanceId}`;
}

function resolveChannelId(
  explicitChannelId: string | undefined,
  leadChannelId: string | undefined,
  configDefault: string | undefined,
  firstActiveChannel: string | undefined,
): string | undefined {
  return explicitChannelId || leadChannelId || configDefault || firstActiveChannel;
}

function extractWamid(responseText: string): string | null {
  try {
    const metaRes = JSON.parse(responseText);
    return metaRes?.messages?.[0]?.id || null;
  } catch {
    return null;
  }
}

// --- Tests ---

Deno.test("Phone: Mexico 521 prefix is corrected to 52", () => {
  assertEquals(cleanPhone("5211234567890"), "521234567890");
});

Deno.test("Phone: non-Mexico numbers are unchanged", () => {
  assertEquals(cleanPhone("1234567890"), "1234567890");
  assertEquals(cleanPhone("5512345678"), "5512345678");
});

Deno.test("Phone: strips non-digit characters", () => {
  assertEquals(cleanPhone("+52-1-123-456-7890"), "521234567890");
  assertEquals(cleanPhone("(55) 1234-5678"), "5512345678");
});

Deno.test("Phone: 52 prefix without extra 1 is unchanged", () => {
  assertEquals(cleanPhone("521234567890"), "521234567890");
  // 12 digits starting with 52 — not 13 digits with 521
});

Deno.test("Meta: endpoint uses instance_id", () => {
  assertEquals(
    buildMetaEndpoint("12345"),
    "https://graph.facebook.com/v21.0/12345/messages",
  );
});

Deno.test("Meta: text body has correct structure", () => {
  const body = buildMetaTextBody("521234567890", "Hello");
  assertEquals(body.messaging_product, "whatsapp");
  assertEquals(body.to, "521234567890");
  assertEquals(body.type, "text");
  assertEquals((body.text as Record<string, string>).body, "Hello");
});

Deno.test("Meta: media body maps types correctly", () => {
  const imageBody = buildMetaMediaBody("5212345", "https://img.com/a.jpg", "image", "Look!");
  assertEquals(imageBody.type, "image");
  assertEquals((imageBody.image as Record<string, string>).link, "https://img.com/a.jpg");
  assertEquals((imageBody.image as Record<string, string>).caption, "Look!");

  const unknownBody = buildMetaMediaBody("5212345", "https://f.com/doc.pdf", "unknown", "");
  assertEquals(unknownBody.type, "document");
});

Deno.test("Gowa: endpoint routing for text vs media", () => {
  assertEquals(buildGowaEndpoint("https://api.gowa.com/", false), "https://api.gowa.com/send/message");
  assertEquals(buildGowaEndpoint("https://api.gowa.com/", true, "image"), "https://api.gowa.com/send/image");
  assertEquals(buildGowaEndpoint("https://api.gowa.com/", true, "document"), "https://api.gowa.com/send/file");
});

Deno.test("Evolution: endpoint routing for text vs media", () => {
  assertEquals(
    buildEvolutionEndpoint("https://evo.com", "inst1", false),
    "https://evo.com/message/sendText/inst1",
  );
  assertEquals(
    buildEvolutionEndpoint("https://evo.com", "inst1", true),
    "https://evo.com/message/sendMedia/inst1",
  );
});

Deno.test("Channel resolution: explicit ID takes priority", () => {
  assertEquals(resolveChannelId("ch1", "ch2", "ch3", "ch4"), "ch1");
});

Deno.test("Channel resolution: falls back through chain", () => {
  assertEquals(resolveChannelId(undefined, "ch2", "ch3", "ch4"), "ch2");
  assertEquals(resolveChannelId(undefined, undefined, "ch3", "ch4"), "ch3");
  assertEquals(resolveChannelId(undefined, undefined, undefined, "ch4"), "ch4");
  assertEquals(resolveChannelId(undefined, undefined, undefined, undefined), undefined);
});

Deno.test("Wamid: extracts from Meta response", () => {
  const metaResponse = JSON.stringify({
    messages: [{ id: "wamid.abc123" }],
  });
  assertEquals(extractWamid(metaResponse), "wamid.abc123");
});

Deno.test("Wamid: returns null for non-Meta response", () => {
  assertEquals(extractWamid("plain text response"), null);
  assertEquals(extractWamid('{"status": "ok"}'), null);
});
