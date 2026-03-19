import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, User, Users, Save, Mail, MapPin, Phone, Tag, X, Plus, GraduationCap, FileText, Calendar, Send, UserCheck, Trash2, Globe, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

interface EditContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: any;
  existingGroups: string[];
  allTags: {id: string, text: string, color: string}[];
  globalTags: {id: string, text: string, color: string}[];
  onSuccess: () => void;
}

export const EditContactDialog = ({ open, onOpenChange, contact, existingGroups, allTags, globalTags, onSuccess }: EditContactDialogProps) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [analyzingChat, setAnalyzingChat] = useState(false);
  
  const [formData, setFormData] = useState({
    nombre: '', apellido: '', telefono: '', email: '', ciudad: '', estado: '', cp: '', grupo: 'none', tags: [] as string[],
    academicRecord: [] as any[], internalNotes: [] as any[]
  });

  const [catalog, setCatalog] = useState({ courses: [] as any[], locations: [] as any[], teachers: [] as any[] });
  const [newCourse, setNewCourse] = useState({ course: '', location: '', teacher: '', date: '' });
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    if (open) {
       fetchCatalog();
    }
  }, [open]);

  useEffect(() => {
    if (contact && open) {
      let ar = [];
      let inn = [];
      try { ar = Array.isArray(contact.academic_record) ? contact.academic_record : (typeof contact.academic_record === 'string' ? JSON.parse(contact.academic_record) : []); } catch(e){ ar = []; }
      try { inn = Array.isArray(contact.internal_notes) ? contact.internal_notes : (typeof contact.internal_notes === 'string' ? JSON.parse(contact.internal_notes) : []); } catch(e){ inn = []; }

      setFormData({
        nombre: contact.nombre || '', apellido: contact.apellido || '', telefono: contact.telefono || '',
        email: contact.email || '', ciudad: contact.ciudad || '', estado: contact.estado || '',
        cp: contact.cp || '', grupo: contact.grupo || 'none', tags: contact.tags || [],
        academicRecord: ar, internalNotes: inn
      });
      setNewCourse({ course: '', location: '', teacher: '', date: new Date().toISOString().split('T')[0] });
      setNewNote('');
    }
  }, [contact, open]);

  const fetchCatalog = async () => {
    const { data } = await supabase.from('app_config').select('key, value').in('key', ['academic_courses', 'academic_locations', 'academic_teachers']);
    if (data) {
        const c = data.find(d => d.key === 'academic_courses')?.value;
        const l = data.find(d => d.key === 'academic_locations')?.value;
        const t = data.find(d => d.key === 'academic_teachers')?.value;
        const parseSafe = (val: string | undefined) => {
            if (!val) return [];
            try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
        };
        setCatalog({ courses: parseSafe(c), locations: parseSafe(l), teachers: parseSafe(t) });
    }
  };

  const handleForceAnalysis = async () => {
    if (!contact?.lead_id) return toast.error("Este contacto no tiene un chat asociado.");
    setAnalyzingChat(true);
    const tid = toast.loading("Analizando historial con IA...");
    try {
      const { error } = await supabase.functions.invoke('analyze-leads', { body: { lead_id: contact.lead_id, force: true } });
      if (error) throw error;
      const { data: updatedLead } = await supabase.from('leads').select('ciudad, estado, cp').eq('id', contact.lead_id).single();
      if (updatedLead) {
         setFormData(prev => ({
            ...prev,
            ciudad: updatedLead.ciudad || prev.ciudad,
            estado: updatedLead.estado || prev.estado,
            cp: updatedLead.cp || prev.cp
         }));
         toast.success("Datos extraídos. Verifica y guarda.", { id: tid });
      }
    } catch (err: any) { toast.error("Error en análisis: " + err.message, { id: tid }); } finally { setAnalyzingChat(false); }
  };

  const handleAddTag = (tagText: string) => { if (!formData.tags.includes(tagText)) setFormData({ ...formData, tags: [...formData.tags, tagText] }); };
  const handleRemoveTag = (tagText: string) => { setFormData({ ...formData, tags: formData.tags.filter(t => t !== tagText) }); };

  const handleAddCourse = () => {
     if (!newCourse.course || !newCourse.date) return toast.error("El curso y la fecha son obligatorios.");
     const record = { id: Date.now().toString(), ...newCourse };
     setFormData({ ...formData, academicRecord: [...formData.academicRecord, record] });
     setNewCourse({ course: '', location: '', teacher: '', date: new Date().toISOString().split('T')[0] });
  };

  const handleAddNote = () => {
     if (!newNote.trim()) return;
     const noteObj = { id: Date.now().toString(), text: newNote.trim(), author: profile?.full_name || 'Agente', date: new Date().toISOString() };
     setFormData({ ...formData, internalNotes: [...formData.internalNotes, noteObj] });
     setNewNote('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const finalGroup = formData.grupo === 'none' ? null : formData.grupo;
      const { error: contactError } = await supabase.from('contacts').update({
          nombre: formData.nombre, apellido: formData.apellido, telefono: formData.telefono,
          email: formData.email, ciudad: formData.ciudad, estado: formData.estado, cp: formData.cp,
          grupo: finalGroup, tags: formData.tags, academic_record: formData.academicRecord, internal_notes: formData.internalNotes
      }).eq('id', contact.id);

      if (contactError) throw contactError;
      if (contact.lead_id) {
         await supabase.from('leads').update({ nombre: formData.nombre, apellido: formData.apellido, email: formData.email, ciudad: formData.ciudad, tags: formData.tags, estado: formData.estado, cp: formData.cp }).eq('id', contact.lead_id);
      }
      toast.success('Perfil del contacto actualizado.');
      onSuccess();
      onOpenChange(false);
    } catch (err: any) { toast.error('Error al actualizar: ' + err.message); } finally { setLoading(false); }
  };

  const validAllTags = (allTags || []).filter(t => t?.text && String(t.text).trim() !== '');
  const safeGroups = Array.isArray(existingGroups) ? existingGroups : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f0f11] border-[#222225] text-white max-w-4xl rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 bg-[#161618] border-b border-[#222225] shrink-0">
          <DialogTitle className="flex items-center gap-3 text-indigo-400 text-lg">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20"><User className="w-5 h-5" /></div>
            Expediente Maestro del Cliente
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs mt-1">Gestiona la identidad, historial académico y notas administrativas.</DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="perfil" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 bg-[#161618] border-b border-[#222225]">
                <TabsList className="bg-transparent border-0 gap-2 h-12">
                   <TabsTrigger value="perfil" className="data-[state=active]:bg-[#222225] data-[state=active]:text-white gap-2 text-xs rounded-lg px-4"><User className="w-3.5 h-3.5"/> Datos Base</TabsTrigger>
                   <TabsTrigger value="academia" className="data-[state=active]:bg-indigo-900/30 data-[state=active]:text-indigo-400 gap-2 text-xs rounded-lg px-4"><GraduationCap className="w-3.5 h-3.5"/> Ficha Curricular</TabsTrigger>
                   <TabsTrigger value="notas" className="data-[state=active]:bg-amber-900/30 data-[state=active]:text-amber-500 gap-2 text-xs rounded-lg px-4"><FileText className="w-3.5 h-3.5"/> Notas del Perfil</TabsTrigger>
                </TabsList>
            </div>

            <ScrollArea className="flex-1 bg-[#0a0a0c]">
                <TabsContent value="perfil" className="m-0 p-6 space-y-6">
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-[#222225] pb-2">Datos Personales</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Nombre</Label><Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-indigo-500" required /></div>
                            <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Apellido</Label><Input value={formData.apellido} onChange={e => setFormData({...formData, apellido: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-indigo-500" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400 ml-1 flex items-center gap-1.5"><Phone className="w-3 h-3"/> Teléfono Principal</Label><Input value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 font-mono focus-visible:ring-indigo-500" required /></div>
                            <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400 ml-1 flex items-center gap-1.5"><Mail className="w-3 h-3"/> Correo Electrónico</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-indigo-500" /></div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-[#222225] pb-2">
                           <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> Ubicación</h4>
                           {contact?.lead_id && (
                               <Button type="button" variant="outline" size="sm" onClick={handleForceAnalysis} disabled={analyzingChat} className="h-7 text-[9px] bg-indigo-950/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-900/40 uppercase font-bold tracking-widest">
                                   {analyzingChat ? <Loader2 className="w-3 h-3 animate-spin mr-1"/> : <Sparkles className="w-3 h-3 mr-1"/>} Extraer del Chat
                               </Button>
                           )}
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Ciudad</Label><Input value={formData.ciudad} onChange={e => setFormData({...formData, ciudad: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-indigo-500" /></div>
                            <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Estado</Label><Input value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-indigo-500" /></div>
                            <div className="space-y-2"><Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">C.P.</Label><Input value={formData.cp} onChange={e => setFormData({...formData, cp: e.target.value})} className="bg-[#161618] border-[#222225] h-11 rounded-xl text-slate-200 font-mono focus-visible:ring-indigo-500" /></div>
                        </div>
                    </div>

                    <div className="space-y-4 bg-[#161618] p-5 rounded-2xl border border-[#222225]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1.5 ml-1"><Users className="w-3.5 h-3.5"/> Grupo (Catálogo)</Label>
                                <Select value={formData.grupo} onValueChange={v => setFormData({...formData, grupo: v})}>
                                    <SelectTrigger className="bg-[#0a0a0c] border-[#222225] h-11 rounded-xl text-slate-200 focus-visible:ring-indigo-500"><SelectValue placeholder="Seleccionar..."/></SelectTrigger>
                                    <SelectContent className="bg-[#121214] border-[#222225] text-white rounded-xl max-h-[200px]">
                                        <SelectItem value="none">Ninguno (Sin Grupo)</SelectItem>
                                        {safeGroups.map(g => <SelectItem key={String(g)} value={String(g)}>{String(g)}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-3">
                                <Label className="text-[10px] uppercase font-bold text-amber-500 flex items-center gap-1.5 ml-1"><Tag className="w-3.5 h-3.5"/> Etiquetas</Label>
                                <div className="flex flex-wrap gap-2 items-center bg-[#0a0a0c] p-2 min-h-[44px] rounded-xl border border-[#222225]">
                                    {formData.tags.map((t: string) => {
                                        const tagConf = validAllTags.find(lt => lt.text === t);
                                        const isGlobal = (globalTags || []).some(gt => gt.text === t);
                                        const bgColor = tagConf ? tagConf.color + '15' : '#1e293b';
                                        const textColor = tagConf ? tagConf.color : '#94a3b8';
                                        const borderColor = tagConf ? tagConf.color + '40' : '#334155';
                                        return (
                                            <Badge key={t} style={{ backgroundColor: bgColor, color: textColor, borderColor }} className="text-[9px] h-6 border pr-1 pl-1.5 font-bold flex items-center gap-1">
                                                {isGlobal ? <Globe className="w-2.5 h-2.5 opacity-70 shrink-0"/> : <User className="w-2.5 h-2.5 opacity-70 shrink-0"/>}
                                                <span className="truncate">{t}</span>
                                                <button type="button" onClick={() => handleRemoveTag(t)} className="ml-0.5 hover:bg-black/20 rounded-full p-0.5 transition-colors"><X className="w-3 h-3"/></button>
                                            </Badge>
                                        );
                                    })}
                                    <Select onValueChange={(v) => { if(v) handleAddTag(v); }}>
                                        <SelectTrigger className="h-6 text-[10px] bg-transparent border border-dashed border-[#333336] hover:bg-[#161618] text-slate-400 w-auto px-3 shadow-none focus:ring-0 rounded-full transition-colors"><Plus className="w-3 h-3 mr-1" /> Añadir</SelectTrigger>
                                        <SelectContent className="bg-[#121214] border-[#222225] max-h-[300px]">
                                            {validAllTags.map(tag => {
                                                const isGlobal = (globalTags || []).some(gt => gt.text === tag.text);
                                                return (
                                                    <SelectItem key={String(tag.id || tag.text)} value={String(tag.text)} className="text-xs text-white focus:bg-[#161618] cursor-pointer py-2">
                                                        <div className="flex items-center gap-2">
                                                            {isGlobal ? <Globe className="w-3 h-3 opacity-50"/> : <User className="w-3 h-3 opacity-50"/>}
                                                            <div className="w-2.5 h-2.5 rounded-full shadow-inner" style={{backgroundColor: tag.color || '#475569'}}></div>
                                                            {tag.text}
                                                        </div>
                                                    </SelectItem>
                                                )
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="academia" className="m-0 p-6 space-y-6 animate-in fade-in duration-300">
                   <div className="bg-[#161618] p-5 rounded-2xl border border-[#222225] shadow-inner space-y-4">
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-indigo-400 flex items-center gap-2"><Plus className="w-3.5 h-3.5"/> Registrar Nuevo Curso</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         <div className="space-y-1.5"><Label className="text-[9px] text-slate-500 uppercase tracking-widest">Curso / Taller</Label>
                            <Select value={newCourse.course || undefined} onValueChange={v => setNewCourse({...newCourse, course: v})}>
                               <SelectTrigger className="h-10 text-xs bg-[#0a0a0c] border-[#222225]"><SelectValue placeholder="Seleccionar..."/></SelectTrigger>
                               <SelectContent className="bg-[#121214] border-[#222225] text-white max-h-[200px]">
                                 {catalog.courses.filter(c => c.name && c.name.trim() !== '').map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                               </SelectContent>
                            </Select>
                         </div>
                         <div className="space-y-1.5"><Label className="text-[9px] text-slate-500 uppercase tracking-widest">Sede</Label>
                            <Select value={newCourse.location || undefined} onValueChange={v => setNewCourse({...newCourse, location: v})}>
                               <SelectTrigger className="h-10 text-xs bg-[#0a0a0c] border-[#222225]"><SelectValue placeholder="Opcional..."/></SelectTrigger>
                               <SelectContent className="bg-[#121214] border-[#222225] text-white max-h-[200px]">
                                 {catalog.locations.filter(c => c.name && c.name.trim() !== '').map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                               </SelectContent>
                            </Select>
                         </div>
                         <div className="space-y-1.5"><Label className="text-[9px] text-slate-500 uppercase tracking-widest">Profesor</Label>
                            <Select value={newCourse.teacher || undefined} onValueChange={v => setNewCourse({...newCourse, teacher: v})}>
                               <SelectTrigger className="h-10 text-xs bg-[#0a0a0c] border-[#222225]"><SelectValue placeholder="Opcional..."/></SelectTrigger>
                               <SelectContent className="bg-[#121214] border-[#222225] text-white max-h-[200px]">
                                 {catalog.teachers.filter(c => c.name && c.name.trim() !== '').map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                               </SelectContent>
                            </Select>
                         </div>
                         <div className="space-y-1.5"><Label className="text-[9px] text-slate-500 uppercase tracking-widest">Fecha</Label>
                            <Input type="date" value={newCourse.date} onChange={e => setNewCourse({...newCourse, date: e.target.value})} className="h-10 text-xs bg-[#0a0a0c] border-[#222225] text-slate-300" />
                         </div>
                      </div>
                      <div className="flex justify-end pt-2">
                         <Button type="button" onClick={handleAddCourse} className="bg-indigo-600 hover:bg-indigo-500 text-white h-9 px-6 rounded-xl text-[10px] font-bold uppercase tracking-widest">Añadir a Historial</Button>
                      </div>
                   </div>

                   <div className="space-y-3">
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 flex items-center gap-2"><GraduationCap className="w-4 h-4"/> Historial Cursado</h4>
                      {formData.academicRecord.length === 0 ? (
                         <div className="p-8 border-2 border-dashed border-[#222225] rounded-2xl text-center text-slate-600 italic text-xs">Aún no tiene cursos registrados.</div>
                      ) : (
                         <div className="space-y-2">
                            {formData.academicRecord.map((ar, idx) => (
                               <div key={idx} className="p-4 bg-[#161618] border border-[#222225] rounded-xl flex items-center justify-between group">
                                  <div>
                                     <h5 className="font-bold text-indigo-300 text-sm">{ar.course}</h5>
                                     <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500 font-mono">
                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {ar.date ? new Date(ar.date).toLocaleDateString() : 'Sin fecha'}</span>
                                        {ar.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {ar.location}</span>}
                                        {ar.teacher && <span className="flex items-center gap-1"><UserCheck className="w-3 h-3"/> {ar.teacher}</span>}
                                     </div>
                                  </div>
                                  <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, academicRecord: formData.academicRecord.filter(r => r.id !== ar.id)})} className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4"/></Button>
                               </div>
                            ))}
                         </div>
                      )}
                   </div>
                </TabsContent>

                <TabsContent value="notas" className="m-0 p-6 space-y-6 animate-in fade-in duration-300">
                   <div className="flex gap-2 items-end bg-[#161618] p-4 rounded-2xl border border-[#222225] shadow-inner">
                      <div className="flex-1 space-y-2">
                         <Label className="text-[10px] uppercase text-amber-500 font-bold tracking-widest flex items-center gap-2"><FileText className="w-3.5 h-3.5"/> Redactar Nota de Perfil</Label>
                         <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Agrega información estática del cliente que el equipo deba saber..." className="bg-[#0a0a0c] border-[#222225] min-h-[80px] text-xs resize-none focus-visible:ring-amber-500/50" />
                      </div>
                      <Button type="button" onClick={handleAddNote} disabled={!newNote.trim()} className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold h-11 w-11 p-0 shrink-0 rounded-xl shadow-lg"><Send className="w-4 h-4" /></Button>
                   </div>

                   <div className="space-y-3">
                      {formData.internalNotes.length === 0 ? (
                         <div className="p-8 border-2 border-dashed border-[#222225] rounded-2xl text-center text-slate-600 italic text-xs">No hay notas registradas en este perfil.</div>
                      ) : (
                         <div className="space-y-3">
                            {[...formData.internalNotes].reverse().map((note, idx) => (
                               <div key={note.id || idx} className="p-4 bg-amber-900/10 border border-amber-500/20 rounded-xl group relative">
                                  <div className="flex justify-between items-center mb-2">
                                     <span className="text-[10px] font-bold text-amber-500">{note.author}</span>
                                     <span className="text-[9px] text-slate-500 font-mono">{new Date(note.date).toLocaleString()}</span>
                                  </div>
                                  <p className="text-xs text-amber-100/80 leading-relaxed whitespace-pre-wrap">{note.text}</p>
                                  <Button type="button" variant="ghost" size="icon" onClick={() => setFormData({...formData, internalNotes: formData.internalNotes.filter(n => n.id !== note.id)})} className="absolute top-2 right-2 w-6 h-6 text-amber-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3"/></Button>
                               </div>
                            ))}
                         </div>
                      )}
                   </div>
                </TabsContent>
            </ScrollArea>

            <div className="p-6 bg-[#161618] border-t border-[#222225] shrink-0 flex justify-between">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl h-11 uppercase font-bold text-[10px] tracking-widest text-slate-400 hover:text-white hover:bg-[#222225]">Cerrar</Button>
              <Button type="button" onClick={handleSubmit} disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 font-bold px-8 h-11 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Guardar Expediente
              </Button>
            </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};