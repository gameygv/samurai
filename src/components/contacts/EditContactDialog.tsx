import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, User, Users, Save, Mail, MapPin, Phone, Tag, X, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: any;
  existingGroups: string[];
  allTags: {id: string, text: string, color: string}[];
  onSuccess: () => void;
}

export const EditContactDialog = ({ open, onOpenChange, contact, existingGroups, allTags, onSuccess }: EditContactDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '', apellido: '', telefono: '', email: '', ciudad: '', estado: '', cp: '', grupo: '', tags: [] as string[]
  });

  useEffect(() => {
    if (contact && open) {
      setFormData({
        nombre: contact.nombre || '', apellido: contact.apellido || '', telefono: contact.telefono || '',
        email: contact.email || '', ciudad: contact.ciudad || '', estado: contact.estado || '',
        cp: contact.cp || '', grupo: contact.grupo || '', tags: contact.tags || []
      });
    }
  }, [contact, open]);

  const handleAddTag = (tagText: string) => {
      if (!formData.tags.includes(tagText)) {
          setFormData({ ...formData, tags: [...formData.tags, tagText] });
      }
  };

  const handleRemoveTag = (tagText: string) => {
      setFormData({ ...formData, tags: formData.tags.filter(t => t !== tagText) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error: contactError } = await supabase.from('contacts').update({
          nombre: formData.nombre, apellido: formData.apellido, telefono: formData.telefono,
          email: formData.email, ciudad: formData.ciudad, estado: formData.estado, cp: formData.cp,
          grupo: formData.grupo || null, tags: formData.tags
      }).eq('id', contact.id);

      if (contactError) throw contactError;

      if (contact.lead_id) {
         await supabase.from('leads').update({
            nombre: formData.nombre, apellido: formData.apellido, email: formData.email, ciudad: formData.ciudad, tags: formData.tags
         }).eq('id', contact.lead_id);
      }

      toast.success('Perfil del contacto actualizado.');
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
      <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-2xl rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] p-0 overflow-hidden">
        <DialogHeader className="p-6 bg-[#161618] border-b border-[#222225]">
          <DialogTitle className="flex items-center gap-3 text-indigo-400 text-lg">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20"><User className="w-5 h-5" /></div>
            Editar Expediente del Contacto
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs mt-1">
             Modifica la información de contacto, segmentación y etiquetas.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-[#0a0a0c]">
          
          {/* SECCIÓN DATOS PERSONALES */}
          <div className="space-y-4">
             <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-[#222225] pb-2">Datos Personales</h4>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Nombre</Label>
                  <Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-indigo-500" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Apellido</Label>
                  <Input value={formData.apellido} onChange={e => setFormData({...formData, apellido: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-indigo-500" />
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1 flex items-center gap-1.5"><Phone className="w-3 h-3"/> Teléfono Principal</Label>
                  <Input value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 font-mono focus-visible:ring-indigo-500" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1 flex items-center gap-1.5"><Mail className="w-3 h-3"/> Correo Electrónico</Label>
                  <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-indigo-500" />
                </div>
             </div>
          </div>

          {/* SECCIÓN UBICACIÓN */}
          <div className="space-y-4">
             <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-[#222225] pb-2 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> Ubicación</h4>
             <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Ciudad</Label>
                  <Input value={formData.ciudad} onChange={e => setFormData({...formData, ciudad: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-indigo-500" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Estado</Label>
                  <Input value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-indigo-500" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">C.P.</Label>
                  <Input value={formData.cp} onChange={e => setFormData({...formData, cp: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 font-mono focus-visible:ring-indigo-500" />
                </div>
             </div>
          </div>

          {/* SECCIÓN SEGMENTACIÓN */}
          <div className="space-y-4 bg-[#161618] p-5 rounded-2xl border border-[#222225]">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1.5 ml-1"><Users className="w-3.5 h-3.5"/> Grupo de Campaña</Label>
                    <Input
                        list="existing-groups-edit"
                        value={formData.grupo}
                        onChange={e => setFormData({...formData, grupo: e.target.value})}
                        placeholder="Ej: Oferta Noviembre..."
                        className="bg-[#0a0a0c] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-indigo-500"
                    />
                    <datalist id="existing-groups-edit">
                        {existingGroups.map(g => <option key={g} value={g} />)}
                    </datalist>
                 </div>
                 
                 <div className="space-y-3">
                    <Label className="text-[10px] uppercase font-bold text-amber-500 flex items-center gap-1.5 ml-1"><Tag className="w-3.5 h-3.5"/> Etiquetas</Label>
                    <div className="flex flex-wrap gap-2 items-center bg-[#0a0a0c] p-2 min-h-[44px] rounded-xl border border-[#222225]">
                        {formData.tags.map((t: string) => {
                           const tagConf = allTags.find(lt => lt.text === t);
                           const bgColor = tagConf ? tagConf.color + '15' : '#1e293b';
                           const textColor = tagConf ? tagConf.color : '#94a3b8';
                           const borderColor = tagConf ? tagConf.color + '40' : '#334155';
                           return (
                              <Badge key={t} style={{ backgroundColor: bgColor, color: textColor, borderColor }} className="text-[9px] h-6 border pr-1 font-bold">
                                 {t} <button type="button" onClick={() => handleRemoveTag(t)} className="ml-1 hover:text-white rounded-full p-0.5 transition-colors"><X className="w-3 h-3"/></button>
                              </Badge>
                           );
                        })}
                        
                        <Select onValueChange={(v) => { if(v) handleAddTag(v); }}>
                           <SelectTrigger className="h-6 text-[10px] bg-transparent border border-dashed border-[#333336] hover:bg-[#161618] text-slate-400 w-auto px-3 shadow-none focus:ring-0 rounded-full transition-colors">
                              <Plus className="w-3 h-3 mr-1" /> Añadir
                           </SelectTrigger>
                           <SelectContent className="bg-[#121214] border-[#222225]">
                              {allTags.map(tag => (
                                 <SelectItem key={tag.id} value={tag.text} className="text-xs text-white focus:bg-[#161618] cursor-pointer">
                                    <div className="flex items-center gap-2">
                                       <div className="w-2.5 h-2.5 rounded-full shadow-inner" style={{backgroundColor: tag.color}}></div>
                                       {tag.text}
                                    </div>
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                    </div>
                 </div>
             </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl h-11">Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 font-bold px-8 h-11 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} ACTUALIZAR FICHA
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};