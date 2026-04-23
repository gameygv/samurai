# E12: Grupos WhatsApp & Campañas en Academia

## Hypothesis

Si permitimos vincular un grupo de WhatsApp a cada curso/taller y habilitamos campañas directas a esos grupos desde la misma sección de Academia, los agentes podrán comunicarse con los inscritos de forma instantánea sin salir de su flujo de trabajo. Además, al sincronizar los miembros del grupo con los leads/contactos existentes, el CRM sabrá automáticamente a qué grupos pertenece cada persona — dato valioso para segmentación y seguimiento.

## Success Metrics

- [ ] Editor de curso tiene botón "Vincular Grupo WhatsApp" funcional
- [ ] Dialog de vinculación: seleccionar canal GOWA → ver grupos → seleccionar uno
- [ ] `courses` tiene `whatsapp_group_jid` + `whatsapp_channel_id` persistidos
- [ ] Tabla `contact_whatsapp_groups` con cruce automático miembros↔contactos
- [ ] Sección "Campañas" integrada dentro de Academia (sale del sidebar como item independiente)
- [ ] Campaña tipo "Mensaje a grupo de curso": elegir curso → escribir mensaje → enviar
- [ ] Campañas existentes (masivas individuales + programadas) siguen funcionando dentro de Academia
- [ ] Leads actualizados con información de pertenencia a grupos

## Appetite

1-2 semanas. 4 stories.

## Rabbit Holes (evitar)

- No recibir ni procesar mensajes entrantes de grupos — solo enviar. El webhook sigue filtrando `@g.us`
- No crear un sistema de "canales por curso" — un curso tiene exactamente 1 grupo vinculado (o ninguno)
- No sincronizar miembros en tiempo real vía webhook — sincronización on-demand al vincular y botón manual
- No rediseñar la UI de campañas existente — moverla tal cual dentro de Academia y agregar el nuevo tipo
- No implementar templates por grupo — reutilizar el sistema de templates existente de campañas
