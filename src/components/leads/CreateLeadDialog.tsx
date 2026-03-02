import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UserPlus, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CreateLeadDialog = ({ open, onOpenChange, onSuccess }: CreateLeadDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    platform: 'WHATSAPP',
    nota: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre || !formData.telefono) {
      toast.error('Nombre y Teléfono son obligatorios para el registro.');
      return;
    }

    setLoading(true);
    try {
      // 1. Crear Lead
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          nombre: formData.nombre,
          telefono: formData.telefono,
          email: formData.email || null,
          summary: formData.nota || 'Lead registrado manualmente desde Panel.',
          buying_intent: 'BAJO', // Inicia en bajo hasta calificarlo
          estado_emocional_actual: 'NEUTRO',
          ai_paused: true // IMPORTANTE: Pausar IA por defecto para que no conteste sola si no es WhatsApp
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // 2. Insertar mensaje inicial como bitácora
      if (formData.nota) {
        await supabase.from('conversaciones').insert({
          lead_id: lead.id,
          emisor: 'SISTEMA',
          mensaje: `[REGISTRO MANUAL] Nota inicial: ${formData.nota}`,
          platform: 'PANEL'
        });
      }

      toast.success('Prospecto registrado en el sistema.');
      onSuccess();
      onOpenChange(false);
      setFormData({ nombre: '', telefono: '', email: '', platform: 'WHATSAPP', nota: '' });
    } catch (err: any) {
      toast.error("Error al crear lead: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-400">
            <UserPlus className="w-5 h-5" /> Nuevo Prospecto
          </DialogTitle>
          <DialogDescription>
             Registra un cliente potencial manualmente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          
          <div className="p-3 bg-blue-900/10 border border-blue-900/30 rounded text-xs text-blue-300 flex gap-2">
             <Info className="w-4 h-4 shrink-0 mt-0.5" />
             <p>La IA iniciará en modo <strong>PAUSA (#STOP)</strong> para evitar mensajes automáticos no deseados. Actívala manualmente si deseas.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre Completo *</Label>
              <Input 
                value={formData.nombre} 
                onChange={e => setFormData({...formData, nombre: e.target.value})}
                className="bg-slate-950 border-slate-800"
                placeholder="Ej: Laura Méndez"
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono / ID *</Label>
              <Input 
                value={formData.telefono} 
                onChange={e => setFormData({...formData, telefono: e.target.value})}
                className="bg-slate-950 border-slate-800"
                placeholder="521..."
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Email (Opcional)</Label>
            <Input 
              value={formData.email} 
              onChange={e => setFormData({...formData, email: e.target.value})}
              className="bg-slate-950 border-slate-800"
              placeholder="cliente@email.com"
            />
          </div>

          <div className="space-y-2">
             <Label>Canal de Origen</Label>
             <Select value={formData.platform} onValueChange={v => setFormData({...formData, platform: v})}>
                <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                   <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                   <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                   <SelectItem value="TELEFONO">Llamada Telefónica</SelectItem>
                   <SelectItem value="PRESENCIAL">Visita / Evento</SelectItem>
                </SelectContent>
             </Select>
          </div>

          <div className="space-y-2">
            <Label>Nota de Contexto</Label>
            <Textarea 
              value={formData.nota} 
              onChange={e => setFormData({...formData, nota: e.target.value})}
              className="bg-slate-950 border-slate-800 h-20 text-xs"
              placeholder="Ej: Interesada en curso de cuencos nivel 1. Contactar el martes."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Registrar Lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};