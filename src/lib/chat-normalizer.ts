const parseArray = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const normalizeLeadForChat = (lead: any) => {
  if (!lead) return null;

  return {
    ...lead,
    nombre: typeof lead.nombre === 'string' ? lead.nombre : '',
    telefono: typeof lead.telefono === 'string' ? lead.telefono : '',
    email: typeof lead.email === 'string' ? lead.email : '',
    ciudad: typeof lead.ciudad === 'string' ? lead.ciudad : '',
    estado: typeof lead.estado === 'string' ? lead.estado : '',
    cp: typeof lead.cp === 'string' ? lead.cp : '',
    pais: typeof lead.pais === 'string' ? lead.pais : '',
    summary: typeof lead.summary === 'string' ? lead.summary : '',
    perfil_psicologico: typeof lead.perfil_psicologico === 'string' ? lead.perfil_psicologico : '',
    buying_intent: typeof lead.buying_intent === 'string' ? lead.buying_intent : 'BAJO',
    estado_emocional_actual: typeof lead.estado_emocional_actual === 'string' ? lead.estado_emocional_actual : 'NEUTRO',
    payment_status: typeof lead.payment_status === 'string' ? lead.payment_status : 'NONE',
    platform: typeof lead.platform === 'string' ? lead.platform : 'WHATSAPP',
    tags: parseArray(lead.tags),
    reminders: parseArray(lead.reminders),
  };
};