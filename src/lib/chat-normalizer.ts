import { supabase } from '@/integrations/supabase/client';

export interface NormalizedLead {
  id: string;
  nombre: string;
  telefono: string;
  email?: string;
  ciudad?: string;
  estado?: string;
  pais?: string;
  cp?: string;
  tags: string[];
  buying_intent: string;
  lead_score?: number;
  summary?: string;
  last_message_at?: string;
  assigned_to?: string;
  ai_paused?: boolean;
  // Datos adicionales del lead
  lead_id?: string;
  contact_id?: string;
  source?: string;
  notes?: string;
  // Datos financieros
  payment_status?: string;
  total_debt?: number;
}

/**
 * Normaliza un lead para asegurar que el ChatViewer siempre reciba datos válidos
 */
export async function normalizeLeadForChat(lead: any): Promise<NormalizedLead> {
  // Si ya es un lead normalizado válido, retornarlo directamente
  if (lead && typeof lead === 'object' && lead.id && lead.nombre) {
    return {
      id: lead.id,
      nombre: lead.nombre || 'Sin nombre',
      telefono: lead.telefono || '',
      email: lead.email || '',
      ciudad: lead.ciudad || '',
      estado: lead.estado || '',
      pais: lead.pais || '',
      cp: lead.cp || '',
      tags: Array.isArray(lead.tags) ? lead.tags : [],
      buying_intent: lead.buying_intent || 'BAJO',
      lead_score: lead.lead_score || 0,
      summary: lead.summary || '',
      last_message_at: lead.last_message_at || new Date().toISOString(),
      assigned_to: lead.assigned_to || '',
      ai_paused: lead.ai_paused || false,
      lead_id: lead.id,
      contact_id: lead.contact_id || '',
      source: lead.source || '',
      notes: lead.notes || '',
      payment_status: lead.payment_status || '',
      total_debt: lead.total_debt || 0,
    };
  }

  // Si el lead es inválido o no existe, crear un lead vacío seguro
  console.warn('⚠️ Lead inválido recibido, retornando estructura segura:', lead);
  return {
    id: '',
    nombre: 'Lead inválido',
    telefono: '',
    email: '',
    ciudad: '',
    estado: '',
    pais: '',
    cp: '',
    tags: [],
    buying_intent: 'BAJO',
    lead_score: 0,
    summary: '',
    last_message_at: new Date().toISOString(),
    assigned_to: '',
    ai_paused: true,
  };
}

/**
 * Crea un lead desde datos de contacto
 */
export async function createLeadFromContact(contact: any): Promise<NormalizedLead | null> {
  if (!contact || !contact.telefono) {
    return null;
  }

  try {
    const { data: newLead, error } = await supabase.from('leads').insert({
      nombre: contact.nombre || contact.apellido || 'Contacto importado',
      telefono: contact.telefono,
      email: contact.email || '',
      ciudad: contact.ciudad || '',
      estado: contact.estado || '',
      pais: contact.pais || '',
      cp: contact.cp || '',
      tags: Array.isArray(contact.tags) ? contact.tags : [],
      buying_intent: 'BAJO',
      ai_paused: true,
      summary: 'Importado desde Contactos',
    }).select().single();

    if (error) throw error;

    // Actualizar el contacto con el lead_id
    if (contact.id) {
      await supabase.from('contacts').update({ lead_id: newLead.id }).eq('id', contact.id);
    }

    return normalizeLeadForChat(newLead);
  } catch (err) {
    console.error('Error creando lead desde contacto:', err);
    return null;
  }
}