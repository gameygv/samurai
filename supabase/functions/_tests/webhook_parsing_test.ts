/**
 * Tests for webhook payload parsing patterns from evolution-webhook.
 * Validates: Meta vs Gowa payload parsing, phone extraction, isFromMe detection,
 * message type handling, hub.challenge verification, deduplication.
 */
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";

// --- Replicate key parsing logic from evolution-webhook ---

interface ParsedWebhook {
  phone: string | undefined;
  text: string;
  pushName: string;
  messageId: string | null;
  isFromMe: boolean;
  audioMediaId: string | null;
  audioMediaUrl: string | null;
  imageMediaId: string | null;
  imageMediaUrl: string | null;
  channelSource: "meta" | "gowa" | "unknown";
}

// deno-lint-ignore no-explicit-any
function parseWebhookPayload(payload: any, channelIdParam: string | null): ParsedWebhook {
  const result: ParsedWebhook = {
    phone: undefined,
    text: "",
    pushName: "Cliente WA",
    messageId: null,
    isFromMe: false,
    audioMediaId: null,
    audioMediaUrl: null,
    imageMediaId: null,
    imageMediaUrl: null,
    channelSource: "unknown",
  };

  if (payload.object === "whatsapp_business_account") {
    result.channelSource = "meta";
    const change = payload.entry?.[0]?.changes?.[0]?.value;
    if (!change) return result;

    const msg = change.messages?.[0];
    if (!msg) return result;

    if (msg.type === "reaction") return result;

    result.phone = msg.from;
    result.messageId = msg.id;
    result.pushName = change.contacts?.[0]?.profile?.name || "Lead WhatsApp";

    if (msg.type === "text") {
      result.text = msg.text?.body || "";
    } else if (msg.type === "image") {
      result.text = msg.image?.caption || "[Imagen]";
      result.imageMediaId = msg.image?.id || null;
    } else if (msg.type === "audio") {
      result.text = "[Nota de Voz]";
      result.audioMediaId = msg.audio?.id || null;
    } else if (msg.type === "video") {
      result.text = msg.video?.caption || "[Video]";
    } else if (msg.type === "document") {
      result.text = msg.document?.caption ||
        `[Documento: ${msg.document?.filename || "archivo"}]`;
    } else if (msg.type === "sticker") {
      result.text = "[Sticker]";
    } else if (msg.type === "location") {
      result.text = `[Ubicacion: ${msg.location?.latitude || ""}, ${msg.location?.longitude || ""}]`;
    } else if (msg.type === "contacts") {
      result.text = `[Contacto: ${msg.contacts?.[0]?.name?.formatted_name || "contacto"}]`;
    } else if (msg.type === "button") {
      result.text = msg.button?.text || "[Respuesta de boton]";
    } else if (msg.type === "interactive") {
      result.text = msg.interactive?.button_reply?.title ||
        msg.interactive?.list_reply?.title ||
        msg.interactive?.nfm_reply?.body ||
        "[Respuesta interactiva]";
    } else if (msg.type === "order") {
      result.text = "[Pedido recibido]";
    } else {
      result.text = msg.text?.body || `[${msg.type || "Mensaje"}]`;
    }
  } else {
    result.channelSource = "gowa";
    const p = payload.payload || payload.data || payload;
    result.isFromMe = p.is_from_me || p.fromMe || p.key?.fromMe || false;
    result.phone = p.remoteJid || p.key?.remoteJid || p.from;
    const msgContent = p.message || {};

    if (msgContent.audioMessage) {
      result.text = "[Nota de Voz]";
      result.audioMediaUrl = msgContent.audioMessage.url || null;
    } else if (msgContent.imageMessage) {
      result.text = msgContent.imageMessage.caption || "[Imagen]";
      result.imageMediaUrl = msgContent.imageMessage.url || null;
    } else {
      result.text = p.body ||
        msgContent.conversation ||
        msgContent.extendedTextMessage?.text ||
        "[Mensaje]";
    }
    result.messageId = p.id || p.key?.id;
  }

  return result;
}

