# Manual Tecnico Completo: SAMURAI CRM + Meta CAPI

**Version:** 2.0
**Fecha:** 8 de abril de 2026
**Autor:** Equipo SAMURAI (The Elephant Bowl)
**Stack:** Supabase Edge Functions (Deno/TypeScript) + GoWA v8.3 + Meta Graph API v21.0
**Estado:** Produccion activa, optimizado para GoWA, preparado para Meta API oficial

> Este manual refleja el estado mas actual de la integracion Meta CAPI a abril 2026,
> incluyendo las mejores practicas de Meta Conversions API, Graph API v21.0, y las
> particularidades de operar sin la API oficial de WhatsApp Business.

---

## 1. Que es SAMURAI y que problema resuelve

### Para novatos

Imagina que tienes un negocio y pagas anuncios en Facebook/Instagram para que la gente te escriba por WhatsApp. Facebook te cobra por cada clic. Pero Facebook no sabe que pasa DESPUES del clic — no sabe si la persona compro, si solo pregunto, o si se fue.

SAMURAI lee las conversaciones de WhatsApp, entiende lo que pasa (usando inteligencia artificial), y le "cuenta" a Facebook exactamente que paso: "esta persona pregunto precios", "esta otra quiere pagar", "esta ya pago". Con esa informacion, Facebook busca MAS personas parecidas a las que SI compran, y menos parecidas a las que solo preguntan y se van.

**Resultado:** Tus anuncios traen mejores clientes, no solo curiosos.

### Para tecnicos

SAMURAI es un CRM con motor de NLP que:
1. Recibe webhooks de WhatsApp (via GoWA o Meta Cloud API)
2. Normaliza mensajes, crea/actualiza leads, guarda conversaciones en Supabase
3. Analiza cada conversacion con GPT-4o-mini para extraer datos estructurados (ciudad, email, intent, lead_score)
4. Mapea transiciones del embudo de ventas a eventos estandar de Meta Conversions API
5. Envia eventos server-to-server a Meta Graph API v21.0 con PII hasheado (SHA-256)

La arquitectura es provider-agnostic: el mismo flujo CAPI funciona identicamente con GoWA (WhatsApp Web) o con la Meta Cloud API oficial.

---

## 2. Arquitectura del sistema

```
[WhatsApp del agente (telefono fisico)]
        |
        | (WhatsApp Web protocol)
        |
    [GoWA v8.3] ← VPS con Docker, multi-device
        |
        | (webhook HTTP POST)
        |
    [evolution-webhook] ← Supabase Edge Function (Deno)
        |
   +----+----+----+
   |         |         |
[analyze-  [transcribe- [process-samurai-
 leads]     audio]       response]
   |
   | (si intent sube)
   |
[meta-capi-sender] → Meta Graph API v21.0 /events
        |
   [meta_capi_events] ← tabla de auditoria en Supabase
```

### Componentes y su funcion

| Componente | Que hace | Por que es necesario |
|-----------|---------|---------------------|
| **GoWA v8.3** | Gateway WhatsApp Web multi-device. Recibe/envia mensajes via REST API y webhooks | Permite conectar WhatsApp sin la API oficial de Meta. Soporta multiples telefonos en un solo servidor |
| **evolution-webhook** | Normaliza webhooks de GoWA y Meta. Crea leads, guarda mensajes, detecta media, rutea por dispositivo | Punto de entrada unico que abstrae el provider. Ambos formatos (GoWA y Meta) se normalizan aqui |
| **analyze-leads** | IA analiza conversacion, extrae datos del cliente, clasifica etapa del embudo, dispara eventos CAPI | El cerebro del sistema. Convierte texto no estructurado en datos accionables para Meta |
| **meta-capi-sender** | Hashea PII con SHA-256, normaliza (acentos, espacios), envia evento a Graph API v21.0 | Cumple con los requisitos de privacidad de Meta y maximiza Event Match Quality |
| **transcribe-audio** | Descarga audio (2-step para GoWA), transcribe con OpenAI Whisper, actualiza conversacion | Sin esto, las notas de voz serian "[Nota de Voz]" y la IA no podria analizarlas |
| **process-capi-purchase** | Procesa eventos Purchase y LeadLost encolados por trigger de DB | Permite que CUALQUIER punto de la UI dispare un evento CAPI al mover un lead a COMPRADO/PERDIDO |

---

## 3. Flujo completo de un mensaje (paso a paso)

### 3.1 Mensaje entrante del cliente

**Ejemplo real:** Un cliente escribe "Hola, cuanto cuesta el taller de cuencoterapia?" al WhatsApp del agente Edith.

