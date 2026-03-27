import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ShieldCheck, Award, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AuditAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string | null;
  agentName: string;
}

export const AuditAgentDialog = ({ open, onOpenChange, leadId, agentName }: AuditAgentDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<any>(null);

  useEffect(() => {
    if (open && leadId) {
      runAudit(leadId);
    }
  }, [open, leadId]);

  const runAudit = async (id: string) => {
    setLoading(true);
    setAudit(null);
    try {
      const { data, error } = await supabase.functions.invoke('audit-chat-performance', {
        body: { lead_id: id }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAudit(data);
    } catch (err: any) {
      toast.error("Error al generar auditoría: " + err.message);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 70) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-red-400 bg-red-500/10 border-red-500/30';
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-lg rounded-3xl shadow-2xl">
        <DialogHeader className="border-b border-[#222225] pb-4">
          <DialogTitle className="flex items-center gap-2 text-indigo-400 uppercase tracking-widest text-sm font-bold">
            <ShieldCheck className="w-5 h-5" /> Auditoría QA de Chat
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Análisis de desempeño humano sobre el asesor <strong className="text-white">{agentName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 min-h-[300px] flex flex-col justify-center">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-4 text-amber-500">
              <Loader2 className="w-10 h-10 animate-spin" />
              <p className="text-[10px] font-bold uppercase tracking-widest animate-pulse">La IA está leyendo todo el chat...</p>
            </div>
          ) : audit ? (
            <ScrollArea className="h-full space-y-6 pr-4">
              <div className="flex items-center justify-between p-4 bg-[#121214] border border-[#222225] rounded-2xl mb-6">
                 <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Score de Calidad</p>
                    <p className="text-xs text-slate-400">Métrica global de atención</p>
                 </div>
                 <div className={cn("px-4 py-2 rounded-xl border flex items-center gap-2", getScoreColor(audit.score))}>
                    <Award className="w-6 h-6" />
                    <span className="text-3xl font-mono font-bold">{audit.score}</span>
                 </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="space-y-2">
                   <h4 className="text-[10px] uppercase font-bold text-emerald-500 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5"/> Fortalezas</h4>
                   <ul className="space-y-1.5">
                     {audit.strengths?.map((s: string, i: number) => (
                        <li key={i} className="text-xs text-emerald-200/80 bg-emerald-950/20 border border-emerald-900/50 p-2 rounded-lg leading-relaxed">{s}</li>
                     ))}
                   </ul>
                </div>
                
                <div className="space-y-2">
                   <h4 className="text-[10px] uppercase font-bold text-amber-500 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5"/> Áreas de Mejora</h4>
                   <ul className="space-y-1.5">
                     {audit.weaknesses?.map((w: string, i: number) => (
                        <li key={i} className="text-xs text-amber-200/80 bg-amber-950/20 border border-amber-900/50 p-2 rounded-lg leading-relaxed">{w}</li>
                     ))}
                   </ul>
                </div>
              </div>

              <div className="p-4 bg-indigo-950/20 border border-indigo-900/50 rounded-xl space-y-2">
                 <p className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1.5"><Zap className="w-3 h-3"/> Conclusión</p>
                 <p className="text-xs text-indigo-200/80 leading-relaxed italic">"{audit.conclusion}"</p>
              </div>
            </ScrollArea>
          ) : (
             <div className="text-center text-slate-500 text-xs italic">Error al cargar datos.</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl uppercase font-bold text-[10px] tracking-widest w-full">Cerrar Reporte</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};