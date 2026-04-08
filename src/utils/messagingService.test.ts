import { vi, type Mock } from 'vitest';

const { mockChain, supabase } = vi.hoisted(() => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };

  const supabase = {
    auth: { getUser: vi.fn() },
    from: vi.fn(() => mockChain),
    functions: { invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }) },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  };

  return { mockChain, supabase };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase,
}));

import { sendMessage, sendEvolutionMessage } from './messagingService';

beforeEach(() => {
  vi.clearAllMocks();
  supabase.from.mockReturnValue(mockChain);
  mockChain.select.mockReturnThis();
  mockChain.eq.mockReturnThis();
  mockChain.limit.mockReturnThis();
  mockChain.single.mockResolvedValue({ data: null, error: null });
  mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });
  (supabase.functions.invoke as Mock).mockResolvedValue({ data: { success: true }, error: null });
});

describe('sendMessage', () => {
  it('uses explicitChannelId when provided (skips all lookups)', async () => {
    await sendMessage('+5215551234567', 'Hello', undefined, undefined, 'ch-explicit');

    // Should NOT look up leads or app_config
    expect(supabase.from).not.toHaveBeenCalledWith('leads');
    expect(supabase.from).not.toHaveBeenCalledWith('app_config');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('send-message-v3', {
      body: {
        channel_id: 'ch-explicit',
        phone: '+5215551234567',
        message: 'Hello',
        mediaData: undefined,
      },
    });
  });

  it('looks up channel from lead when no explicit channel', async () => {
    mockChain.single.mockResolvedValue({ data: { channel_id: 'ch-from-lead' }, error: null });

    await sendMessage('+5215551234567', 'Hi', 'lead-1');

    expect(supabase.from).toHaveBeenCalledWith('leads');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('send-message-v3', {
      body: expect.objectContaining({ channel_id: 'ch-from-lead' }),
    });
  });

  it('falls back to app_config default channel', async () => {
    // lead lookup returns no channel_id
    mockChain.single.mockResolvedValue({ data: { channel_id: null }, error: null });
    // app_config lookup returns a value
    mockChain.maybeSingle.mockResolvedValueOnce({ data: { value: 'ch-default' }, error: null });

    await sendMessage('+5215551234567', 'Hi', 'lead-1');

    expect(supabase.from).toHaveBeenCalledWith('app_config');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('send-message-v3', {
      body: expect.objectContaining({ channel_id: 'ch-default' }),
    });
  });

  it('falls back to first active whatsapp_channels entry', async () => {
    // lead has no channel_id
    mockChain.single.mockResolvedValue({ data: { channel_id: null }, error: null });
    // app_config has no default
    mockChain.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })  // app_config
      .mockResolvedValueOnce({ data: { id: 'ch-first-active' }, error: null });  // whatsapp_channels

    await sendMessage('+5215551234567', 'Hi', 'lead-1');

    expect(supabase.from).toHaveBeenCalledWith('whatsapp_channels');
  });

  it('throws when no channel is found anywhere', async () => {
    // No lead
    mockChain.single.mockResolvedValue({ data: null, error: null });
    mockChain.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(sendMessage('+5215551234567', 'Hi')).rejects.toThrow(
      'No hay canales de WhatsApp configurados o activos.',
    );
  });

  it('calls send-message-v3 edge function with correct payload', async () => {
    const media = { url: 'https://img.test/a.jpg', type: 'image', mimetype: 'image/jpeg', name: 'a.jpg' };
    await sendMessage('+5215551234567', 'Look', undefined, media, 'ch-1');

    expect(supabase.functions.invoke).toHaveBeenCalledWith('send-message-v3', {
      body: {
        channel_id: 'ch-1',
        phone: '+5215551234567',
        message: 'Look',
        mediaData: media,
      },
    });
  });

  it('throws when edge function returns success: false', async () => {
    (supabase.functions.invoke as Mock).mockResolvedValue({
      data: { success: false, error: 'bad request' },
      error: null,
    });

    await expect(sendMessage('+5215551234567', 'Hi', undefined, undefined, 'ch-1')).rejects.toThrow();
  });

  it('sendEvolutionMessage is an alias for sendMessage', () => {
    expect(sendEvolutionMessage).toBe(sendMessage);
  });
});