```
1. [Cliente] → envia mensaje a WhatsApp de Edith
2. [WhatsApp] → sincroniza con GoWA (WhatsApp Web protocol)
3. [GoWA] → envia webhook POST a evolution-webhook:
   {
     "device_id": "5214771172736@s.whatsapp.net",  ← telefono de Edith
     "event": "message",
     "payload": {
       "body": "Hola, cuanto cuesta el taller de cuencoterapia?",
       "from": "5215551234567@s.whatsapp.net",      ← telefono del cliente
       "from_name": "Maria Lopez",
       "id": "3EB037332DAC181950B066",
       "is_from_me": false
     }
   }
4. [evolution-webhook]:
   a. Detecta device_id → busca canal por phone_number → encuentra "Edith"
   b. Extrae telefono del cliente: 5215551234567
   c. Busca lead existente → no existe → crea lead nuevo:
      - nombre: "Maria Lopez" (de from_name)
      - telefono: 5215551234567
      - channel_id: canal de Edith
      - assigned_to: agente Edith (por channel_agent_map)
      - buying_intent: BAJO
   d. Guarda mensaje en conversaciones (emisor: CLIENTE)
   e. Guarda raw payload en metadata.raw (para reprocesamiento futuro)
   f. Filtra: no es grupo (@g.us), no es vacio → ok, analizar
   g. Dispara analyze-leads (async, no bloquea la respuesta)

5. [analyze-leads]:
   a. Lee prompt de Cerebro Core (prompt_analista_datos de app_config)
   b. Lee ultimos 10 mensajes de la conversacion
   c. Envia a GPT-4o-mini:
      "CONVERSACION:
       CLIENTE: Hola, cuanto cuesta el taller de cuencoterapia?"
   d. IA responde:
      {"nombre": "Maria", "apellido": "Lopez", "email": null,
       "ciudad": null, "estado": null, "cp": null,
       "servicio_interes": "taller de cuencoterapia",
       "intent": "MEDIO", "lead_score": 55}
   e. Intent subio de BAJO a MEDIO → enviar CAPI
   f. Evento CAPI: ViewContent (interes en producto)

6. [meta-capi-sender]:
   a. Hashea PII: telefono, nombre, apellido (SHA-256, sin acentos)
   b. POST a https://graph.facebook.com/v21.0/{pixel_id}/events
   c. Guarda en meta_capi_events (payload + respuesta + copia sin hashear)
```

### 3.2 Mensaje saliente del asesor (desde telefono)

**Ejemplo:** Edith responde desde su WhatsApp: "Hola Maria! El taller cuesta $3,500. Te interesa?"

```
1. [Edith] → responde desde WhatsApp en su telefono
2. [GoWA] → detecta is_from_me: true, envia webhook
3. [evolution-webhook]:
   a. is_from_me = true → usa chat_id (cliente) en vez de from (Edith)
   b. Busca lead por telefono del cliente → encuentra "Maria Lopez"
   c. Guarda mensaje como emisor: HUMANO (no CLIENTE, no IA)
   d. Guarda raw payload en metadata.raw
   e. NO muta el lead (no cambia last_message_at, no resetea followup)
   f. NO activa IA ni CAPI
   g. Retorna ok
```

**Por que no analizar mensajes del asesor?** Porque:
- Los datos del asesor no son datos del cliente (no queremos extraer la ciudad del asesor)
- Enviaria CAPI events falsos (el asesor menciona precios, no el cliente)
- Pero SI se guarda el mensaje para que la proxima vez que el cliente escriba, la IA vea la conversacion completa (asesor + cliente)

### 3.3 Mensajes que NO se procesan

| Tipo | Que pasa | Por que |
|------|---------|--------|
| Mensajes de grupo (@g.us) | Se ignoran (return ok) | Crearian leads fantasma de grupos de WhatsApp |
| Mensajes vacios/[Mensaje]/[Sticker] | Se guardan pero NO se analizan | Gastar tokens de OpenAI sin valor. El sticker no tiene texto que analizar |
| Eventos message.ack (confirmaciones de lectura) | Se ignoran | No son mensajes, son notificaciones de entrega |
| Eventos message.reaction (reacciones) | Se ignoran | No aportan datos para CAPI |
| Leads en estado COMPRADO | analyze-leads los ignora | Ya se gano la venta, no re-analizar |

---

## 4. Eventos CAPI: que enviamos y por que

### 4.1 Tabla de eventos

| Etapa | Evento Meta | Tipo | Senales de deteccion | Ejemplo |
|-------|-------------|------|---------------------|---------|
| **Lead nuevo** | `Lead` | Estandar | Primer mensaje del cliente | "Hola, quiero info" |
| **Interes real** | `ViewContent` | Estandar | Pregunta precios, horarios, fechas | "Cuanto cuesta?", "Cuando es el proximo?" |
| **Quiere comprar** | `InitiateCheckout` | Estandar | Pide datos de pago, quiere inscribirse | "Como pago?", "Me aparto un lugar" |
| **Venta cerrada** | `Purchase` | Estandar | Agente confirma venta en Pipeline | Agente arrastra lead a "Ganado" |
| **Lead perdido** | `LeadLost` | Custom | Agente descarta lead en Pipeline | Agente arrastra lead a "Perdido" |

### 4.2 Por que ESTOS eventos y no otros

**Eventos estandar vs custom:**
Meta tiene dos tipos de eventos. Los ESTANDAR (`Lead`, `ViewContent`, `InitiateCheckout`, `Purchase`, `CompleteRegistration`, etc.) son los que Meta ENTIENDE. Su algoritmo esta entrenado durante anos para optimizar campanas basandose en estos eventos. Cuando le dices "aqui hubo un Purchase", Meta sabe exactamente que significa y busca mas personas con ese perfil.

