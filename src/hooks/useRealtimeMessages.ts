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
    
    if (data) {
      setMessages(data);
    }
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

    // Carga inicial
    fetchMessages(leadId);

    // Polling cada 2 segundos - usa ref para evitar stale closures
    intervalRef.current = setInterval(() => {
      if (leadIdRef.current) {
        supabase
          .from('conversaciones')
          .select('*')
          .eq('lead_id', leadIdRef.current)
          .order('created_at', { ascending: true })
          .then(({ data }) => {
            if (data) {
              setMessages(prev => {
                // Solo actualizar si hay cambios reales
                if (prev.length !== data.length) return data;
                const lastPrev = prev[prev.length - 1];
                const lastNew = data[data.length - 1];
                if (lastPrev?.id !== lastNew?.id) return data;
                return prev;
              });
            }
          });
      }
    }, 2000);

    // También suscripción Realtime como respaldo
    const channel = supabase
      .channel(`realtime-msgs-${leadId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'conversaciones', 
        filter: `lead_id=eq.${leadId}` 
      }, (payload) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe();

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