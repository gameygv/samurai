# Manual de Optimizacion Meta CAPI - SAMURAI CRM

## 1. Que es y para que sirve

SAMURAI es un CRM que analiza conversaciones de WhatsApp en tiempo real para:
1. Extraer datos del cliente (nombre, ciudad, email, interes, etapa de compra)
2. Enviar eventos enriquecidos a Meta Conversions API (CAPI)
3. Permitir que Meta optimice campanas de Facebook/Instagram para conseguir leads que SI compran

### El problema que resolvemos

Sin CAPI, Meta solo sabe: "alguien hizo clic en tu anuncio y abrio WhatsApp". No sabe si esa persona pregunto precios, si queria pagar, o si al final compro. Meta optimiza para clics baratos, no para ventas reales.

Con SAMURAI + CAPI, Meta recibe la historia completa: "esta persona pregunto precios (ViewContent), luego pidio datos de pago (InitiateCheckout), y finalmente pago (Purchase)". Con esa informacion, Meta busca MAS personas con ese patron de comportamiento.

---

## 2. Arquitectura del sistema

```
[WhatsApp del agente]
        |
    [GoWA v8.3] ← gateway WhatsApp Web multi-device
        |
    [evolution-webhook] ← Supabase Edge Function
        |
   +---------+---------+
   |         |         |
[analyze-  [transcribe- [process-samurai-
 leads]     audio]       response]
   |
[meta-capi-sender] → Meta Graph API /events
```

### Componentes

| Componente | Funcion |
|-----------|---------|
| GoWA | Recibe/envia mensajes de WhatsApp via Web protocol |
| evolution-webhook | Normaliza webhooks (Gowa o Meta), crea leads, guarda mensajes |
| analyze-leads | IA analiza conversacion, extrae datos, clasifica embudo, dispara CAPI |
| meta-capi-sender | Hashea PII con SHA-256, envia evento a Meta Graph API |
| transcribe-audio | Descarga audio (2-step para Gowa), transcribe con Whisper |
| process-capi-purchase | Procesa eventos Purchase/LeadLost encolados por trigger DB |

---

## 3. Flujo completo de un mensaje

### Mensaje entrante del cliente

1. Cliente envia mensaje a WhatsApp del agente
2. GoWA recibe via WhatsApp Web y envia webhook a `evolution-webhook`
3. El webhook:
   - Identifica el dispositivo por `device_id` → busca canal por `phone_number`
   - Extrae texto, pushName (`from_name`), media
   - Crea lead si es nuevo (con agente asignado por canal)
   - Guarda mensaje en `conversaciones`
   - Dispara `analyze-leads` (async)
4. `analyze-leads`:
   - Lee ultimos 10 mensajes (cliente + asesor)
   - Envia a GPT-4o-mini con el prompt de Cerebro Core (`prompt_analista_datos`)
   - Extrae: nombre, apellido, email, ciudad, estado, CP, servicio_interes, intent
   - Si el intent subio → envia evento CAPI correspondiente
   - Si es lead nuevo → envia evento Lead

### Mensaje saliente del asesor (desde telefono)

1. Asesor responde desde WhatsApp en su telefono
2. GoWA detecta `is_from_me: true` y envia webhook
3. El webhook:
   - Usa `chat_id` (el cliente) en vez de `from` (el dispositivo) para buscar el lead
   - Guarda mensaje como emisor `HUMANO`
   - NO muta el lead, NO activa IA, NO envia CAPI

---

## 4. Eventos CAPI y mapeo al embudo

### Tabla de eventos

| Etapa SAMURAI | Evento Meta | Senales de deteccion | Cuando se dispara |
|--------------|-------------|---------------------|-------------------|
| Lead nuevo | `Lead` | Primer mensaje del cliente | Primera vez que analyze-leads procesa un lead |
| Interes (MEDIO) | `ViewContent` | Pregunta precios, horarios, fechas, disponibilidad | buying_intent sube de BAJO a MEDIO |
| Alta intencion (ALTO) | `InitiateCheckout` | Quiere pagar, pide datos bancarios, quiere inscribirse | buying_intent sube a ALTO |
| Venta cerrada | `Purchase` | Agente mueve lead a COMPRADO en Pipeline | Trigger DB `trg_lead_comprado` |
| Lead perdido | `LeadLost` | Agente mueve lead a PERDIDO en Pipeline | Trigger DB `trg_lead_comprado` |

### Por que estos eventos y no otros

- **Lead, ViewContent, InitiateCheckout, Purchase** son eventos ESTANDAR de Meta. Su algoritmo esta entrenado para optimizar con ellos. Custom events sirven para analisis pero NO para optimizacion de campanas.
- **LeadLost** es custom pero necesario para construir audiencias negativas (excluir de campanas).
- NO usamos `CompleteRegistration` porque en nuestro flujo no hay un formulario de registro — el "registro" es una conversacion natural por chat.