Los eventos CUSTOM (`LeadLost`, `QualifiedLead`, etc.) Meta los registra pero NO los usa para optimizar automaticamente. Sirven para analisis y audiencias, pero el algoritmo no los entiende igual.

**Por que estos 5 y no otros:**

- **Lead** (estandar): Meta necesita saber cuando alguien llega. Sin este evento, Meta no puede medir cuantos leads genera cada anuncio. Lo enviamos la PRIMERA vez que se analiza un lead nuevo.

- **ViewContent** (estandar): En e-commerce, ViewContent significa "vio un producto". En nuestro caso, significa "mostro interes real" — pregunto precios, horarios, detalles. Meta usa esto para encontrar personas que no solo hacen clic sino que INVESTIGAN antes de comprar.

- **InitiateCheckout** (estandar): Significa "quiere pagar". En e-commerce es cuando alguien llena el carrito. Para nosotros es cuando el cliente pide datos bancarios, dice "quiero inscribirme", o pregunta como pagar. Meta usa esto para encontrar personas con intencion de compra REAL.

- **Purchase** (estandar): La venta cerrada. EL EVENTO MAS VALIOSO. Sin esto, Meta no puede optimizar para ventas reales y se queda optimizando para "leads baratos" que nunca compran. Lo disparamos via trigger de base de datos cuando el agente mueve el lead a COMPRADO.

- **LeadLost** (custom): Cuando un lead se pierde. No es estandar pero es util para construir audiencias NEGATIVAS — excluir de futuras campanas a personas que ya dijeron que no. Esto ahorra dinero en publicidad.

**Por que NO usamos otros:**
- `CompleteRegistration`: No hay formulario de registro en nuestro flujo. La "inscripcion" es una conversacion natural.
- `AddToCart`: No vendemos productos fisicos con carrito.
- `Schedule`: Podriamos usarlo si detectaramos citas agendadas, pero hoy no lo hacemos.

### 4.3 Estructura completa de un evento

```json
{
  "data": [{
    "event_name": "ViewContent",
    "event_time": 1744163500,
    "event_id": "samurai_550e8400-e29b-41d4-a716-446655440000_ViewContent_1744163500",
    "action_source": "chat",
    "user_data": {
      "ph": ["a1b2c3d4e5f6..."],
      "fn": ["b2c3d4e5f6a1..."],
      "ln": ["c3d4e5f6a1b2..."],
      "em": ["d4e5f6a1b2c3..."],
      "ct": ["e5f6a1b2c3d4..."],
      "st": ["f6a1b2c3d4e5..."],
      "zp": ["01234567890a..."],
      "country": ["4d3cb45e6a..."],
      "external_id": ["5e6f7a8b9c..."]
    },
    "custom_data": {
      "source": "samurai_auto",
      "content_name": "taller cuencoterapia nivel 1",
      "content_category": "talleres_cuencoterapia",
      "funnel_stage": "MEDIO",
      "lead_score": 55,
      "agent_id": "7c325d88-505e-4da3-b4d2-3947d87a8feb",
      "origin_channel": "whatsapp",
      "psychographic_segment": "busca sanacion espiritual",
      "main_pain": "estres laboral"
    }
  }]
}
```

**Explicacion campo por campo:**

**event_name:** El tipo de evento. Meta lo usa para decidir que accion ocurrio.

**event_time:** Unix timestamp (segundos desde 1970). Meta rechaza eventos con mas de 7 dias de antiguedad.

**event_id:** Identificador unico para deduplicacion. Formato: `samurai_{lead_uuid}_{evento}_{timestamp}`. Si el mismo evento se envia dos veces (por retry del webhook), Meta lo cuenta una sola vez gracias a este ID.

**action_source:** De donde viene la accion. Usamos `"chat"` porque la conversion ocurre dentro de una conversacion de mensajeria. Meta tambien acepta `"system_generated"`, `"website"`, `"phone_call"`, `"email"`, etc.

---

## 5. Hasheo de PII y Event Match Quality (EMQ)

### 5.1 Que es EMQ y por que importa

**Para novatos:** EMQ (Event Match Quality) es una calificacion de 0 a 10 que Meta le da a tus eventos. Mide que tan bien puede Meta identificar a la persona que hizo la accion. Si envias solo un telefono, Meta puede identificar al ~60% de las personas. Si envias telefono + email + nombre + ciudad, puede identificar al ~90%.

**Para tecnicos:** EMQ es la tasa de match entre los identificadores hasheados que envias via CAPI y los perfiles de usuarios de Meta. Un EMQ bajo (< 4) significa que la mayoria de tus eventos no se atribuyen a usuarios reales, lo que degrada la optimizacion de campanas.

**Meta recomienda EMQ > 6.0.** Nosotros estimamos ~6-7 con los datos que enviamos.

### 5.2 Como hasheamos PII

Antes de enviar datos personales a Meta, DEBEMOS hashearlos con SHA-256. Meta lo exige por privacidad. El proceso en `meta-capi-sender`:

