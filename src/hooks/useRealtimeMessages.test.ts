import { vi, type Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { mockChain, mockChannel, supabase } = vi.hoisted(() => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    order: vi.fn().mockResolvedValue({ data: [] }),
    limit: vi.fn().mockReturnThis(),
  };

  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
  };

  const supabase = {
    auth: { getUser: vi.fn() },
    from: vi.fn(() => mockChain),
    functions: { invoke: vi.fn() },
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  };

  return { mockChain, mockChannel, supabase };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase,
}));

import { useRealtimeMessages } from './useRealtimeMessages';

beforeEach(() => {
  vi.clearAllMocks();
  supabase.from.mockReturnValue(mockChain);
  mockChain.select.mockReturnThis();
  mockChain.eq.mockReturnThis();
  mockChain.order.mockResolvedValue({ data: [] });
  supabase.channel.mockReturnValue(mockChannel);
  mockChannel.on.mockReturnThis();
  mockChannel.subscribe.mockReturnValue(undefined);
});

describe('useRealtimeMessages', () => {
  it('returns empty messages and loading=false when leadId is null', () => {
    const { result } = renderHook(() => useRealtimeMessages(null));

    expect(result.current.messages).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('returns empty messages and loading=false when open is false', () => {
    const { result } = renderHook(() => useRealtimeMessages('lead-1', false));

    expect(result.current.messages).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('fetches messages on mount when leadId is provided', async () => {
    const messages = [
      { id: 'm1', mensaje: 'Hello', created_at: '2026-01-01T00:00:00Z', lead_id: 'lead-1' },
    ];

    mockChain.order.mockResolvedValue({ data: messages });

    const { result } = renderHook(() => useRealtimeMessages('lead-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(supabase.from).toHaveBeenCalledWith('conversaciones');
    expect(result.current.messages).toEqual(messages);
  });

  it('sets loading=false after fetch completes', async () => {
    mockChain.order.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useRealtimeMessages('lead-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('exposes refetch function', async () => {
    mockChain.order.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useRealtimeMessages('lead-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Clear and reconfigure to verify refetch triggers a new fetch
    supabase.from.mockClear();
    supabase.from.mockReturnValue(mockChain);
    mockChain.order.mockResolvedValue({ data: [{ id: 'm2', mensaje: 'New' }] });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('conversaciones');
    });
  });

  it('cleans up channel and interval on unmount', async () => {
    mockChain.order.mockResolvedValue({ data: [] });

    const { result, unmount } = renderHook(() => useRealtimeMessages('lead-1'));

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalled();
    });

    unmount();

    expect(supabase.removeChannel).toHaveBeenCalled();
  });
});
