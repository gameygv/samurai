import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Brain, AlertTriangle, Save, Loader2, MessageSquare, Zap, ShieldCheck } from 'lucide-react';
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
  const [selectedMsgIndex, setSelectedMsgIndex] = useState<string>("");
  const [correction, setCorrection] = useState("");
  const [category, setCategory] = useState("CONDUCTA");

  // Filtramos solo los mensajes de la IA/Samurai para poder corregirlos
  const aiMessages = messages.filter(m => ['IA', 'SAMURAI', 'BOT'].includes(m.emisor.toUpperCase())).slice(-10).reverse();

  const handleSaveReport = async () => {
    if (!selectedMsgIndex || !correction.trim()) {
        toast.error("Selecciona el mensaje fallido y escribe la corrección.");
        return;
    }

    const msg = aiMessages.find(m => m.id === selectedMsgIndex);
    if (!msg) return;

    // Buscamos el mensaje del cliente inmediatamente anterior a este fallo
    const msgIdx = messages.findIndex(m => m.id === msg.id);
    const clientMsg = messages.slice(0, msgIdx).reverse().find(m => m.emisor.toUpperCase() === 'CLIENTE')?.mensaje || 'Contexto general';

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('errores_ia').insert({
          usuario_id: user?.id,
          cliente_id: lead.id,
          conversacion_id: msg.id,
          mensaje_cliente: clientMsg,
          respuesta_ia: msg.mensaje,
          categoria: category,
          severidad: 'ALTA',
          correccion_sugerida: correction,
          estado_correccion: 'REPORTADA'
      });

      if (error) throw error;

      toast.success("Fallo reportado a la Bitácora #CIA. Un administrador deberá validarlo.");
      setCorrection("");
      setSelectedMsgIndex("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-xl rounded-3xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-500 uppercase tracking-widest text-xs font-bold">
            <Zap className="w-5 h-5" /> Generar Regla #CIA (Contextual)
          </DialogTitle>
          <DialogDescription className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            VINCULANDO APRENDIZAJE AL CHAT ACTUAL
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
             <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">1. Selecciona el error de Sam</Label>
             <Select value={selectedMsgIndex} onValueChange={setSelectedMsgIndex}>
                <SelectTrigger className="bg-[#0a0a0c] border-[#222225] h-12 rounded-xl text-xs">
                   <SelectValue placeholder="Elige la respuesta incorrecta..." />
                </SelectTrigger>
                <SelectContent className="bg-[#121214] border-[#222225] text-white max-h-[300px]">
                   {aiMessages.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-xs focus:bg-[#161618]">
                         <div className="max-w-[400px] truncate italic">"{m.mensaje}"</div>
                      </SelectItem>
                   ))}
                </SelectContent>
             </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
                   <SelectTrigger className="bg-[#0a0a0c] border-[#222225] h-10 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                   <SelectContent className="bg-[#121214] border-[#222225] text-white">
                      <SelectItem value="CONDUCTA">Conducta / Tono</SelectItem>
                      <SelectItem value="VENTAS">Lógica de Venta</SelectItem>
                      <SelectItem value="INFO_ERRONEA">Dato Incorrecto</SelectItem>
                   </SelectContent>
                </Select>
             </div>
             <div className="bg-indigo-950/20 border border-indigo-500/20 p-2 rounded-xl flex items-center justify-center">
                <p className="text-[9px] text-indigo-300 text-center font-bold uppercase tracking-tighter">La IA aprenderá de este ejemplo específico.</p>
             </div>
          </div>

          <div className="space-y-2">
             <Label className="text-[10px] uppercase font-bold text-emerald-500 ml-1">2. ¿Cómo debió responder o qué debe aprender?</Label>
             <Textarea 
                value={correction}
                onChange={e => setCorrection(e.target.value)}
                placeholder="Ej: Cuando pregunten por precios, nunca des el total sin antes pedir el email..."
                className="bg-[#0a0a0c] border-[#222225] h-32 rounded-2xl text-xs focus-visible:ring-emerald-500 leading-relaxed resize-none"
             />
          </div>
        </div>

        <DialogFooter className="border-t border-[#222225] pt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl h-11 px-6 text-xs uppercase font-bold text-slate-400">Cancelar</Button>
          <Button onClick={handleSaveReport} disabled={loading || !selectedMsgIndex} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 h-11 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
             {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />} Enviar a Bitácora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};