import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Bot, BotOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

export const GlobalAiToggle = () => {
  const { user, isManager } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pausedCount, setPausedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchStatus();
  }, [user]);

  const fetchStatus = async () => {
    if (!user) return;
    let query = supabase.from('leads').select('id, ai_paused', { count: 'exact' })
      .not('buying_intent', 'in', '("COMPRADO","PERDIDO")');
    
    if (!isManager) query = query.eq('assigned_to', user.id);

    const { data, count } = await query;
    if (data) {
      setPausedCount(data.filter(l => l.ai_paused).length);
      setTotalCount(count || 0);
    }
  };

  const allPaused = pausedCount > 0 && pausedCount === totalCount;

  const handleToggleAll = async () => {
    if (!user) return;
    setLoading(true);
    const newPausedState = !allPaused;
    const tid = toast.loading(newPausedState ? 'Pausando IA en todos los chats...' : 'Activando IA en todos los chats...');

    try {
      let query = supabase.from('leads')
        .update({ ai_paused: newPausedState })
        .not('buying_intent', 'in', '("COMPRADO","PERDIDO")');

      if (!isManager) query = query.eq('assigned_to', user.id);

      const { error } = await query;
      if (error) throw error;

      toast.success(
        newPausedState
          ? `IA pausada en ${totalCount} conversaciones activas.`
          : `IA activada en ${totalCount} conversaciones activas.`,
        { id: tid }
      );
      fetchStatus();
    } catch (err: any) {
      toast.error('Error: ' + err.message, { id: tid });
    } finally {
      setLoading(false);
    }
  };

  if (totalCount === 0) return null;

  return (
    <Button
      onClick={handleToggleAll}
      disabled={loading}
      size="sm"
      className={cn(
        "h-9 px-4 font-bold text-[10px] uppercase tracking-widest rounded-xl border transition-all",
        allPaused
          ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-600"
          : "bg-red-950/30 border-red-500/40 text-red-400 hover:bg-red-600 hover:text-white hover:border-red-600"
      )}
      title={allPaused ? "Activar IA en todos mis chats" : "Pausar IA en todos mis chats"}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
      ) : allPaused ? (
        <Bot className="w-4 h-4 mr-2" />
      ) : (
        <BotOff className="w-4 h-4 mr-2" />
      )}
      {allPaused
        ? `Activar IA (${pausedCount} pausadas)`
        : `Pausar IA (${totalCount} activas)`}
    </Button>
  );
};