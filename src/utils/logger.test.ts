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
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn(() => mockChain),
    functions: { invoke: vi.fn() },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  };

  return { mockChain, supabase };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase,
}));

import { logActivity, type LogEntry } from './logger';

const baseEntry: LogEntry = {
  action: 'CREATE',
  resource: 'LEADS',
  description: 'Test log',
  status: 'OK',
};

beforeEach(() => {
  vi.clearAllMocks();
  (supabase.auth.getUser as Mock).mockResolvedValue({ data: { user: null } });
  mockChain.single.mockResolvedValue({ data: null, error: null });
  mockChain.insert.mockResolvedValue({ error: null });
  supabase.from.mockReturnValue(mockChain);
});

describe('logActivity', () => {
  it('inserts log with correct fields when user is authenticated', async () => {
    const user = { id: 'u1', email: 'test@example.com' };
    (supabase.auth.getUser as Mock).mockResolvedValue({ data: { user } });
    mockChain.single.mockResolvedValue({ data: { username: 'carlos' }, error: null });

    await logActivity(baseEntry);

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(supabase.from).toHaveBeenCalledWith('activity_logs');
    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        username: 'carlos',
        action: 'CREATE',
        resource: 'LEADS',
        description: 'Test log',
        status: 'OK',
      }),
    );
  });

  it('uses "system" as username when no user', async () => {
    await logActivity(baseEntry);

    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
        username: 'system',
      }),
    );
  });

  it('uses profile username over email when available', async () => {
    const user = { id: 'u2', email: 'fallback@example.com' };
    (supabase.auth.getUser as Mock).mockResolvedValue({ data: { user } });
    mockChain.single.mockResolvedValue({ data: { username: 'preferred' }, error: null });

    await logActivity(baseEntry);

    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'preferred' }),
    );
  });

  it('falls back to email when profile has no username', async () => {
    const user = { id: 'u3', email: 'email@example.com' };
    (supabase.auth.getUser as Mock).mockResolvedValue({ data: { user } });
    mockChain.single.mockResolvedValue({ data: { username: null }, error: null });

    await logActivity(baseEntry);

    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'email@example.com' }),
    );
  });

  it('does not throw on insert error', async () => {
    mockChain.insert.mockResolvedValue({ error: { message: 'db error' } });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(logActivity(baseEntry)).resolves.toBeUndefined();

    consoleSpy.mockRestore();
  });

  it('does not throw on critical error', async () => {
    (supabase.auth.getUser as Mock).mockRejectedValue(new Error('network'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(logActivity(baseEntry)).resolves.toBeUndefined();

    consoleSpy.mockRestore();
  });
});