```
1. Recibir valor crudo: "Tepoztlan"
2. Lowercase: "tepoztlan"  (Meta lo exige)
3. Trim: "tepoztlan"       (quitar espacios)
4. Quitar acentos: "tepoztlan"  (NFD decomposition + strip diacritics)
5. Quitar + y espacios: "tepoztlan"
6. SHA-256: "a7f3b2c1d4e5..."
7. Enviar el hash, NUNCA el valor original
```

**Paso critico: quitar acentos (paso 4).** Esto es algo que implementamos el 8 de abril 2026. Sin esto, "Tepoztlan" y "Tepoztlán" generaban hashes DIFERENTES, y Meta no podia hacer match. Ahora ambos generan el mismo hash.

**Implementacion (meta-capi-sender lineas 9-11):**
```typescript
let clean = String(value).toLowerCase().trim();
clean = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Quitar acentos
clean = clean.replace(/\+/g, '').replace(/\s/g, '');
```

### 5.3 Campos que enviamos y su impacto en EMQ

| Campo | Clave | Siempre disponible? | Impacto EMQ | Como lo obtenemos |
|-------|-------|--------------------:|-------------|-------------------|
| Telefono | `ph` | Si (100%) | +3.0 | Del numero de WhatsApp |
| Nombre | `fn` | Casi siempre (85%) | +1.0 | pushName de WhatsApp o IA extrae del chat |
| Apellido | `ln` | A veces (40%) | +0.5 | IA extrae del chat |
| Email | `em` | Ocasional (20%) | +1.5 | IA extrae cuando el cliente lo menciona |
| Ciudad | `ct` | Frecuente (50%) | +0.5 | IA extrae del chat |
| Estado | `st` | Cuando hay ciudad (50%) | +0.2 | IA infiere de la ciudad (Tepoztlan → Morelos) |
| CP | `zp` | Raro (10%) | +0.2 | IA extrae si el cliente lo menciona |
| Pais | `country` | Si (100%) | +0.1 | "mx" fijo (todos los leads son de Mexico) |
| External ID | `external_id` | Si (100%) | +0.5 | UUID del lead en Samurai |

---

## 6. El Analista CAPI (Cerebro Core)

### 6.1 Que es

Es el prompt de inteligencia artificial que controla COMO se analizan las conversaciones. Es el "cerebro" que decide si un lead esta en etapa BAJO, MEDIO o ALTO, y que datos extraer.

**Se configura desde la interfaz:** Cerebro Core > Tab 4: Analista CAPI
**Clave en base de datos:** `prompt_analista_datos` (tabla `app_config`)

### 6.2 Como funciona

1. Cuando llega un mensaje, `evolution-webhook` dispara `analyze-leads`
2. `analyze-leads` lee el prompt de `app_config` (clave: `prompt_analista_datos`)
3. Si el prompt esta vacio, usa un fallback hardcodeado con las mismas reglas
4. Combina el prompt con los ultimos 10 mensajes de la conversacion
5. Envia a GPT-4o-mini con `response_format: { type: "json_object" }`
6. Parsea la respuesta JSON y actualiza el lead

### 6.3 El prompt actual (abril 2026)

```
Eres el Analista de Datos de Samurai. Tu mision es leer el historial del chat
y extraer informacion del cliente en JSON exacto para alimentar nuestro CRM
y la Conversions API (CAPI) de Meta. NUNCA inventes lo que no sepas, usa null
si no estas seguro.

1. Logica de Eventos de Meta (event_name):
   Lead: El usuario acaba de escribir por primera vez pidiendo informacion.
   ViewContent: El usuario ya dio su ciudad, mostro interes real y encaja
   en el perfil (pregunta precios, horarios, fechas, disponibilidad).
   InitiateCheckout: El usuario esta en la fase de registro, dio su correo
   o pidio datos bancarios, quiere pagar o inscribirse.

2. Logica de Pipeline de Ventas (pipeline_stage):
   BAJO: primer contacto generico, "info por favor", solo saluda.
   MEDIO: pregunta por precios, horarios, fechas, ubicacion, requisitos.
   ALTO: quiere pagar, pide datos bancarios, quiere inscribirse, apartar lugar.

3. Lead Score (lead_score): numero de 0 a 100.
   0-20: Solo saludo, sin interes claro.
   21-40: Pidio informacion general.
   41-60: Pregunto precios o detalles especificos.
   61-80: Mostro intencion de compra, dio datos personales.
   81-100: Quiere pagar, envio comprobante, pidio datos bancarios.

Responde UNICAMENTE con este JSON:
{"nombre": null, "apellido": null, "email": null, "ciudad": null,
 "estado": null, "cp": null, "servicio_interes": null,
 "intent": "BAJO", "lead_score": 10}
```

### 6.4 Por que estas reglas y no otras

Las senales estan basadas en el comportamiento real de compradores de talleres de cuencoterapia observado en The Elephant Bowl. Las categorias (BAJO/MEDIO/ALTO) corresponden a etapas universales del embudo de ventas, pero las senales especificas ("precios", "horarios", "como pago") son las que REALMENTE indican progresion en este tipo de negocio.

El lead_score agrega granularidad: dos leads en MEDIO pueden tener scores de 45 y 65 — ambos preguntan precios, pero uno ademas dio su ciudad. Meta puede usar esta diferencia para encontrar perfiles mas precisos.

