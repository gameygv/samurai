/**
 * Normaliza un lead de forma SÍNCRONA para garantizar datos válidos en ChatViewer
 */
export function normalizeLeadForChat(lead: any) {
  if (!lead || typeof lead !== 'object') {
    return {
      id: '',
      nombre: 'Sin nombre',
      telefono: '',
      email: '',
      ciudad: '',
      buying_intent: 'BAJO',
      ai_paused: false,
      tags: [],
      payment_status: '',
      lead_score: 0,
      summary: '',
      last_message_at: new Date().toISOString(),
    };
  }

  return {
    id: lead.id ?? '',
    nombre: typeof lead.nombre === 'string' && lead.nombre.trim() ? lead.nombre : 'Sin nombre',
    telefono: lead.telefono ?? '',
    email: lead.email ?? '',
    ciudad: lead.ciudad ?? '',
    estado: lead.estado ?? '',
    pais: lead.pais ?? '',
    cp: lead.cp ?? '',
    tags: Array.isArray(lead.tags) ? lead.tags : [],
    buying_intent: lead.buying_intent ?? 'BAJO',
    lead_score: lead.lead_score ?? 0,
    summary: lead.summary ?? '',
    last_message_at: lead.last_message_at ?? new Date().toISOString(),
    assigned_to: lead.assigned_to ?? '',
    ai_paused: Boolean(lead.ai_paused),
    payment_status: lead.payment_status ?? '',
    channel_id: lead.channel_id ?? '',
    platform: lead.platform ?? 'WHATSAPP',
  };
}