### Estructura del evento CAPI

```json
{
  "event_name": "ViewContent",
  "event_time": 1744163500,
  "event_id": "samurai_{lead_id}_ViewContent_{timestamp}",
  "action_source": "chat",
  "user_data": {
    "ph": ["sha256_hash_telefono"],
    "fn": ["sha256_hash_nombre"],
    "ln": ["sha256_hash_apellido"],
    "em": ["sha256_hash_email"],
    "ct": ["sha256_hash_ciudad"],
    "st": ["sha256_hash_estado"],
    "zp": ["sha256_hash_cp"],
    "country": ["sha256_hash_mx"],
    "external_id": ["sha256_hash_lead_uuid"]
  },
  "custom_data": {
    "source": "samurai_auto",
    "content_name": "taller cuencoterapia nivel 1",
    "content_category": "talleres_cuencoterapia",
    "funnel_stage": "MEDIO",
    "lead_score": 65,
    "agent_id": "uuid_agente",
    "origin_channel": "whatsapp",
    "psychographic_segment": "busca sanacion",
    "main_pain": "estres laboral"
  }
}
```

### Campos user_data (PII hasheado)

| Campo | Origen | Para que |
|-------|--------|---------|
| `ph` | lead.telefono | Match principal (mejor EMQ) |
| `fn` | IA extrae del chat | Match secundario |
| `ln` | IA extrae del chat | Match secundario |
| `em` | IA extrae del chat | Match cruzado con cuenta Meta |
| `ct` | IA extrae del chat | Segmentacion geografica |
| `st` | IA infiere de ciudad | Segmentacion geografica |
| `zp` | IA extrae del chat | Precision geografica |
| `country` | "mx" fijo | Obligatorio |
| `external_id` | lead.id (UUID) | Deduplicacion cross-device |

### Campos custom_data (no hasheados)

| Campo | Valor | Para que |
|-------|-------|---------|
| `funnel_stage` | BAJO/MEDIO/ALTO/COMPRADO/PERDIDO | Meta sabe la etapa exacta |
| `lead_score` | 0-100 | Priorizar leads de mayor calidad |
| `content_name` | Servicio especifico que interesa | Meta sabe que producto convierte mejor |
| `content_category` | Categoria general | Agrupacion de productos |
| `origin_channel` | "whatsapp" | Distinguir canales (no mencionar herramienta) |
| `agent_id` | UUID del asesor | Segmentar performance por vendedor |
| `psychographic_segment` | Perfil psicologico | Audiencias lookalike por motivacion |
| `main_pain` | Dolor principal | Audiencias por necesidad |

---

## 5. El Analista CAPI (Cerebro Core)

### Que es

Es el prompt de IA que controla como se analizan las conversaciones. Se configura en:
**Cerebro Core > Tab 4: Analista CAPI** (clave: `prompt_analista_datos`)

### Como funciona

1. `analyze-leads` lee el prompt desde `app_config` (editable en UI)
2. Lo combina con los ultimos 10 mensajes de la conversacion
3. Envia a GPT-4o-mini con `response_format: json_object`
4. Parsea la respuesta y actualiza el lead + dispara CAPI

### Fallback

Si `prompt_analista_datos` esta vacio en app_config, usa un prompt hardcodeado de fallback con las mismas reglas.

### Como editarlo

Ir a Cerebro Core > Analista CAPI > editar el prompt > clic "Aplicar Cambios".
Los cambios aplican inmediatamente al proximo mensaje que se analice.

---

## 6. Descarga de media con GoWA (proceso de 2 pasos)

GoWA NO guarda archivos de media en disco automaticamente. La ruta en el webhook (`statics/media/xxx.ogg`) es un placeholder que siempre da 404.

### Proceso correcto

```
Paso 1: GET /message/{id}/download?phone={sender_phone}
  Headers: Authorization + X-Device-Id
  Respuesta: { file_path: "statics/media/{phone}/{date}/{file}" }

Paso 2: GET /{file_path}
  Headers: Authorization + X-Device-Id
  Respuesta: bytes binarios del archivo
```

### Implementacion en SAMURAI

`transcribe-audio` implementa este proceso con 3 reintentos (2s, 4s, 6s backoff).
Despues de descargar, actualiza `conversaciones.metadata.mediaUrl` con la URL real para que el chatview pueda reproducir el audio.

---

## 7. Modos de canal

Cada canal de WhatsApp tiene un `ai_mode`:

| Modo | Comportamiento | CAPI |
|------|---------------|------|
| `on` | IA responde automaticamente | Si (todos los eventos) |
| `monitor` | Registra todo, analiza, transcribe, pero NO responde | Si (todos los eventos) |
| `off` | Solo guarda mensaje, nada mas | No |

Y un `capi_enabled`:
- `true` (default): envia eventos a Meta CAPI
- `false`: NO envia eventos (para canales de prueba/desarrollo)

---