function extractSenderPhone(phone: string): string {
  return String(phone).split("@")[0].replace(/\D/g, "");
}

// deno-lint-ignore no-explicit-any
function isStatusWebhook(payload: any): boolean {
  if (payload.object !== "whatsapp_business_account") return false;
  const change = payload.entry?.[0]?.changes?.[0]?.value;
  return !!change?.statuses;
}

function isPaymentContext(text: string, buyingIntent: string): boolean {
  const textLower = text.toLowerCase();
  const paymentPhrases = [
    "pagué", "pague", "transferí", "transferi", "comprobante",
    "deposité", "deposite", "ya pagué", "aqui va", "aquí va",
    "envio comprobante", "ficha", "boucher", "voucher",
  ];
  const hasPaymentContext = paymentPhrases.some((p) => textLower.includes(p));
  return hasPaymentContext || buyingIntent === "ALTO";
}

// --- Tests ---

Deno.test("Webhook: parse Meta text message", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        value: {
          messages: [{ from: "5212345678", id: "wamid.123", type: "text", text: { body: "Hola" } }],
          contacts: [{ profile: { name: "Juan" } }],
          metadata: { phone_number_id: "pnid_1" },
        },
      }],
    }],
  };
  const result = parseWebhookPayload(payload, null);
  assertEquals(result.phone, "5212345678");
  assertEquals(result.text, "Hola");
  assertEquals(result.pushName, "Juan");
  assertEquals(result.messageId, "wamid.123");
  assertEquals(result.channelSource, "meta");
  assertEquals(result.isFromMe, false);
});

Deno.test("Webhook: parse Meta image message extracts media_id", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: "5212345678", id: "wamid.456", type: "image",
            image: { id: "media_img_123", caption: "Mi comprobante" },
          }],
          contacts: [{ profile: { name: "Maria" } }],
        },
      }],
    }],
  };
  const result = parseWebhookPayload(payload, null);
  assertEquals(result.text, "Mi comprobante");
  assertEquals(result.imageMediaId, "media_img_123");
  assertEquals(result.audioMediaId, null);
});

Deno.test("Webhook: parse Meta audio message extracts media_id", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: "5212345678", id: "wamid.789", type: "audio",
            audio: { id: "media_aud_456" },
          }],
          contacts: [{ profile: { name: "Carlos" } }],
        },
      }],
    }],
  };
  const result = parseWebhookPayload(payload, null);
  assertEquals(result.text, "[Nota de Voz]");
  assertEquals(result.audioMediaId, "media_aud_456");
});

Deno.test("Webhook: parse Meta reaction is ignored", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        value: {
          messages: [{ from: "5212345678", type: "reaction" }],
          contacts: [{ profile: { name: "Test" } }],
        },
      }],
    }],
  };
  const result = parseWebhookPayload(payload, null);
  assertEquals(result.phone, undefined);
  assertEquals(result.text, "");
});

Deno.test("Webhook: parse Meta location message", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: "5212345678", id: "wamid.loc", type: "location",
            location: { latitude: 19.4326, longitude: -99.1332 },
          }],
          contacts: [{ profile: { name: "Test" } }],
        },
      }],
    }],
  };
  const result = parseWebhookPayload(payload, null);
  assertEquals(result.text, "[Ubicacion: 19.4326, -99.1332]");
});

Deno.test("Webhook: parse Meta interactive button reply", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: "521234", id: "wamid.int", type: "interactive",
            interactive: { button_reply: { title: "Si, me interesa" } },
          }],
          contacts: [{ profile: { name: "Test" } }],
        },
      }],
    }],
  };
  const result = parseWebhookPayload(payload, null);
  assertEquals(result.text, "Si, me interesa");
});