### 6.5 Como editarlo

1. Ir a la interfaz de SAMURAI: Cerebro Core
2. Seleccionar Tab 4: "Analista CAPI"
3. Editar el prompt
4. Clic en "Aplicar Cambios"
5. Los cambios aplican inmediatamente al proximo mensaje que se analice

**Advertencia:** Si borras el prompt completamente, el sistema usa el fallback hardcodeado. No se rompe, pero pierdes personalizacion.

---

## 7. Descarga de media con GoWA (proceso de 2 pasos)

### 7.1 El problema

Cuando un cliente envia un audio o imagen por WhatsApp, GoWA envia en el webhook algo como:
```json
{"audio": "statics/media/1775706739-uuid.ogg; codecs=opus"}
```

Esa ruta es un PLACEHOLDER. Si intentas descargar `https://gowa.poesis.net/statics/media/xxx.ogg` obtienes 404. GoWA NO guarda archivos en disco automaticamente.

### 7.2 La solucion (proceso de 2 pasos)

**Paso 1: Triggear la descarga**
```
GET https://gowa.poesis.net/message/{message_id}/download?phone={sender_phone}
Headers: Authorization: Basic xxx, X-Device-Id: developer
```

GoWA descarga el archivo de los servidores de WhatsApp y lo guarda temporalmente. Responde con la ruta REAL:
```json
{"results": {"file_path": "statics/media/5215551234567/2026-04-08/uuid.ogg"}}
```

**Paso 2: Descargar el binario**
```
GET https://gowa.poesis.net/statics/media/5215551234567/2026-04-08/uuid.ogg
Headers: Authorization: Basic xxx, X-Device-Id: developer
```

Retorna los bytes del archivo.

### 7.3 Implementacion en SAMURAI

`transcribe-audio` implementa este proceso con:
- 3 reintentos con backoff (2s, 4s, 6s) para el Paso 1
- Headers de autenticacion (Basic Auth + X-Device-Id) en ambos pasos
- Despues de descargar, actualiza `conversaciones.metadata.mediaUrl` con la URL real
- Envia el audio a OpenAI Whisper para transcripcion
- Actualiza el texto del mensaje con la transcripcion

### 7.4 Diferencia con Meta API oficial

Con la API oficial, la descarga es de 1 paso:
```
GET https://graph.facebook.com/v21.0/{media_id}
Authorization: Bearer {token}
→ retorna {url: "https://..."}
GET {url}
→ retorna bytes
```

No necesita el trigger previo. Es mas rapido y confiable.

---

## 8. Modos de canal y control CAPI

### 8.1 ai_mode (comportamiento de la IA)

| Modo | La IA responde? | Analiza chat? | Transcribe audio? | Envia CAPI? |
|------|:-:|:-:|:-:|:-:|
| `on` | Si | Si | Si | Si |
| `monitor` | **No** | Si | Si | Si |
| `off` | No | No | No | No |

**monitor** es el modo clave para nuestro caso: los agentes atienden desde el telefono, SAMURAI observa silenciosamente, extrae datos, y envia eventos a Meta CAPI. La IA NUNCA responde en modo monitor, ni siquiera si alguien la activa manualmente — el modo del canal tiene prioridad absoluta.

### 8.2 capi_enabled (toggle CAPI por canal)

| Valor | Efecto |
|-------|--------|
| `true` (default) | Envia eventos a Meta CAPI |
| `false` | NO envia eventos (para canales de prueba/desarrollo) |

**Caso de uso:** El canal "Developer (Gamey)" tiene `capi_enabled: false` para hacer pruebas sin contaminar los datos de Meta.

---

## 9. GoWA vs Meta API Oficial: comparativa detallada

### 9.1 Tabla comparativa por funcionalidad

| Funcionalidad | GoWA (actual) | Meta API Oficial (futuro) | Notas |
|-------------|:---:|:---:|-------|
| **Recibir mensajes del cliente** | Si | Si | Ambos via webhook, diferente formato |
| **Recibir mensajes del asesor (isFromMe)** | **Si** | **No** | GoWA captura TODO. Meta API solo recibe lo que envias TU por API |
| **Enviar mensajes** | Si (REST API) | Si (Graph API) | Diferente formato y auth |
| **Enviar templates** | No | **Si** | Templates son exclusivos de la API oficial |
| **Mensajes masivos** | Riesgoso (baneo) | **Si** (autorizados) | Con API oficial es legal y escalable |
| **Descarga de media** | 2 pasos (lento) | 1 paso (directo) | GoWA requiere trigger previo |
| **Estabilidad** | Media (WhatsApp Web) | **Alta** (infra de Meta) | GoWA depende de la sesion web |
| **Formato telefono Mexico** | 521xxx (con "1") | 52xxx (sin "1") | Ya manejamos la correccion por provider |
| **Costo por mensaje** | Gratis | $0.01-0.10 USD/msg | Depende del tipo y pais |
| **Riesgo de baneo** | Si (uso no oficial) | **No** | API oficial es el camino autorizado |
| **Multi-device** | Si (1 servidor, N phones) | 1 numero por WABA | GoWA es mas flexible aqui |
| **Atribucion (ctwa_clid)** | **No** | **Si** | Click-to-WhatsApp Click ID |
| **CAPI events** | **Identico** | **Identico** | El flujo CAPI NO depende del provider |
| **Analisis IA** | **Identico** | **Identico** | analyze-leads es provider-agnostic |

