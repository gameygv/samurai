import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Zap, ShieldCheck, BrainCircuit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CiaReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: any;
  messages: any[];
}

export const CiaReportDialog = ({ open, onOpenChange, lead, messages }: CiaReportDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [correction, setCorrection] = useState("");
  const [category, setCategory] = useState("CONDUCTA");

  const handleSaveReport = async () => {
    if (!correction.trim()) {
        toast.error("Por favor, escribe la instrucción que la IA debe aprender.");
        return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Tomamos el contexto automáticamente en segundo plano
      const safeMessages = Array.isArray(messages) ? messages : [];
      const lastAiMessage = safeMessages.slice().reverse().find(m => ['IA', 'SAMURAI', 'BOT'].includes((m?.emisor || '').toUpperCase()));
      const lastClientMessage = safeMessages.slice().reverse().find(m => (m?.emisor || '').toUpperCase() === 'CLIENTE');

      const { error } = await supabase.from('errores_ia').insert({
          usuario_id: user?.id,
          cliente_id: lead?.id,
          conversacion_id: lastAiMessage?.id || null,
          mensaje_cliente: lastClientMessage?.mensaje || 'Reporte Contextual Directo',
          respuesta_ia: lastAiMessage?.mensaje || 'Reporte Contextual Directo',
          categoria: category,
          severidad: 'ALTA',
          correccion_sugerida: correction.trim(),
          estado_correccion: 'REPORTADA'
      });

      if (error) throw error;

      toast.success("Instrucción enviada a la Bitácora #CIA. Un administrador deberá validarla.");
      setCorrection("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Error al guardar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-lg rounded-3xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-500 uppercase tracking-widest text-xs font-bold">
            <Zap className="w-5 h-5" /> Inyectar Regla #CIA
          </DialogTitle>
          <DialogDescription className="text-[10px] text-slate-500 mt-1">
            El sistema vinculará esta instrucción al contexto de <strong className="text-slate-300">{lead?.nombre || 'este cliente'}</strong> automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-2">
             <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Categoría del Aprendizaje</Label>
             <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-[#121214] border-[#222225] h-11 rounded-xl text-xs text-white">
                   <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#161618] border-[#222225] text-white">
                   <SelectItem value="CONDUCTA">Conducta / Tono de voz</SelectItem>
                   <SelectItem value="VENTAS">Lógica de Venta / Cierre</SelectItem>
                   <SelectItem value="INFO_ERRONEA">Corrección de Dato Erróneo</SelectItem>
                </SelectContent>
             </Select>
          </div>

          <div className="space-y-2">
             <Label className="text-[10px] uppercase font-bold text-emerald-500 ml-1 flex items-center gap-1.5">
                <BrainCircuit className="w-3.5 h-3.5" /> Nueva Instrucción para el Kernel
             </Label>
             <Textarea 
                value={correction}
                onChange={e => setCorrection(e.target.value)}
                placeholder="Ej: A partir de ahora, cuando un cliente pregunte por precios de mayoreo, nunca des el total sin antes pedir el correo electrónico..."
                className="bg-[#121214] border-[#222225] h-32 rounded-2xl text-xs focus-visible:ring-emerald-500 leading-relaxed resize-none text-slate-200"
             />
          </div>
        </div>

        <DialogFooter className="border-t border-[#222225] pt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl h-11 px-6 text-[10px] uppercase font-bold tracking-widest text-slate-400 hover:text-white hover:bg-[#161618]">
             Cancelar
          </Button>
          <Button onClick={handleSaveReport} disabled={loading || !correction.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 h-11 rounded-xl shadow-lg uppercase tracking-widest text-[10px] transition-all">
             {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />} Enviar a Bitácora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};