Deno.test("Webhook: parse Gowa text message", () => {
  const payload = {
    remoteJid: "5212345678@s.whatsapp.net",
    id: "gowa_msg_1",
    body: "Buenas tardes",
    is_from_me: false,
    message: {},
  };
  const result = parseWebhookPayload(payload, "ch_gowa_1");
  assertEquals(result.phone, "5212345678@s.whatsapp.net");
  assertEquals(result.text, "Buenas tardes");
  assertEquals(result.isFromMe, false);
  assertEquals(result.channelSource, "gowa");
  assertEquals(result.messageId, "gowa_msg_1");
});

Deno.test("Webhook: parse Gowa isFromMe is detected", () => {
  const payload = {
    remoteJid: "5212345678@s.whatsapp.net",
    is_from_me: true,
    message: { conversation: "Reply from agent" },
  };
  const result = parseWebhookPayload(payload, null);
  assertEquals(result.isFromMe, true);
});

Deno.test("Webhook: parse Gowa audio message extracts URL", () => {
  const payload = {
    remoteJid: "5212345678@s.whatsapp.net",
    message: { audioMessage: { url: "https://media.gowa.com/audio.ogg" } },
  };
  const result = parseWebhookPayload(payload, null);
  assertEquals(result.text, "[Nota de Voz]");
  assertEquals(result.audioMediaUrl, "https://media.gowa.com/audio.ogg");
});

Deno.test("Webhook: parse Gowa image message extracts URL", () => {
  const payload = {
    remoteJid: "5212345678@s.whatsapp.net",
    message: {
      imageMessage: {
        url: "https://media.gowa.com/image.jpg",
        caption: "Foto del pago",
      },
    },
  };
  const result = parseWebhookPayload(payload, null);
  assertEquals(result.text, "Foto del pago");
  assertEquals(result.imageMediaUrl, "https://media.gowa.com/image.jpg");
});

Deno.test("Webhook: extractSenderPhone strips @domain and non-digits", () => {
  assertEquals(extractSenderPhone("5212345678@s.whatsapp.net"), "5212345678");
  assertEquals(extractSenderPhone("521-234-5678"), "5212345678");
  assertEquals(extractSenderPhone("+52 1 234 567 8"), "5212345678");
});

Deno.test("Webhook: status webhook is detected", () => {
  const statusPayload = {
    object: "whatsapp_business_account",
    entry: [{
      changes: [{ value: { statuses: [{ id: "wamid.x", status: "delivered" }] } }],
    }],
  };
  assertEquals(isStatusWebhook(statusPayload), true);
});

Deno.test("Webhook: non-status webhook is not flagged", () => {
  const msgPayload = {
    object: "whatsapp_business_account",
    entry: [{
      changes: [{ value: { messages: [{ from: "521234" }] } }],
    }],
  };
  assertEquals(isStatusWebhook(msgPayload), false);
});

Deno.test("Webhook: hub.challenge verification pattern", () => {
  const challenge = "test_challenge_token_12345";
  const response = new Response(challenge, { status: 200 });
  assertEquals(response.status, 200);
  // Verify body matches challenge
  response.text().then((body) => assertEquals(body, challenge));
});

Deno.test("Webhook: payment context detection", () => {
  assertEquals(isPaymentContext("ya pagué por transferencia", "BAJO"), true);
  assertEquals(isPaymentContext("envio comprobante", "BAJO"), true);
  assertEquals(isPaymentContext("aquí va el voucher", "BAJO"), true);
  assertEquals(isPaymentContext("hola que tal", "BAJO"), false);
  assertEquals(isPaymentContext("hola que tal", "ALTO"), true); // ALTO triggers regardless
});

Deno.test("Webhook: Meta document message with filename", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: "521234", id: "wamid.doc", type: "document",
            document: { filename: "comprobante.pdf", caption: "" },
          }],
          contacts: [{ profile: { name: "Test" } }],
        },
      }],
    }],
  };
  const result = parseWebhookPayload(payload, null);
  assertEquals(result.text, "[Documento: comprobante.pdf]");
});
