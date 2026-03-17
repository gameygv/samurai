import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User, Users, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: any;
  existingGroups: string[];
  onSuccess: () => void;
}

export const EditContactDialog = ({ open, onOpenChange, contact, existingGroups, onSuccess }: EditContactDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    email: '',
    ciudad: '',
    grupo: ''
  });

  useEffect(() => {
    if (contact && open) {
      setFormData({
        nombre: contact.nombre || '',
        apellido: contact.apellido || '',
        telefono: contact.telefono || '',
        email: contact.email || '',
        ciudad: contact.ciudad || '',
        grupo: contact.grupo || ''
      });
    }
  }, [contact, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Actualizar Contacto
      const { error: contactError } = await supabase
        .from('contacts')
        .update({
          nombre: formData.nombre,
          apellido: formData.apellido,
          telefono: formData.telefono,
          email: formData.email,
          ciudad: formData.ciudad,
          grupo: formData.grupo || null
        })
        .eq('id', contact.id);

      if (contactError) throw contactError;

      // 2. Si tiene un Lead asociado, sincronizar los datos básicos
      if (contact.lead_id) {
         await supabase.from('leads').update({
            nombre: formData.nombre,
            apellido: formData.apellido,
            email: formData.email,
            ciudad: formData.ciudad
         }).eq('id', contact.lead_id);
      }

      toast.success('Contacto actualizado correctamente.');
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Error al actualizar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-400">
            <User className="w-5 h-5" /> Editar Contacto
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-slate-400">Nombre</Label>
              <Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="bg-slate-950 border-slate-800 h-10" required />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-slate-400">Apellido</Label>
              <Input value={formData.apellido} onChange={e => setFormData({...formData, apellido: e.target.value})} className="bg-slate-950 border-slate-800 h-10" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-slate-400">Teléfono</Label>
              <Input value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} className="bg-slate-950 border-slate-800 h-10 font-mono" required />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-slate-400">Ciudad</Label>
              <Input value={formData.ciudad} onChange={e => setFormData({...formData, ciudad: e.target.value})} className="bg-slate-950 border-slate-800 h-10" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold text-slate-400">Email</Label>
            <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="bg-slate-950 border-slate-800 h-10" />
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <Label className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1.5"><Users className="w-3.5 h-3.5"/> Grupo / Campaña</Label>
            <Input
                list="existing-groups-edit"
                value={formData.grupo}
                onChange={e => setFormData({...formData, grupo: e.target.value})}
                placeholder="Ej: VIP, Noviembre..."
                className="bg-slate-950 border-slate-800 h-10"
            />
            <datalist id="existing-groups-edit">
                {existingGroups.map(g => <option key={g} value={g} />)}
            </datalist>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 font-bold px-6">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};