import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CreateLeadDialog = ({ open, onOpenChange, onSuccess }: CreateLeadDialogProps) => {
  const { user, isAdmin } = useAuth();
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
      // Limpiar teléfono de espacios y caracteres no numéricos
      const cleanPhone = formData.telefono.replace(/\D/g, '');

      const insertData: any = {
        nombre: formData.nombre,
        telefono: cleanPhone,
        email: formData.email || null,
        summary: formData.nota || 'Registro manual.',
        buying_intent: 'BAJO',
        ai_paused: true,
        platform: formData.platform
      };

      // Si no es admin, auto-asignar el lead al usuario actual (vendedor)
      if (!isAdmin && user?.id) {
        insertData.assigned_to = user.id;
      }

      const { error: leadError } = await supabase
        .from('leads')
        .insert(insertData);

      if (leadError) throw leadError;

      toast.success('Prospecto registrado correctamente.');
      onSuccess();
      onOpenChange(false);
      setFormData({ nombre: '', telefono: '', email: '', platform: 'WHATSAPP', nota: '' });
    } catch (err: any) {
      console.error("Error creating lead:", err);
      toast.error("Error al registrar: " + (err.message || "Verifica la conexión"));
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
          <DialogDescription>Añade un cliente manualmente al embudo de ventas.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-slate-400 uppercase font-bold">Nombre Completo *</Label>
              <Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="bg-slate-950 border-slate-800" placeholder="Ej: Laura M." />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-400 uppercase font-bold">Teléfono *</Label>
              <Input value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} className="bg-slate-950 border-slate-800" placeholder="521..." />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-slate-400 uppercase font-bold">Email (Opcional)</Label>
            <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="bg-slate-950 border-slate-800" placeholder="email@test.com" />
          </div>
          <div className="space-y-2">
             <Label className="text-xs text-slate-400 uppercase font-bold">Canal de Origen</Label>
             <Select value={formData.platform} onValueChange={v => setFormData({...formData, platform: v})}>
                <SelectTrigger className="bg-slate-950 border-slate-800">
                   <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-white border-slate-800">
                   <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                   <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                   <SelectItem value="TELEFONO">Llamada Directa</SelectItem>
                </SelectContent>
             </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-slate-400 uppercase font-bold">Nota Inicial</Label>
            <Textarea value={formData.nota} onChange={e => setFormData({...formData, nota: e.target.value})} className="bg-slate-950 border-slate-800 h-20 text-xs" placeholder="Contexto sobre el interés del cliente..." />
          </div>
          <DialogFooter className="pt-4">
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold" disabled={loading}>
              {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : 'Registrar Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};