---
epic: E5
name: multichannel-hardening
type: design
---

# E5 Design: Multi-Channel Hardening

## Gemba (Current State)

### Recordatorios por lead (broken)
```
Agente crea recordatorio en MemoryPanel → leads.reminders JSONB
  → Se guarda correctamente
  → NADIE lo revisa ni lo envia
  → El agente nunca recibe el aviso
```

### Auto-routing por ciudad (broken)
```
Cliente dice "soy de Guadalajara"
  → analyze-leads extrae ciudad = "Guadalajara"
  → UPDATE leads SET ciudad = 'Guadalajara'
  → NADA MAS — no busca agente, no asigna
  → Lead queda sin assigned_to hasta asignacion manual
```

### Transcripcion Gowa (broken)
```
Audio llega por canal Gowa
  → transcribe-audio intenta Graph API de META con api_key de Gowa
  → Meta devuelve error (api_key no es de Meta)
  → Fallback funciona pero error innecesario
```

## Target State

### Recordatorios por lead
```
Agente crea recordatorio (notify_wa=true, datetime="2026-04-01 10:00")
  → leads.reminders JSONB
  → Cron cada hora ejecuta process-lead-reminders
  → Encuentra recordatorio donde datetime - notify_minutes <= ahora
  → Busca agente: lead.assigned_to → profiles.phone
  → Envia por default_notification_channel al agente
  → Marca como sent en el JSONB
```

### Auto-routing por ciudad
```
Cliente dice "soy de Guadalajara"
  → analyze-leads extrae ciudad = "Guadalajara"
  → UPDATE leads SET ciudad = 'Guadalajara'
  → Check channel_routing_mode = 'auto'
  → Paso 1: SELECT profiles WHERE 'Guadalajara' ILIKE ANY(territories)
  → Si match: assigned_to = agent.id
  → Si no match: pregunta a OpenAI cual agente tiene la ciudad mas cercana
  → assigned_to = best_match.id
  → Log en activity_logs
```

### Transcripcion Gowa
```
Audio llega por canal Gowa
  → transcribe-audio verifica provider del canal
  → provider = 'gowa' → fallback directo (no intenta Graph API)
  → '[Nota de Voz — transcripcion no disponible en este canal]'
  → Invoca AI con fallback → bot pide que escriba por texto
```

## Key Contracts

### process-lead-reminders (nueva edge function)

```typescript
// Cron: cada hora (0 * * * *)
// 1. Buscar leads con reminders pendientes
const { data: leads } = await supabase
  .from('leads')
  .select('id, nombre, assigned_to, reminders')
  .not('reminders', 'eq', '[]')
  .not('assigned_to', 'is', null);

// 2. Para cada reminder
for (const lead of leads) {
  const reminders = lead.reminders || [];
  let updated = false;

  for (const rem of reminders) {
    if (rem.sent) continue;
    if (!rem.notify_wa) continue;

    const triggerTime = new Date(rem.datetime);
    triggerTime.setMinutes(triggerTime.getMinutes() - (rem.notify_minutes || 0));

    if (new Date() >= triggerTime) {
      // Buscar telefono del agente
      const { data: agent } = await supabase
        .from('profiles').select('phone, full_name')
        .eq('id', lead.assigned_to).single();

      if (agent?.phone) {
        const msg = `📋 Recordatorio: ${rem.title}\n👤 Lead: ${lead.nombre}`;
        await supabase.functions.invoke('send-message-v3', {
          body: { phone: agent.phone, message: msg }
          // Sin lead_id ni channel_id → usa default_notification_channel
        });
      }

      rem.sent = true;
      rem.sent_at = new Date().toISOString();
      updated = true;
    }
  }

  if (updated) {
    await supabase.from('leads').update({ reminders }).eq('id', lead.id);
  }
}
```

### Auto-routing en analyze-leads (addition)

```typescript
// Despues de actualizar ciudad (linea ~95)
if (updates.ciudad) {
  // Check routing mode
  const { data: routingCfg } = await supabase
    .from('app_config').select('value')
    .eq('key', 'channel_routing_mode').maybeSingle();

  if (routingCfg?.value === 'auto') {
    // Paso 1: matching exacto
    const { data: agents } = await supabase
      .from('profiles')
      .select('id, full_name, territories')
      .eq('role', 'agent')
      .eq('is_active', true);

    const cityLower = updates.ciudad.toLowerCase();
    let matched = agents?.filter(a =>
      a.territories?.some(t => t.toLowerCase() === cityLower)
    );

    if (matched && matched.length > 0) {
      // Exacto: asignar al primero (o random si multiples)
      const agent = matched[Math.floor(Math.random() * matched.length)];
      await supabase.from('leads').update({ assigned_to: agent.id }).eq('id', lead_id);
      // Log
    } else if (agents && agents.length > 0) {
      // Paso 2: fallback IA
      const territoriesMap = agents.map(a =>
        `${a.full_name}: ${a.territories?.join(', ')}`
      ).join('\n');

      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content:
            `El lead esta en "${updates.ciudad}". Estos son los agentes y sus territorios:\n${territoriesMap}\n\nResponde SOLO con el nombre completo del agente cuyo territorio es mas cercano. Si ninguno es cercano, responde "NONE".`
          }],
          temperature: 0
        })
      });
      // Parse response, match to agent, update assigned_to
    }
  }
}
```

## Components Touched

| Component | Change | Story |
|-----------|--------|-------|
| `supabase/functions/process-lead-reminders/index.ts` | NEW | S5.1 |
| `supabase/functions/analyze-leads/index.ts` | ADD auto-routing after ciudad update | S5.2 |
| `supabase/functions/transcribe-audio/index.ts` | ADD provider check before Graph API | S5.3 |
| `supabase/functions/send-message-v3/index.ts` | FIX normalizacion + ORDER BY | S5.4 |
| `work/epics/e3-whatsapp-hardening/` | CLOSE retrospective | S5.5 |
