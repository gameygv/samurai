import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useRealtimeMessages = (leadId: string | null, open: boolean = true) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const leadIdRef = useRef<string | null>(null);

  const fetchMessages = async (id: string) => {
    const { data } = await supabase
      .from('conversaciones')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: true });
    
    if (data) setMessages(data);
    setLoading(false);
  };

  useEffect(() => {
    if (!leadId || !open) {
      setMessages([]);
      setLoading(false);
      return;
    }

    leadIdRef.current = leadId;
    setLoading(true);
    fetchMessages(leadId);

    // Polling optimizado (10s) como fallback de seguridad para los WebSockets
    // Reducir esto previene que Supabase corte la conexión por exceso de requests
    intervalRef.current = setInterval(() => {
      if (leadIdRef.current) {
        supabase.from('conversaciones').select('*')
          .eq('lead_id', leadIdRef.current).order('created_at', { ascending: true })
          .then(({ data }) => {
            if (data) {
              setMessages(prev => (prev.length !== data.length ? data : prev));
            }
          });
      }
    }, 10000);

    const channel = supabase.channel(`live-${leadId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversaciones', filter: `lead_id=eq.${leadId}` }, (payload) => {
        setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]);
      }).subscribe();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      supabase.removeChannel(channel);
      leadIdRef.current = null;
    };
  }, [leadId, open]);

  const refetch = () => {
    if (leadIdRef.current) fetchMessages(leadIdRef.current);
  };

  return { messages, loading, refetch };
};