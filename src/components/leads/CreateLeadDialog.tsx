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
      toast.error('Nombre y Teléfono son obligatorios.');
      return;
    }

    setLoading(true);
    try {
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          nombre: formData.nombre,
          telefono: formData.telefono,
          email: formData.email || null,
          summary: formData.nota || 'Registro manual.',
          buying_intent: 'BAJO',
          ai_paused: true 
        })
        .select().single();

      if (leadError) throw leadError;

      toast.success('Prospecto registrado correctamente.');
      onSuccess();
      onOpenChange(false);
      setFormData({ nombre: '', telefono: '', email: '', platform: 'WHATSAPP', nota: '' });
    } catch (err: any) {
      toast.error("Error: " + err.message);
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
          <DialogDescription>Añade un cliente manualmente al embudo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre Completo *</Label>
              <Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="bg-slate-950 border-slate-800" placeholder="Ej: Laura M." />
            </div>
            <div className="space-y-2">
              <Label>Teléfono *</Label>
              <Input value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} className="bg-slate-950 border-slate-800" placeholder="521..." />
            </div>
          </div>
          <div className="space-y-2"><Label>Email</Label><Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="bg-slate-950 border-slate-800" placeholder="email@test.com" /></div>
          <div className="space-y-2">
             <Label>Canal</Label>
             <Select value={formData.platform} onValueChange={v => setFormData({...formData, platform: v})}>
                <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 text-white"><SelectItem value="WHATSAPP">WhatsApp</SelectItem><SelectItem value="INSTAGRAM">Instagram</SelectItem><SelectItem value="TELEFONO">Llamada</SelectItem></SelectContent>
             </Select>
          </div>
          <div className="space-y-2"><Label>Nota Inicial</Label><Textarea value={formData.nota} onChange={e => setFormData({...formData, nota: e.target.value})} className="bg-slate-950 border-slate-800 h-20 text-xs" /></div>
          <DialogFooter>
            <Button type="submit" className="w-full bg-indigo-600" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : 'Registrar Lead'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};