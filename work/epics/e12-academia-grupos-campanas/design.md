# E12: Design — Grupos WhatsApp & Campañas en Academia

## Gemba (estado actual)

### Lo que existe
- **Academia** (`/academic`): CRUD de cursos con AI OCR, catálogo de niveles/sedes/profesores, grid/list views
- **Campañas** (`/campaigns`): Página independiente con selección de contactos, envío masivo individual (en vivo + programado), templates con variables `{nombre}` y `{ciudad}`
- **Canales GOWA**: Tabla `whatsapp_channels` con `edith` y `anahi`, auth Basic + X-Device-Id
- **Grupos WA**: Filtrados en webhook (`@g.us` → descartados). No hay funcionalidad de grupos

### API GOWA verificada (2026-04-22)
| Endpoint | Propósito | Response clave |
|---|---|---|
| `GET /user/my/groups` | Listar grupos del canal | `results.data[].{JID, Name, Participants}` |
| `GET /group/participants?group_id={JID}` | Miembros con teléfono | `results.participants[].{phone_number, display_name, is_admin}` |
| `POST /send/message` con JID `@g.us` | Enviar a grupo | Mismo patrón que mensajes individuales |

## Target Components

### Base de datos

```sql
-- 1. Vincular grupo a curso (1:1)
ALTER TABLE courses
  ADD COLUMN whatsapp_group_jid TEXT,
  ADD COLUMN whatsapp_channel_id UUID REFERENCES whatsapp_channels(id);

-- 2. Junction contacto ↔ grupo WA
CREATE TABLE contact_whatsapp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  group_jid TEXT NOT NULL,
  group_name TEXT,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  channel_id UUID NOT NULL REFERENCES whatsapp_channels(id),
  phone_number TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contact_id, group_jid)
);

CREATE INDEX idx_cwg_contact ON contact_whatsapp_groups(contact_id);
CREATE INDEX idx_cwg_group ON contact_whatsapp_groups(group_jid);
CREATE INDEX idx_cwg_course ON contact_whatsapp_groups(course_id);

-- RLS
ALTER TABLE contact_whatsapp_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read" ON contact_whatsapp_groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert" ON contact_whatsapp_groups
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete" ON contact_whatsapp_groups
  FOR DELETE TO authenticated USING (true);
```

### Edge Functions

**`list-whatsapp-groups`**
- Input: `channel_id` (UUID)
- Lookup: `whatsapp_channels` → `api_url`, `api_key`, `instance_id`
- Call: `GET {api_url}/user/my/groups` con `Authorization: Basic {api_key}`, `X-Device-Id: {instance_id}`
- Output: `{ groups: [{ jid, name, participant_count }] }`

**`sync-group-members`**
- Input: `channel_id`, `group_jid`, `course_id` (opcional)
- Call: `GET {api_url}/group/participants?group_id={group_jid}` con headers
- Para cada participante: buscar en `contacts` por `telefono` (normalizar formato)
- Upsert en `contact_whatsapp_groups`
- Output: `{ synced: N, matched: N, unmatched: N, members: [...] }`

**`send-group-message`**
- Input: `channel_id`, `group_jid`, `message`
- Lookup canal → `api_url`, `api_key`, `instance_id`
- Call: `POST {api_url}/send/message` con body `{ phone: group_jid, message }`
- Log en `conversaciones` con metadata `{ type: 'group_campaign', course_id }`
- Output: `{ success: true, message_id }`

### Frontend

**Flujo de vinculación (nuevo dialog):**
```
[Editor Curso] → click "Vincular Grupo WA"
  → Dialog: Selector de canal (dropdown de whatsapp_channels donde provider='gowa')
    → Carga grupos del canal (list-whatsapp-groups)
    → Lista con nombre y # participantes
    → Click "Vincular" → update courses SET whatsapp_group_jid, whatsapp_channel_id
    → Auto-trigger sync-group-members
    → Mostrar resultado: X contactos encontrados de Y miembros
```

**Migración de Campañas a Academia:**
- Mover contenido de `Campaigns.tsx` a un tab/sección dentro de `AcademicCatalog.tsx`
- Agregar tabs: "Catálogo" | "Campañas"
- En Campañas: mantener la funcionalidad existente + nuevo tipo "Grupo de Curso"
- Eliminar `/campaigns` del sidebar, agregar redirect en router
- `MassMessageDialog.tsx` se reutiliza tal cual

**Campaña a grupo de curso:**
```
[Academia > Campañas] → click "Nueva Campaña a Grupo"
  → Selector de curso (solo los que tienen grupo vinculado)
  → Muestra: nombre grupo, # miembros, # contactos cruzados
  → Textarea mensaje (con templates)
  → Botón "Enviar al Grupo"
  → Llama send-group-message
  → Resultado: enviado ✓
```

## Key Contracts

### Phone number normalization
GOWA devuelve `phone_number` como dígitos (ej. `5214771172736`). `contacts.telefono` puede tener formatos variados. La normalización debe:
1. Limpiar `+`, espacios, guiones
2. Para México: manejar `521...` (GOWA) vs `52...` (posible en BD)

### Seguridad
- Edge functions protegidas con JWT (service role para sync/send)
- RLS en `contact_whatsapp_groups` permite lectura a authenticated
- No exponer `api_key` de GOWA al frontend — todo vía edge functions

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `POST /send/message` con group JID no funcione | Baja | Alto | Verificar con grupo de prueba antes de integrar en UI |
| Normalización de teléfonos falle en edge cases | Media | Medio | Logging detallado, mostrar unmatched al usuario |
| Performance al sincronizar grupos grandes (100+ miembros) | Baja | Bajo | Paginación no necesaria — GOWA retorna todo de una vez |
