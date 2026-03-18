import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Database, Loader2, Fingerprint, Trash2, Edit2, ChevronDown, User, Smartphone, Tag, Plus, ShieldAlert, Zap, X, Wallet, FileEdit, Globe, Bell, Mail, MapPin, Target, Send, StickyNote, CalendarClock, Clock, ArrowRight, CheckCircle2, XCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { CreateCreditSaleDialog } from '@/components/contacts/CreateCreditSaleDialog';
import { EditContactDialog } from '@/components/contacts/EditContactDialog';
import { ReminderItem } from '@/components/chat/memory/ReminderItem';
import { extractTagText } from '@/lib/tag-parser';

interface MemoryPanelProps {
  currentAnalysis: any;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  memoryForm: any;
  setMemoryForm: (val: any) => void;
  onSave: () => void;
  saving: boolean;
  onReset: () => void;
  onToggleFollowup?: () => void;
  onAnalysisComplete?: () => void;
  onDeleteLead?: () => void;
}

export const MemoryPanel = ({
  currentAnalysis, isEditing, setIsEditing,
  memoryForm, setMemoryForm, onSave, saving,
  onToggleFollowup, onAnalysisComplete, onDeleteLead
}: MemoryPanelProps) => {

  const { user, isManager, profile } = useAuth();
  const [analyzing, setAnalyzing] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  
  const [localTags, setLocalTags] = useState<{id: string, text: string, color: string}[]>([]);
  const [globalTags, setGlobalTags] = useState<{id: string, text: string, color: string}[]>([]);
  
  const [contactData, setContactData] = useState<any>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [isCreditOpen, setIsCreditOpen] = useState(false);
  const [isFullEditOpen, setIsFullEditOpen] = useState(false);

  const [tacticalOpen, setTacticalOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [remindersOpen, setRemindersOpen] = useState(true);

  const [internalNotes, setInternalNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [sendingNote, setSendingNote] = useState(false);

  // Lógica defensiva
  const emailVal = String(currentAnalysis?.email || '');
  const nombreVal = String(currentAnalysis?.nombre || '');
  const ciudadVal = String(currentAnalysis?.ciudad || '');
  const summaryVal = String(currentAnalysis?.summary || 'Generando resumen...');
  const perfilVal = String(currentAnalysis?.perfil_psicologico || 'Analizando conversaciones para perfilar...');

  const capiFields = [ true, !!(emailVal && emailVal.includes('@')), !!(nombreVal && !nombreVal.toLowerCase().includes('nuevo')), !!(ciudadVal && ciudadVal.length > 2) ];
  const healthScore = capiFields.filter(Boolean).length;
  const healthPercent = Math.round((healthScore / 4) * 100);

  const safeAgents = Array.isArray(agents) ? agents : [];
  const safeChannels = Array.isArray(channels) ? channels : [];
  const currentAgentName = String(safeAgents.find(a => a.id === currentAnalysis?.assigned_to)?.full_name || 'Bot Global');
  const currentChannelName = String(safeChannels.find(c => c.id === currentAnalysis?.channel_id)?.name || 'Canal Desconocido');
  const allAvailableTags = [...(Array.isArray(globalTags) ? globalTags : []), ...(Array.isArray(localTags) ? localTags : [])];

  useEffect(() => { 
    fetchAgents(); 
    fetchChannels();
    fetchGroups();
    if (user) fetchTags();
  }, [user]);

  useEffect(() => {
    if (currentAnalysis?.id) {
       fetchContactData();
       fetchInternalNotes();
    }
  }, [currentAnalysis?.id]);

  const fetchInternalNotes = async () => {
     if (!currentAnalysis?.id) return;
     const { data } = await supabase.from('conversaciones')
        .select('*')
        .eq('lead_id', currentAnalysis.id)
        .eq('emisor', 'NOTA')
        .eq('platform', 'PANEL_INTERNO')
        .order('created_at', { ascending: true });
     if (data) setInternalNotes(data);
  };

  const handleAddInternalNote = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!newNote.trim()) return;
     setSendingNote(true);
     try {
        const payload = {
           lead_id: currentAnalysis.id,
           emisor: 'NOTA',
           platform: 'PANEL_INTERNO',
           mensaje: newNote.trim(),
           metadata: { author: profile?.full_name || 'Miembro del Equipo' }
        };
        const { data, error } = await supabase.from('conversaciones').insert(payload).select().single();
        if (error) throw error;
        setInternalNotes(prev => [...prev, data]);
        setNewNote('');
     } catch (err: any) {
        toast.error("Error al guardar nota");
     } finally {
        setSendingNote(false);
     }
  };

  const fetchGroups = async () => {
     const { data } = await supabase.from('contacts').select('grupo').not('grupo', 'is', null);
     if (data) setGroups(Array.from(new Set(data.map(d => d.grupo).filter(Boolean))) as string[]);
  };

  const fetchContactData = async () => {
     const { data } = await supabase.from('contacts').select('*').eq('lead_id', currentAnalysis.id).maybeSingle();
     if (data) setContactData(data);
  };

  const fetchAgents = async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, role');
      if (data) setAgents(data);
  };

  const fetchChannels = async () => {
      const { data } = await supabase.from('whatsapp_channels').select('id, name, provider').eq('is_active', true);
      if (data) setChannels(data);
  };

  const fetchTags = async () => {
     if(!user) return;
     const { data } = await supabase.from('app_config').select('key, value').in('key', [`agent_tags_${user.id}`, 'global_tags']);
     if (data) {
        const local = data.find(d => d.key === `agent_tags_${user.id}`)?.value;
        const global = data.find(d => d.key === 'global_tags')?.value;
        if (local) { try { const parsed = JSON.parse(local); if (Array.isArray(parsed)) setLocalTags(parsed); } catch(e) {} }
        if (global) { try { const parsed = JSON.parse(global); if (Array.isArray(parsed)) setGlobalTags(parsed); } catch(e) {} }
     }
  };

  const handleRunAnalysis = async () => {
     setAnalyzing(true);
     try {
        await supabase.functions.invoke('analyze-leads', { body: { lead_id: currentAnalysis.id, force: true } });
        if (onAnalysisComplete) onAnalysisComplete();
     } catch (err: any) { toast.error("Error: " + err.message); } finally { setAnalyzing(false); }
  };

  const handleUpdatePaymentStatus = async (status: string) => {
     try {
         const updates: any = { payment_status: status };
         if (status === 'VALID') { updates.buying_intent = 'COMPRADO'; updates.followup_stage = 100; }
         await supabase.from('leads').update(updates).eq('id', currentAnalysis.id);
         toast.success("Auditoría actualizada.");
         if (onAnalysisComplete) onAnalysisComplete();
     } catch (err: any) { toast.error("Error al actualizar pago."); }
  };

  const handleAddTag = async (tagText: string) => {
      const currentTags = Array.isArray(memoryForm.tags) ? memoryForm.tags : [];
      if (currentTags.includes(tagText)) return;
      const newTags = [...currentTags, tagText];
      setMemoryForm({...memoryForm, tags: newTags});
      await supabase.from('leads').update({ tags: newTags }).eq('id', currentAnalysis.id);
      toast.success("Etiqueta asignada.");
  };

  const handleRemoveTag = async (rawTag: any) => {
      const currentTags = Array.isArray(memoryForm.tags) ? memoryForm.tags : [];
      const newTags = currentTags.filter((t: any) => extractTagText(t) !== extractTagText(rawTag));
      setMemoryForm({...memoryForm, tags: newTags});
      await supabase.from('leads').update({ tags: newTags }).eq('id', currentAnalysis.id);
  };

  const handleIntentChange = async (newIntent: string) => {
      if (currentAnalysis?.buying_intent === newIntent) return;
      try {
          await supabase.from('leads').update({ buying_intent: newIntent }).eq('id', currentAnalysis.id);
          setMemoryForm({ ...memoryForm, buying_intent: newIntent });
          if (currentAnalysis) currentAnalysis.buying_intent = newIntent;
          toast.success(`Movido a: ${newIntent}`);
          if (onAnalysisComplete) onAnalysisComplete();
      } catch (err: any) {
          toast.error("Error al actualizar etapa");
      }
  };

  const handleAddReminder = () => {
      const newReminder = {
          id: Date.now().toString(),
          title: '',
          datetime: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
          notify_minutes: 15
      };
      setMemoryForm({ ...memoryForm, reminders: [...(memoryForm.reminders || []), newReminder] });
      setIsEditing(true);
  };

  const handleUpdateReminder = (id: string, field: string, val: any) => {
      const updated = memoryForm.reminders.map((r: any) => r.id === id ? { ...r, [field]: val } : r);
      setMemoryForm({ ...memoryForm, reminders: updated });
      setIsEditing(true);
  };

  const handleRemoveReminder = (id: string) => {
      const updated = memoryForm.reminders.filter((r: any) => r.id !== id);
      setMemoryForm({ ...memoryForm, reminders: updated });
      setIsEditing(true);
  };

  const minutesSinceLastMsg = currentAnalysis?.last_message_at 
      ? Math.floor((new Date().getTime() - new Date(currentAnalysis.last_message_at).getTime()) / 60000) 
      : 0;

  return (
    <div className="w-full flex-shrink-0 bg-[#0a0a0c] flex flex-col h-full text-slate-300">
      {/* HEADER EMQ */}
      <div className="p-5 border-b border-[#1a1a1a]">
        <div className="flex justify-between items-center mb-3">
           <span className="text-[9px] font-bold text-[#7A8A9E] uppercase tracking-widest">Event Match Quality</span>
           <button onClick={handleRunAnalysis} disabled={analyzing} className="p-1.5 rounded-md bg-[#161618] border border-[#222225] hover:bg-[#222225] transition-colors">
              {analyzing ? <Loader2 className="w-3 h-3 text-[#7A8A9E] animate-spin" /> : <Database className="w-3 h-3 text-[#7A8A9E]" />}
           </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-[#161618] rounded-full overflow-hidden">
            <div className={cn("h-full transition-all duration-1000", healthPercent > 70 ? 'bg-emerald-500' : healthPercent > 40 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${healthPercent}%` }} />
          </div>
          <span className="text-[10px] font-mono font-bold text-amber-500">{healthScore}/4</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* BOTONES RÁPIDOS */}
        {contactData && (
           <div className="px-5 pt-5 flex gap-2">
              <Button onClick={() => setIsFullEditOpen(true)} variant="outline" className="flex-1 h-9 bg-[#121214] border-[#222225] hover:bg-[#161618] text-slate-300 text-[10px] font-bold uppercase tracking-widest"><FileEdit className="w-3.5 h-3.5 mr-1.5" /> Editar</Button>
              {isManager && <Button onClick={() => setIsCreditOpen(true)} className="flex-1 h-9 bg-amber-600 hover:bg-amber-500 text-slate-950 text-[10px] font-bold uppercase tracking-widest shadow-lg"><Wallet className="w-3.5 h-3.5 mr-1.5" /> Venta / Pagos</Button>}
           </div>
        )}

        {/* EMBUDO RÁPIDO */}
        <div className="p-5 border-b border-[#1a1a1a] space-y-4">
           <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2"><Target className="w-3.5 h-3.5" /> Etapa del Embudo</h4>
           <div className="grid grid-cols-4 gap-1 bg-[#121214] p-1 rounded-xl border border-[#222225]">
              {['BAJO', 'MEDIO', 'ALTO', 'COMPRADO'].map((intent, i) => {
                 const isActive = currentAnalysis?.buying_intent === intent;
                 const isLost = currentAnalysis?.buying_intent === 'PERDIDO';
                 const labels = ['Hunting', 'Seducción', 'Cierre', 'Ganado'];
                 const colors = ['bg-slate-700', 'bg-indigo-600', 'bg-amber-500', 'bg-emerald-500'];
                 return (
                    <button key={intent} onClick={() => handleIntentChange(intent)} className={cn("relative h-8 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all", isActive ? cn(colors[i], "text-white shadow-lg") : "hover:bg-[#1a1a1d] text-slate-500", isLost && "opacity-30")}>{labels[i]}</button>
                 )
              })}
           </div>
           {currentAnalysis?.buying_intent === 'PERDIDO' && <div className="text-center text-[10px] text-red-500 font-bold uppercase tracking-widest bg-red-950/20 py-1.5 rounded-lg border border-red-900/30">LEAD DESCARTADO / PERDIDO</div>}
        </div>

        {/* RADAR DE RETARGETING IA */}
        <div className="p-5 border-b border-[#1a1a1a] space-y-4">
           <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Motor de Retargeting IA</h4>
           <div className="bg-[#121214] border border-[#222225] rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                 <span className="text-[10px] text-slate-400">Estatus del Piloto:</span>
                 {currentAnalysis?.ai_paused ? (
                    <Badge className="bg-red-950/40 text-red-400 border border-red-900/50 text-[9px] uppercase"><XCircle className="w-3 h-3 mr-1"/> Pausado Manual</Badge>
                 ) : currentAnalysis?.buying_intent === 'COMPRADO' || currentAnalysis?.buying_intent === 'PERDIDO' ? (
                    <Badge className="bg-slate-800 text-slate-400 border border-slate-700 text-[9px] uppercase"><CheckCircle2 className="w-3 h-3 mr-1"/> Desactivado (Fin)</Badge>
                 ) : (
                    <Badge className="bg-indigo-900/30 text-indigo-400 border border-indigo-500/30 text-[9px] uppercase"><Zap className="w-3 h-3 mr-1"/> Buscando Interacción</Badge>
                 )}
              </div>
              {!currentAnalysis?.ai_paused && currentAnalysis?.buying_intent !== 'COMPRADO' && currentAnalysis?.buying_intent !== 'PERDIDO' && (
                 <>
                    <div className="flex justify-between text-[10px] font-mono">
                       <span className="text-slate-500">Último mensaje:</span>
                       <span className={cn("font-bold", minutesSinceLastMsg > 60 ? "text-amber-500" : "text-slate-300")}>{minutesSinceLastMsg} mins ago</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-[#222225]">
                       <span className="text-[10px] text-slate-500">Fase Actual:</span>
                       <div className="flex gap-1">
                          {[0, 1, 2, 3].map(stage => (
                             <div key={stage} className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border", currentAnalysis?.followup_stage === stage ? "bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]" : currentAnalysis?.followup_stage > stage ? "bg-emerald-900/30 text-emerald-500 border-emerald-500/30" : "bg-[#161618] text-slate-600 border-[#333336]")}>{stage}</div>
                          ))}
                       </div>
                    </div>
                 </>
              )}
           </div>
        </div>

        {/* AUDITORÍA DE PAGO */}
        <div className="p-5 border-b border-[#1a1a1a] space-y-4">
           <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2"><Wallet className="w-3.5 h-3.5 text-[#7A8A9E]" /> Auditoría de Pago</h4>
           <div className="bg-[#121214] border border-[#222225] rounded-xl p-4 space-y-4">
              <div className="flex justify-between items-center">
                 <span className="text-[10px] text-[#7A8A9E]">Dictamen IA:</span>
                 <Badge variant="outline" className={cn("text-[9px] border-[#222225] h-5 px-2", currentAnalysis?.payment_status === 'VALID' ? 'bg-emerald-900/20 text-emerald-500 border-emerald-500/30' : 'bg-[#0a0a0c] text-[#7A8A9E]')}>
                    {currentAnalysis?.payment_status === 'VALID' ? 'APROBADO' : 'SIN COMPROBANTE'}
                 </Badge>
              </div>
              <div className="flex gap-3">
                 <Button onClick={() => handleUpdatePaymentStatus('VALID')} variant="outline" size="sm" className="flex-1 h-8 bg-transparent border-emerald-900/50 text-emerald-500 hover:bg-emerald-950/30 text-[10px] uppercase font-bold tracking-widest">Validar</Button>
                 <Button onClick={() => handleUpdatePaymentStatus('INVALID')} variant="outline" size="sm" className="flex-1 h-8 bg-transparent border-red-900/50 text-red-500 hover:bg-red-950/30 text-[10px] uppercase font-bold tracking-widest">Denegar</Button>
              </div>
           </div>
        </div>

        <div className="p-5 border-b border-[#1a1a1a] space-y-4">
           <div className="flex justify-between items-center mb-2">
              <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2"><Fingerprint className="w-3.5 h-3.5 text-[#7A8A9E]" /> Identidad & CRM</h4>
              {!isEditing && <button onClick={() => setIsEditing(true)} className="text-[#7A8A9E] hover:text-white transition-colors" title="Edición Rápida"><Edit2 className="w-3.5 h-3.5" /></button>}
           </div>

           {isEditing ? (
              <div className="space-y-4 bg-[#121214] p-4 rounded-xl border border-[#222225] animate-in fade-in">
                 <div className="grid grid-cols-2 gap-2">
                    <Input value={String(memoryForm.nombre)} onChange={e => setMemoryForm({...memoryForm, nombre: e.target.value})} placeholder="Nombre" className="h-8 text-xs bg-[#0a0a0c] border-[#222225]" />
                    <Input value={String(memoryForm.ciudad)} onChange={e => setMemoryForm({...memoryForm, ciudad: e.target.value})} placeholder="Ciudad" className="h-8 text-xs bg-[#0a0a0c] border-[#222225]" />
                 </div>
                 <Input value={String(memoryForm.email)} onChange={e => setMemoryForm({...memoryForm, email: e.target.value})} placeholder="Email" className="h-8 text-xs bg-[#0a0a0c] border-[#222225]" />
                 <Button onClick={onSave} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-bold rounded-lg uppercase tracking-widest mt-2 shadow-lg">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Ficha"}</Button>
              </div>
           ) : (
              <div className="space-y-4">
                 <div>
                    <button onClick={() => setTacticalOpen(!tacticalOpen)} className="w-full flex justify-between items-center py-2 text-[10px] font-bold text-white uppercase tracking-widest hover:text-indigo-400 transition-colors">Resumen Táctico<ChevronDown className={cn("w-3.5 h-3.5 transition-transform", tacticalOpen ? "rotate-180" : "")} /></button>
                    {tacticalOpen && (
                       <div className="grid grid-cols-2 gap-y-5 gap-x-4 pt-2 pb-4 animate-in slide-in-from-top-2">
                          <div>
                             <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest">Agente</span>
                             <p className="text-[11px] text-slate-300 mt-1 flex items-center gap-1.5"><User className="w-3 h-3 text-[#7A8A9E]"/> {currentAgentName}</p>
                          </div>
                          <div>
                             <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest">Canal</span>
                             <p className="text-[11px] text-indigo-400 mt-1 flex items-center gap-1.5 font-bold"><Smartphone className="w-3 h-3 text-indigo-400"/> {currentChannelName}</p>
                          </div>
                          <div className="col-span-2 grid grid-cols-2 gap-4 mt-1 mb-1 p-3 bg-[#121214] rounded-xl border border-[#222225]">
                             <div className="overflow-hidden">
                                <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest flex items-center gap-1"><Mail className="w-3 h-3"/> Email</span>
                                <p className="text-[11px] text-slate-300 mt-1 truncate" title={emailVal || 'No capturado'}>{emailVal || 'N/A'}</p>
                             </div>
                             <div className="overflow-hidden">
                                <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest flex items-center gap-1"><MapPin className="w-3 h-3"/> Ciudad</span>
                                <p className="text-[11px] text-slate-300 mt-1 truncate" title={ciudadVal || 'No capturada'}>{ciudadVal || 'N/A'}</p>
                             </div>
                          </div>
                          <div className="col-span-2">
                             <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest">Resumen IA</span>
                             <p className="text-[11px] text-emerald-400/80 italic mt-1 leading-relaxed">{summaryVal}</p>
                          </div>
                          <div className="col-span-2">
                             <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest">Perfil Psicográfico</span>
                             <p className="text-[11px] text-amber-500/80 italic mt-1 leading-relaxed">{perfilVal}</p>
                          </div>
                       </div>
                    )}
                 </div>

                 {/* BLOQUE RECORDATORIOS / TAREAS */}
                 <div className="pt-2 border-t border-[#1a1a1a]">
                    <button onClick={() => setRemindersOpen(!remindersOpen)} className="w-full flex justify-between items-center py-2 text-[10px] font-bold text-white uppercase tracking-widest hover:text-blue-400 transition-colors">
                       <span className="flex items-center gap-2"><CalendarClock className="w-3.5 h-3.5 text-blue-500" /> Tareas y Recordatorios</span>
                       <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", remindersOpen ? "rotate-180" : "")} />
                    </button>
                    {remindersOpen && (
                       <div className="pt-3 pb-2 space-y-3">
                          {memoryForm.reminders?.length === 0 ? (
                             <p className="text-[10px] text-slate-600 italic text-center py-2">No hay tareas programadas.</p>
                          ) : (
                             <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                {memoryForm.reminders?.map((rem: any) => (
                                   <ReminderItem key={rem.id} reminder={rem} onUpdate={handleUpdateReminder} onRemove={handleRemoveReminder} />
                                ))}
                             </div>
                          )}
                          <Button onClick={handleAddReminder} variant="outline" className="w-full h-8 text-[10px] bg-[#121214] border-[#222225] text-blue-400 hover:text-blue-300 hover:bg-[#161618] uppercase tracking-widest font-bold">
                             <Plus className="w-3 h-3 mr-2" /> Agendar Nueva Tarea
                          </Button>
                       </div>
                    )}
                 </div>

                 {/* BLOQUE NOTAS COLABORATIVAS */}
                 <div className="pt-2 border-t border-[#1a1a1a]">
                    <button onClick={() => setNotesOpen(!notesOpen)} className="w-full flex justify-between items-center py-2 text-[10px] font-bold text-white uppercase tracking-widest hover:text-amber-400 transition-colors"><span className="flex items-center gap-2"><StickyNote className="w-3.5 h-3.5 text-amber-500" /> Notas Internas (Equipo)</span><ChevronDown className={cn("w-3.5 h-3.5 transition-transform", notesOpen ? "rotate-180" : "")} /></button>
                    {notesOpen && (
                       <div className="pt-3 pb-2 space-y-3">
                          {internalNotes.length === 0 ? (
                             <p className="text-[10px] text-slate-600 italic text-center py-2">No hay notas registradas.</p>
                          ) : (
                             <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                {internalNotes.map(n => (
                                   <div key={n.id} className="bg-amber-950/20 border border-amber-900/50 p-2.5 rounded-lg">
                                      <div className="flex justify-between items-center mb-1">
                                         <span className="text-[9px] font-bold text-amber-500">{n.metadata?.author || 'Agente'}</span>
                                         <span className="text-[8px] text-slate-500 font-mono">{new Date(n.created_at).toLocaleDateString()}</span>
                                      </div>
                                      <p className="text-[10px] text-amber-100/90 leading-relaxed">{n.mensaje}</p>
                                   </div>
                                ))}
                             </div>
                          )}
                          <form onSubmit={handleAddInternalNote} className="flex gap-2">
                             <Input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Añadir nota rápida..." className="h-8 text-[10px] bg-[#121214] border-[#222225] focus-visible:ring-amber-500 text-slate-200" disabled={sendingNote}/>
                             <Button type="submit" size="icon" className="h-8 w-8 bg-amber-600 hover:bg-amber-500 text-slate-900 shrink-0" disabled={sendingNote || !newNote.trim()}><Send className="w-3 h-3"/></Button>
                          </form>
                       </div>
                    )}
                 </div>

                 {/* BLOQUE ETIQUETAS */}
                 <div className="pt-2 border-t border-[#1a1a1a]">
                    <button onClick={() => setTagsOpen(!tagsOpen)} className="w-full flex justify-between items-center py-2 text-[10px] font-bold text-white uppercase tracking-widest hover:text-indigo-400 transition-colors"><span className="flex items-center gap-2"><Tag className="w-3.5 h-3.5 text-[#7A8A9E]" /> Etiquetas Asignadas</span><ChevronDown className={cn("w-3.5 h-3.5 transition-transform", tagsOpen ? "rotate-180" : "")} /></button>
                    {tagsOpen && (
                       <div className="flex flex-wrap gap-2 items-center pt-3 pb-2">
                          {Array.isArray(memoryForm.tags) && memoryForm.tags.map((rawTag: any) => {
                             const t = extractTagText(rawTag);
                             if (!t) return null;
                             const tagConf = allAvailableTags.find(lt => lt.text === t);
                             const isGlobal = globalTags.some(gt => gt.text === t);
                             return (
                                <Badge key={t} style={{ backgroundColor: (tagConf?.color || '#161618') + '15', color: tagConf?.color || '#94a3b8', borderColor: (tagConf?.color || '#222225') + '40' }} className="text-[9px] h-6 border pr-1 pl-1.5 font-bold flex items-center gap-1.5 shadow-sm">
                                   {isGlobal ? <Globe className="w-2.5 h-2.5 opacity-70 shrink-0"/> : <User className="w-2.5 h-2.5 opacity-70 shrink-0"/>}
                                   <span className="truncate max-w-[120px]">{t}</span>
                                   <button onClick={() => handleRemoveTag(rawTag)} className="ml-0.5 hover:bg-black/20 rounded-full p-0.5 transition-colors"><X className="w-3 h-3"/></button>
                                </Badge>
                             );
                          })}
                          
                          <Select onValueChange={(v) => { if(v) handleAddTag(v); }}>
                              <SelectTrigger className="h-6 text-[10px] bg-transparent border border-dashed border-[#333336] hover:bg-[#161618] text-slate-400 w-auto px-3 shadow-none focus:ring-0 rounded-full transition-colors"><Plus className="w-3 h-3 mr-1" /> Añadir</SelectTrigger>
                              <SelectContent className="bg-[#121214] border-[#222225] max-h-[300px]">
                                  {globalTags.length > 0 && <div className="text-[9px] font-bold text-slate-500 uppercase px-2 py-1.5 flex items-center gap-1.5"><Globe className="w-3 h-3"/> Equipo (Globales)</div>}
                                  {globalTags.map(tag => (
                                      <SelectItem key={`g-${tag.id}`} value={tag.text} className="text-xs text-white focus:bg-[#161618] cursor-pointer">
                                          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full shadow-inner" style={{backgroundColor: tag.color}}></div>{tag.text}</div>
                                      </SelectItem>
                                  ))}
                                  {localTags.length > 0 && <div className="text-[9px] font-bold text-slate-500 uppercase px-2 py-1.5 mt-2 flex items-center gap-1.5 border-t border-[#222225] pt-2"><User className="w-3 h-3"/> Mis Etiquetas (Personal)</div>}
                                  {localTags.map(tag => (
                                      <SelectItem key={`l-${tag.id}`} value={tag.text} className="text-xs text-white focus:bg-[#161618] cursor-pointer">
                                          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full shadow-inner" style={{backgroundColor: tag.color}}></div>{tag.text}</div>
                                      </SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                       </div>
                    )}
                 </div>
              </div>
           )}
        </div>
      </div>

      <div className="p-5 bg-[#0a0a0c] border-t border-[#1a1a1a] mt-auto">
         <Button onClick={onToggleFollowup} className={cn("w-full h-12 text-[10px] font-bold tracking-widest uppercase rounded-xl border transition-all duration-300 shadow-none", currentAnalysis?.ai_paused ? "bg-emerald-950/30 text-emerald-500 border-emerald-900/50" : "bg-[#3d0f0f] text-red-400 border-[#5e1616]")}>
            {currentAnalysis?.ai_paused ? "▶ ACTIVAR IA" : "⏸ PAUSAR IA"}
         </Button>
      </div>

      {isCreditOpen && contactData && <CreateCreditSaleDialog open={isCreditOpen} onOpenChange={setIsCreditOpen} contact={contactData} onSuccess={() => { fetchContactData(); toast.success("Venta a crédito programada."); }} />}
      {isFullEditOpen && contactData && <EditContactDialog open={isFullEditOpen} onOpenChange={setIsFullEditOpen} contact={contactData} existingGroups={groups} allTags={allAvailableTags} globalTags={globalTags} onSuccess={() => { fetchContactData(); if (onAnalysisComplete) onAnalysisComplete(); }} />}
    </div>
  );
};