### 9.2 Que funciona IGUAL con ambos (no cambia nada)

- **Todo el flujo CAPI:** analyze-leads, meta-capi-sender, triggers DB, process-capi-purchase
- **El prompt del Analista CAPI** (Cerebro Core)
- **El hasheo de PII y EMQ**
- **Los eventos (Lead, ViewContent, InitiateCheckout, Purchase, LeadLost)**
- **El lead_score y la extraccion de datos**
- **La UI completa** (Inbox, Pipeline, Cerebro Core, etc.)

### 9.3 Que MEJORARIA con la API oficial

**1. Atribucion de campana (ctwa_clid):**
Hoy: Meta no sabe que anuncio trajo cada lead (GoWA no recibe UTMs ni click IDs).
Con API oficial: Cada webhook incluye `ctwa_clid` que identifica exactamente que anuncio genero el clic. Esto permite:
- Saber que anuncio genera mas ventas (no solo clics)
- Enviar `campaign_id` y `ad_id` en custom_data de CAPI
- Que Meta optimice por anuncio, no solo por campana

**2. Estabilidad:**
Hoy: Si el telefono pierde conexion o WhatsApp Web se desconecta, GoWA deja de recibir mensajes temporalmente.
Con API oficial: La conexion es directa con los servidores de Meta. No depende del telefono.

**3. Mensajes masivos y templates:**
Hoy: No podemos enviar campanas masivas por WhatsApp sin riesgo de baneo.
Con API oficial: Templates pre-aprobados por Meta + mensajes masivos autorizados. Util para remarketing.

**4. Descarga de media en 1 paso:**
Hoy: 2 pasos con retry (puede tardar 6-10 segundos).
Con API oficial: 1 paso directo (~1-2 segundos).

### 9.4 Que PERDERIAMOS con la API oficial

**1. Mensajes del asesor desde telefono (isFromMe):**
Hoy: GoWA captura TODO lo que pasa en el chat, incluyendo lo que el asesor escribe desde su telefono. Esto permite que la IA vea la conversacion completa.
Con API oficial: Solo recibes lo que envias TU por la API. Si el asesor responde desde el telefono, Meta no te notifica. Tendrias que forzar a los asesores a usar la UI de SAMURAI para responder, o perder esa visibilidad.

**2. Multi-device flexible:**
Hoy: 3 telefonos en 1 servidor, cada uno con su canal.
Con API oficial: 1 numero por cuenta WABA. Necesitarias 3 cuentas WABA.

### 9.5 Como migrar (cuando llegue la aprobacion)

El `evolution-webhook` YA maneja ambos providers:
```typescript
if (payload.object === 'whatsapp_business_account') {
  // → Meta Cloud API (ya implementado)
} else {
  // → GoWA (lo que usamos hoy)
}
```

**Pasos para migrar:**
1. Crear canal en SAMURAI con `provider: 'meta'`
2. Configurar webhook en Meta Developer Portal → apuntar a evolution-webhook
3. Poner `instance_id` = Phone Number ID de Meta
4. Poner `api_key` = Bearer token de Meta
5. Listo. El flujo CAPI, analisis, y UI funcionan sin cambios.

### 9.6 Impacto en optimizacion de campanas: GoWA vs Meta API Oficial

Esta es la pregunta mas importante: **los resultados de mis campanas de Facebook serian MEJORES con la API oficial?**

**Respuesta corta: En la MAYORIA de los aspectos, NO hay diferencia. La calidad de los eventos CAPI que enviamos es IDENTICA con ambos providers.** Pero hay 2 areas donde la API oficial si aporta una ventaja medible.

#### Lo que es IDENTICO (no cambia los resultados de campanas)

| Aspecto CAPI | GoWA | Meta API | Por que es igual |
|-------------|------|----------|-----------------|
| **Eventos enviados** | Lead, ViewContent, InitiateCheckout, Purchase, LeadLost | Los mismos | El flujo CAPI es provider-agnostic. analyze-leads y meta-capi-sender no saben ni les importa de donde vino el mensaje |
| **Calidad de datos (EMQ)** | ~6-7/10 | ~6-7/10 | Los datos los extrae la IA del CHAT, no del provider. Si el cliente dice "soy de Tepoztlan", la IA lo extrae igual con GoWA o con Meta API |
| **Lead score** | 0-100 | 0-100 | Lo calcula GPT-4o-mini basado en la conversacion, no en el provider |
| **Datos psicograficos** | Los mismos | Los mismos | Vienen del analisis IA, no del webhook |
| **Hasheo de PII** | SHA-256 identico | SHA-256 identico | Mismo proceso, misma funcion |
| **Velocidad de envio** | Casi real-time (~2-5s) | Casi real-time (~1-3s) | La diferencia de 1-2 segundos no impacta la optimizacion de Meta |
| **Deduplicacion** | event_id unico | event_id unico | Misma estrategia |

