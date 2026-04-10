import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UserPlus, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

export const CreateLeadDialog = ({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) => {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    platform: 'WHATSAPP',
    grupo: 'none',
    nota: ''
  });

  useEffect(() => {
    if (open) {
      supabase.from('app_config').select('value').eq('key', 'contact_groups').maybeSingle().then(({data}) => {
        if (data?.value) {
            try { setGroups(JSON.parse(data.value)); } catch(e){}
        }
      });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre || !formData.telefono) {
      toast.error('Nombre y Teléfono son obligatorios.');
      return;
    }

    setLoading(true);
    try {
      let cleanPhone = formData.telefono.replace(/\D/g, '');
      if (cleanPhone.length === 10) cleanPhone = '52' + cleanPhone;

      const insertData: any = {
        nombre: formData.nombre,
        telefono: cleanPhone,
        email: formData.email || null,
        summary: formData.nota || 'Registro manual.',
        buying_intent: 'BAJO',
        ai_paused: true,
        origen_contacto: formData.platform
      };

      if (!isAdmin && user?.id) insertData.assigned_to = user.id;

      const { data: newLead, error: leadError } = await supabase.from('leads').insert(insertData).select().single();
      if (leadError) throw leadError;

      if (formData.grupo && formData.grupo !== 'none') {
         await supabase.from('contacts').update({ grupo: formData.grupo }).eq('lead_id', newLead.id);
      }
      
      supabase.functions.invoke('analyze-leads', { body: { lead_id: newLead.id, force: true } }).catch(() => {});

      toast.success('Prospecto registrado y segmentado correctamente.');
      onSuccess();
      onOpenChange(false);
      setFormData({ nombre: '', telefono: '', email: '', platform: 'WHATSAPP', grupo: 'none', nota: '' });
    } catch (err: any) {
      toast.error("Error al registrar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-400">
            <UserPlus className="w-5 h-5" /> Nuevo Prospecto
          </DialogTitle>
          <DialogDescription>Añade un cliente manualmente al embudo de ventas.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Nombre Provisional *</Label>
              <Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="bg-slate-950 border-slate-800 h-11 rounded-xl" placeholder="Ej: Cliente Nuevo" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Teléfono *</Label>
              <Input value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} className="bg-slate-950 border-slate-800 h-11 font-mono rounded-xl" placeholder="10 dígitos o 521..." />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Email (Opcional)</Label>
               <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="bg-slate-950 border-slate-800 h-11 rounded-xl" placeholder="email@test.com" />
             </div>
             <div className="space-y-2">
                <Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Origen</Label>
                <Select value={formData.platform} onValueChange={v => setFormData({...formData, platform: v})}>
                   <SelectTrigger className="bg-slate-950 border-slate-800 h-11 rounded-xl"><SelectValue /></SelectTrigger>
                   <SelectContent className="bg-slate-900 text-white border-slate-800 rounded-xl">
                      <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                      <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                      <SelectItem value="FACEBOOK">Facebook</SelectItem>
                      <SelectItem value="SITIO WEB">Sitio Web</SelectItem>
                      <SelectItem value="OTRO">Otro</SelectItem>
                   </SelectContent>
                </Select>
             </div>
          </div>

          <div className="space-y-2 bg-indigo-950/20 p-4 border border-indigo-500/20 rounded-xl">
             <Label className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5"/> Asignar Grupo (Catálogo)
             </Label>
             <Select value={formData.grupo} onValueChange={v => setFormData({...formData, grupo: v})}>
                <SelectTrigger className="bg-slate-950 border-slate-800 h-11 rounded-xl"><SelectValue placeholder="Seleccionar grupo..."/></SelectTrigger>
                <SelectContent className="bg-slate-900 text-white border-slate-800 rounded-xl max-h-[200px]">
                   <SelectItem value="none">Ninguno (Sin Grupo)</SelectItem>
                   {groups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
             </Select>
          </div>

          <div className="space-y-2 border-t border-slate-800 pt-3">
            <Label className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Contexto / Nota Interna</Label>
            <Textarea value={formData.nota} onChange={e => setFormData({...formData, nota: e.target.value})} className="bg-slate-950 border-slate-800 h-20 text-xs resize-none rounded-xl" placeholder="El cliente llamó preguntando por..." />
          </div>
          
          <DialogFooter className="pt-2">
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold h-11 rounded-xl uppercase tracking-widest text-[10px] shadow-lg" disabled={loading}>
              {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : 'Registrar Lead y Contacto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};