## 8. GoWA vs Meta API Oficial: ventajas y desventajas

### GoWA (situacion actual)

**Ventajas:**
- No requiere aprobacion de Meta (funciona inmediatamente)
- Gratis (sin costo por mensaje)
- Multi-device: multiples telefonos en un solo servidor
- Los agentes siguen usando WhatsApp normalmente desde su telefono
- Captura mensajes salientes del asesor (isFromMe)

**Desventajas:**
- Basado en WhatsApp Web (puede desconectarse)
- Meta podria bloquear el numero si detecta uso no humano
- No soporta templates oficiales ni mensajes masivos autorizados
- Media requiere proceso de 2 pasos (mas lento)
- Sin garantia de estabilidad a largo plazo
- Formato de telefono con "1" (521xxx) diferente a Meta (52xxx)

### Meta API Oficial (futuro)

**Ventajas:**
- Estabilidad garantizada por Meta
- Templates de mensajes oficiales
- Mensajes masivos autorizados (notificaciones, campanas)
- Media directo via Graph API (1 paso)
- Mejor atribucion: `ctwa_clid` para cerrar el loop de Click-to-WhatsApp
- Sin riesgo de baneo

**Desventajas:**
- Requiere aprobacion de Meta (puede tardar semanas/meses)
- Costo por mensaje (modelo de pricing de Meta)
- No captura mensajes del asesor desde el telefono (solo lo enviado por API)
- Requiere BSP (Business Solution Provider) o acceso directo

### Migracion: que cambia y que no

| Aspecto | Cambia | No cambia |
|---------|--------|-----------|
| Webhook recepcion | Si (formato Meta vs Gowa) | |
| Envio de mensajes | Si (Graph API vs Gowa REST) | |
| Analisis de conversacion | | No (mismo analyze-leads) |
| Eventos CAPI | | No (mismo meta-capi-sender) |
| Prompt Analista | | No (mismo prompt_analista_datos) |
| Triggers DB | | No (mismos triggers Purchase/LeadLost) |
| UI/Frontend | | No (abstraido por provider) |

El `evolution-webhook` ya maneja ambos providers: el branch `if (payload.object === 'whatsapp_business_account')` es para Meta, el `else` es para Gowa. Agregar un canal Meta es crear un nuevo registro en `whatsapp_channels` con `provider: 'meta'`.

---

## 9. Event Match Quality (EMQ)

Meta usa EMQ para medir que tan bien puede identificar a la persona en su plataforma. Rango: 0-10. Meta recomienda >6.

### Como lo maximizamos

| Campo | Impacto en EMQ | Estado en SAMURAI |
|-------|---------------|------------------|
| Telefono (ph) | ALTO | Siempre disponible |
| Email (em) | ALTO | IA lo extrae del chat cuando el cliente lo da |
| Nombre (fn) | MEDIO | IA lo extrae o viene del pushName de WhatsApp |
| Apellido (ln) | MEDIO | IA lo extrae |
| Ciudad (ct) | BAJO-MEDIO | IA lo extrae |
| Estado (st) | BAJO | IA lo infiere de la ciudad |
| CP (zp) | BAJO | IA lo extrae si el cliente lo menciona |
| Pais (country) | BAJO | "mx" fijo |
| External ID | MEDIO | UUID del lead (estable, cross-device) |

### Estimacion de EMQ actual: ~6-7/10
- Telefono siempre presente (+3)
- Nombre casi siempre (+1.5)
- Ciudad frecuente (+1)
- Email ocasional (+0.5-1)
- External ID siempre (+0.5)

---

## 10. Deduplicacion de eventos

Cada evento tiene un `event_id` unico:
```
samurai_{lead_uuid}_{event_name}_{unix_timestamp}
```

Esto previene:
- Webhook retries que dupliquen eventos
- Re-analisis que envie el mismo evento dos veces
- El campo `capi_lead_event_sent_at` en leads previene duplicar el evento Lead inicial

---

## 11. Seguridad y privacidad

- **PII hasheado**: Todos los datos personales se hashean con SHA-256 antes de enviar a Meta
- **Sin "gowa" en CAPI**: No enviamos referencias a herramientas de terceros en los payloads de Meta
- **capi_enabled por canal**: Canales de prueba no contaminan datos de Meta
- **Unhashed audit copy**: Se guarda una copia sin hashear en `meta_capi_events.unhashed_data` para auditoria interna

---

## 12. Pendientes y roadmap

| Item | Prioridad | Impacto |
|------|-----------|---------|
| Atribucion de campana (UTMs del primer mensaje) | Alta | Meta sabe que anuncio genero cada venta |
| Raw payload storage | Media | Resiliencia ante cambios de GoWA |
| Valor real en Purchase (monto de pago) | Media | Meta optimiza por valor, no solo por evento |
| Migracion a Meta API oficial | Cuando aprueben | Estabilidad + templates + masivos |