**Conclusion:** Si tu unica preocupacion es la calidad de los eventos CAPI para optimizar campanas, GoWA y Meta API producen EXACTAMENTE los mismos resultados. Meta recibe los mismos eventos, con los mismos datos, hasheados igual. El algoritmo de Meta no sabe (ni le importa) de donde vinieron.

#### Lo que SI mejora con Meta API Oficial (impacta campanas)

**1. Atribucion de campana (IMPACTO ALTO)**

Hoy (GoWA): Cuando un cliente hace clic en tu anuncio de Facebook y abre WhatsApp, Meta pierde el rastro. SAMURAI envia "hubo un Purchase" pero Meta no sabe QUE anuncio lo genero. Meta distribuye el credito de forma estadistica (modeled attribution), no deterministica.

Con API oficial: El webhook incluye `ctwa_clid` (Click-to-WhatsApp Click ID), un identificador unico que conecta el clic del anuncio con la conversacion. Cuando SAMURAI envia un evento CAPI, puede incluir ese click_id y Meta sabe EXACTAMENTE que anuncio genero esa venta.

**Impacto real:** Meta puede optimizar POR ANUNCIO, no solo por campana. Si tienes 10 anuncios y 3 generan el 80% de las ventas, Meta automaticamente gasta mas presupuesto en esos 3. Hoy, sin atribucion, Meta distribuye mas parejo.

**Nota:** Esto NO afecta la calidad de los EVENTOS, solo la capacidad de Meta de saber CUAL ANUNCIO funciona mejor. Los eventos siguen siendo igual de valiosos para construir audiencias y optimizar en general.

**2. Volumen y confiabilidad (IMPACTO MEDIO)**

Hoy (GoWA): Si el telefono del agente se queda sin internet o WhatsApp Web se desconecta, GoWA deja de recibir mensajes. Esos mensajes no se analizan y los eventos CAPI no se envian. Cuando se reconecta, se procesan los nuevos pero los del hueco se pierden.

Con API oficial: La conexion es servidor-a-servidor. No depende del telefono del agente. Los webhooks llegan siempre.

**Impacto real:** Con GoWA podrías perder un 5-10% de eventos CAPI por desconexiones. Con API oficial, virtualmente 0%. Para Meta, recibir 90 eventos de 100 vs 100 de 100 no es una diferencia dramatica, pero a largo plazo el modelo se entrena mejor con datos completos.

#### Lo que EMPEORARIA con Meta API Oficial

**Visibilidad de la conversacion completa (IMPACTO EN CALIDAD IA)**

Hoy (GoWA): SAMURAI ve TODOS los mensajes — del cliente Y del asesor. Cuando la IA analiza, tiene el contexto completo:
```
ASESOR: El taller cuesta $3,500, incluye materiales
CLIENTE: Ok, como pago?
```
La IA ve que el asesor ya dio el precio y el cliente respondio queriendo pagar → intent ALTO con alta confianza.

Con API oficial: Solo veriamos lo que el cliente escribe y lo que enviemos nosotros por API. Si el asesor responde desde el telefono (sin usar la API), esa respuesta es invisible:
```
CLIENTE: Ok, como pago?
```
Sin el contexto del asesor, la IA tiene menos informacion para clasificar. Podria dar un lead_score mas bajo o clasificar MEDIO en vez de ALTO.

**Esto se mitiga si:** Los asesores responden desde la UI de SAMURAI (que usa la API) en vez de desde el telefono. Pero eso cambia el flujo de trabajo del agente.

#### Resumen de impacto en campanas

| Aspecto | GoWA | Meta API | Diferencia real |
|---------|------|----------|-----------------|
| Calidad de eventos CAPI | 10/10 | 10/10 | **Ninguna** |
| EMQ (match quality) | ~6-7 | ~6-7 | **Ninguna** |
| Atribucion por anuncio | No | Si | **Significativa** (saber que anuncio vende mas) |
| Completitud de datos (sin huecos) | 90-95% | ~100% | **Menor** (Meta tolera huecos) |
| Contexto de conversacion para IA | Completo (asesor+cliente) | Parcial (solo si usan API) | **GoWA es mejor aqui** |
| Audiencias y lookalikes | Identico | Identico | **Ninguna** |
| Optimizacion general de campana | Buena | Buena + atribucion | **Marginal excepto atribucion** |

---

## 10. Seguridad y privacidad

### 10.1 Datos personales (PII)

- **NUNCA** se envian datos personales sin hashear a Meta CAPI
- SHA-256 se aplica a: telefono, nombre, apellido, email, ciudad, estado, CP, pais, external_id
- Antes de hashear se normaliza: lowercase, trim, quitar acentos, quitar espacios y +
- Una copia SIN hashear se guarda en `meta_capi_events.unhashed_data` para auditoria interna

### 10.2 Referencias a herramientas

- **NO** enviamos "gowa", "go-whatsapp", "whatsapp-web" ni ninguna referencia a herramientas no oficiales en payloads de Meta CAPI
- `origin_channel` se envia como `"whatsapp"` (generico, correcto para ambos providers)
- Esto previene cualquier flag por parte de Meta al detectar uso de herramientas no autorizadas

