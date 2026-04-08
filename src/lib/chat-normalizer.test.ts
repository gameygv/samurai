import { normalizeLeadForChat } from './chat-normalizer';

describe('normalizeLeadForChat', () => {
  it('returns full default object for null input', () => {
    const result = normalizeLeadForChat(null);
    expect(result.id).toBe('');
    expect(result.nombre).toBe('Sin nombre');
    expect(result.telefono).toBe('');
    expect(result.email).toBe('');
    expect(result.buying_intent).toBe('BAJO');
    expect(result.ai_paused).toBe(false);
    expect(result.tags).toEqual([]);
    expect(result.lead_score).toBe(0);
  });

  it('returns full default object for undefined input', () => {
    const result = normalizeLeadForChat(undefined);
    expect(result.nombre).toBe('Sin nombre');
  });

  it('returns full default object for non-object input (string)', () => {
    const result = normalizeLeadForChat('not an object');
    expect(result.nombre).toBe('Sin nombre');
    expect(result.tags).toEqual([]);
  });

  it('returns full default object for non-object input (number)', () => {
    const result = normalizeLeadForChat(123);
    expect(result.id).toBe('');
  });

  it('preserves all fields from a complete lead object', () => {
    const lead = {
      id: 'abc-123',
      nombre: 'Carlos',
      telefono: '+5215551234567',
      email: 'carlos@test.com',
      ciudad: 'CDMX',
      estado: 'Activo',
      pais: 'MX',
      cp: '06600',
      tags: ['VIP'],
      buying_intent: 'ALTO',
      lead_score: 85,
      summary: 'Good lead',
      last_message_at: '2026-01-01T00:00:00Z',
      assigned_to: 'user-1',
      ai_paused: true,
      payment_status: 'paid',
      channel_id: 'ch-1',
      platform: 'INSTAGRAM',
    };
    const result = normalizeLeadForChat(lead);
    expect(result.id).toBe('abc-123');
    expect(result.nombre).toBe('Carlos');
    expect(result.telefono).toBe('+5215551234567');
    expect(result.platform).toBe('INSTAGRAM');
    expect(result.ai_paused).toBe(true);
    expect(result.channel_id).toBe('ch-1');
  });

  it('falls back nombre to "Sin nombre" when empty', () => {
    expect(normalizeLeadForChat({ nombre: '' }).nombre).toBe('Sin nombre');
    expect(normalizeLeadForChat({ nombre: '   ' }).nombre).toBe('Sin nombre');
  });

  it('falls back nombre to "Sin nombre" when missing', () => {
    expect(normalizeLeadForChat({}).nombre).toBe('Sin nombre');
  });

  it('coerces ai_paused to boolean', () => {
    expect(normalizeLeadForChat({ ai_paused: 1 }).ai_paused).toBe(true);
    expect(normalizeLeadForChat({ ai_paused: 0 }).ai_paused).toBe(false);
    expect(normalizeLeadForChat({ ai_paused: 'yes' }).ai_paused).toBe(true);
    expect(normalizeLeadForChat({ ai_paused: '' }).ai_paused).toBe(false);
  });

  it('defaults tags to [] when not an array', () => {
    expect(normalizeLeadForChat({ tags: 'not-array' }).tags).toEqual([]);
    expect(normalizeLeadForChat({ tags: null }).tags).toEqual([]);
  });

  it('defaults buying_intent to BAJO', () => {
    expect(normalizeLeadForChat({}).buying_intent).toBe('BAJO');
  });

  it('defaults platform to WHATSAPP', () => {
    expect(normalizeLeadForChat({}).platform).toBe('WHATSAPP');
  });

  it('preserves optional fields (estado, pais, cp, assigned_to, channel_id)', () => {
    const lead = { estado: 'Nuevo', pais: 'MX', cp: '01000', assigned_to: 'u1', channel_id: 'c1' };
    const result = normalizeLeadForChat(lead);
    expect(result.estado).toBe('Nuevo');
    expect(result.pais).toBe('MX');
    expect(result.cp).toBe('01000');
    expect(result.assigned_to).toBe('u1');
    expect(result.channel_id).toBe('c1');
  });
});
