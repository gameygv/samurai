# E12: Scope — Grupos WhatsApp & Campañas en Academia

## Objective

Integrar la gestión de grupos de WhatsApp y campañas como funcionalidad nativa de la sección Academia, permitiendo vincular grupos a cursos, sincronizar miembros con el CRM, y enviar campañas directamente a grupos de inscritos.

## In Scope

- Schema BD: columnas en `courses`, tabla `contact_whatsapp_groups`
- Edge function `list-whatsapp-groups` (proxy a GOWA `/user/my/groups`)
- Edge function `sync-group-members` (GOWA `/group/participants` → cruce con leads/contactos)
- Edge function `send-group-message` (envío a group JID vía GOWA)
- UI: Dialog de vinculación de grupo en editor de curso (selector canal → grupos → vincular)
- UI: Migrar sección Campañas dentro de Academia (eliminar del sidebar)
- UI: Nuevo tipo de campaña "Mensaje a grupo de curso"
- Sincronización on-demand de miembros del grupo → tabla junction

## Out of Scope

- Recepción de mensajes de grupos (webhook sigue filtrando `@g.us`)
- Sincronización automática/periódica de miembros (solo manual/on-demand)
- Múltiples grupos por curso (relación 1:1)
- Rediseño de la UI de campañas masivas existente (se mueve íntegra)
- Envío de media a grupos (solo texto en v1 — media se puede agregar después)

## Planned Stories

| ID | Nombre | Descripción | Size | Deps |
|---|---|---|---|---|
| S12.1 | Schema + Edge Functions base | Migration BD (`courses` cols + `contact_whatsapp_groups`) + `list-whatsapp-groups` + `sync-group-members` | M | — |
| S12.2 | UI vinculación de grupo | Dialog en editor de curso: selector canal GOWA → lista grupos → vincular + auto-sync miembros | M | S12.1 |
| S12.3 | Campañas dentro de Academia | Mover Campañas.tsx a tab dentro de Academia, eliminar del sidebar, redirect `/campaigns` → `/academic` | M | — |
| S12.4 | Envío a grupo de curso | Edge function `send-group-message` + UI campaña a grupo: elegir curso → mensaje → enviar | S | S12.1, S12.3 |

**Grafo de dependencias:** S12.1 → S12.2, S12.1 + S12.3 → S12.4. S12.1 y S12.3 son independientes (parallelizables).

## Done Criteria

- [ ] Un curso puede tener un grupo de WhatsApp vinculado y se muestra en la UI
- [ ] Al vincular, los miembros del grupo se cruzan con contactos existentes
- [ ] Se puede enviar un mensaje de texto a un grupo vinculado desde Academia
- [ ] Campañas masivas existentes siguen funcionando (ahora dentro de Academia)
- [ ] La ruta `/campaigns` redirige a `/academic` (backward compat)
- [ ] No hay regresiones en el flujo de cursos existente