### 10.3 Datos en base de datos

- `raw_payload` se guarda en `metadata.raw` de cada mensaje (hasta 4000 chars)
- Esto permite reprocesar mensajes si GoWA cambia su formato
- Los raw payloads contienen datos personales — la tabla `conversaciones` debe tener RLS configurado

---

## 11. Raw Payload Storage (resiliencia)

### Por que lo hacemos

El 8 de abril de 2026 descubrimos que GoWA envia audios en un formato diferente al esperado (`payload.audio` en vez de `message.audioMessage.url`). Si hubieramos guardado los payloads originales, podriamos haber reprocesado los mensajes que se perdieron.

### Como funciona

Cada mensaje (cliente y asesor) guarda el JSON completo del webhook en `conversaciones.metadata.raw`:
```json
{
  "mediaUrl": "https://gowa.poesis.net/statics/media/...",
  "mediaType": "audio",
  "raw": "{\"device_id\":\"521...\",\"event\":\"message\",\"payload\":{...}}"
}
```

Se trunca a 4000 caracteres para no sobrecargar la DB. Esto cubre el 99% de los mensajes (los que exceden son solo mensajes con media inline base64, que son raros).

---

## 12. Lead Score

### Que es

Un numero de 0 a 100 que representa la probabilidad de que un lead compre. Se calcula con IA en cada analisis de conversacion.

### Escala

| Rango | Significado | Ejemplo |
|-------|------------|---------|
| 0-20 | Solo saludo | "Hola" |
| 21-40 | Pidio info general | "Que talleres tienen?" |
| 41-60 | Pregunto precios/detalles | "Cuanto cuesta el nivel 1?" |
| 61-80 | Dio datos personales, intencion de compra | "Soy de CDMX, me interesa el de mayo" |
| 81-100 | Quiere pagar | "Como pago? Aqui mi comprobante" |

### Donde se usa

- Se guarda en `leads.lead_score`
- Se envia a Meta CAPI en `custom_data.lead_score`
- Se muestra en la UI (Pipeline, LeadRow)
- Meta puede usarlo para encontrar personas con mayor probabilidad de compra

---

## 13. Deduplicacion de eventos

### El problema

Un webhook puede llegar 2 veces (retry), o analyze-leads puede correr 2 veces para el mismo mensaje. Sin deduplicacion, Meta contaria la conversion dos veces.

### Como lo resolvemos

**1. event_id unico:**
```
samurai_{lead_uuid}_{event_name}_{unix_timestamp}
```
Meta deduplica automaticamente eventos con el mismo event_id.

**2. capi_lead_event_sent_at:**
El campo `leads.capi_lead_event_sent_at` se marca la primera vez que se envia un evento Lead. Si analyze-leads corre de nuevo y el lead sigue en BAJO, no vuelve a enviar Lead.

**3. Intent monotonicamente creciente:**
Solo se envia CAPI cuando el intent SUBE (BAJO→MEDIO, MEDIO→ALTO). Si se mantiene igual o baja, no se envia nada. Esto previene eventos duplicados por re-analisis.

---

## 14. Por que este es el analisis mas actual (abril 2026)

### Versiones de APIs

- **Meta Graph API v21.0** (la mas reciente estable a abril 2026, actualizada desde v19.0 el 8 de abril)
- **GoWA v8.3** (ultima version con soporte multi-device)
- **OpenAI GPT-4o-mini** (modelo optimizado para analisis JSON rapido y barato)
- **OpenAI Whisper** (modelo de transcripcion de audio mas preciso disponible)

### Best practices aplicadas (fuentes: abril 2026)

- Normalizacion de PII con remocion de acentos antes de hasheo (Meta requirement 2025+)
- Eventos estandar sobre custom events para optimizacion de campanas
- EMQ > 6.0 como objetivo (Meta recommendation 2025+)
- Deduplicacion via event_id (Meta best practice desde v17.0)
- action_source: "chat" para conversiones en mensajeria
- No incluir referencias a herramientas no oficiales en payloads

### Que podria cambiar en el futuro

- Meta podria depreciar Graph API v21.0 (tipicamente dan 2 anos)
- Nuevos eventos estandar podrian agregarse
- OpenAI podria sacar modelos mas baratos/rapidos que GPT-4o-mini
- La aprobacion de Meta API oficial podria llegar (habilita atribucion y templates)

---

## 15. Pendientes y roadmap

| Item | Prioridad | Impacto | Cuando |
|------|-----------|---------|--------|
| **Atribucion de campana (UTMs/ctwa_clid)** | Alta | Meta sabe que anuncio genero cada venta | Cuando llegue Meta API oficial |
| **Valor real en Purchase** | Media | Meta optimiza por valor de venta, no solo por evento | Cuando se integre sistema de pagos |
| **lead_score en MemoryPanel** | Baja | Mostrar score en el panel de chat | Proximo sprint UI |
| **First agent reply time** | Baja | Metrica de calidad de servicio | Nice-to-have |
| **Migracion a Meta API oficial** | Cuando aprueben | Estabilidad + templates + atribucion | Preparado, solo agregar canal |
