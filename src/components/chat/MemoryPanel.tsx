import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Database, Loader2, Fingerprint, Trash2, Edit2, ChevronDown, User, Smartphone, Tag, Plus, ShieldAlert, Zap, X, Wallet, FileEdit, Globe, Bell
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { FinancialStatusBadge } from '@/components/contacts/FinancialStatusBadge';
import { Textarea } from '@/components/ui/textarea';
import { CreateCreditSaleDialog } from '@/components/contacts/CreateCreditSaleDialog';
import { EditContactDialog } from '@/components/contacts/EditContactDialog';
import { ReminderItem } from '@/components/chat/memory/ReminderItem';

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
  const [correctionText, setCorrectionText] = useState('');
  const [reporting, setReporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  
  // Tag System
  const [localTags, setLocalTags] = useState<{id: string, text: string, color: string}[]>([]);
  const [globalTags, setGlobalTags] = useState<{id: string, text: string, color: string}[]>([]);
  
  const [contactData, setContactData] = useState<any>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [isCreditOpen, setIsCreditOpen] = useState(false);
  const [isFullEditOpen, setIsFullEditOpen] = useState(false);

  const [tacticalOpen, setTacticalOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);

  const capiFields = [
     true, 
     !!(currentAnalysis.email && currentAnalysis.email.includes('@')),
     !!(currentAnalysis.nombre && !currentAnalysis.nombre.toLowerCase().includes('nuevo')),
     !!(currentAnalysis.ciudad && currentAnalysis.ciudad.length > 2)
  ];
  const healthScore = capiFields.filter(Boolean).length;
  const healthPercent = Math.round((healthScore / 4) * 100);

  useEffect(() => { 
    fetchAgents(); 
    fetchChannels();
    fetchGroups();
    if (user) fetchTags();
  }, [user]);

  useEffect(() => {
    if (currentAnalysis?.id) {
       fetchContactData();
    }
  }, [currentAnalysis?.id]);

  const fetchGroups = async () => {
     const { data } = await supabase.from('contacts').select('grupo').not('grupo', 'is', null);
     if (data) {
        const uniqueGroups = Array.from(new Set(data.map(d => d.grupo).filter(Boolean))) as string[];
        setGroups(uniqueGroups);
     }
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
        if (local) try { setLocalTags(JSON.parse(local)); } catch(e) {}
        if (global) try { setGlobalTags(JSON.parse(global)); } catch(e) {}
     }
  };

  const handleReportCia = async () => {
      if (!correctionText.trim()) return;
      setReporting(true);
      const tid = toast.loading("Vinculando reporte al contexto del chat...");
      try {
          const { data: lastMsgs } = await supabase.from('conversaciones').select('mensaje, emisor').eq('lead_id', currentAnalysis.id).order('created_at', { ascending: false }).limit(2);
          const clientMsg = lastMsgs?.find(m => m.emisor === 'CLIENTE')?.mensaje || 'Contexto de chat activo';
          const aiMsg = lastMsgs?.find(m => m.emisor !== 'CLIENTE')?.mensaje || 'N/A';

          const { error } = await supabase.from('errores_ia').insert({
              usuario_id: user?.id,
              cliente_id: currentAnalysis.id,
              mensaje_cliente: clientMsg,
              respuesta_ia: aiMsg,
              correccion_sugerida: correctionText,
              estado_correccion: 'REPORTADA',
              categoria: 'CONDUCTA',
              created_by: profile?.full_name || 'Agente'
          });

          if (error) throw error;
          toast.success("Regla enviada a la Bitácora #CIA.", { id: tid });
          setCorrectionText('');
      } catch (err: any) {
          toast.error("Fallo al reportar: " + err.message, { id: tid });
      } finally {
          setReporting(false);
      }
  };

  const handleRunAnalysis = async () => {
     setAnalyzing(true);
     try {
        await supabase.functions.invoke('analyze-leads', { body: { lead_id: currentAnalysis.id, force: true } });
        if (onAnalysisComplete) onAnalysisComplete();
     } catch (err: any) {
        toast.error("Error: " + err.message);
     } finally {
        setAnalyzing(false);
     }
  };

  const handleDirectAgentChange = async (newAgentId: string) => {
      const val = newAgentId === "unassigned" ? null : newAgentId;
      try {
          await supabase.from('leads').update({ assigned_to: val }).eq('id', currentAnalysis.id);
          setMemoryForm({...memoryForm, assigned_to: val});
          toast.success("Asignación de asesor actualizada.");
      } catch (e) {
          toast.error("Error al reasignar.");
      }
  };

  const handleUpdatePaymentStatus = async (status: string) => {
     const tid = toast.loading("Actualizando auditoría...");
     try {
         const updates: any = { payment_status: status };
         if (status === 'VALID') updates.buying_intent = 'COMPRADO';
         const { error } = await supabase.from('leads').update(updates).eq('id', currentAnalysis.id);
         if (error) throw error;
         toast.success("Auditoría actualizada.", { id: tid });
         if (onAnalysisComplete) onAnalysisComplete();
     } catch (err: any) {
         toast.error(err.message, { id: tid });
     }
  };

  const handleAddTag = async (tagText: string) => {
      const currentTags = memoryForm.tags || [];
      if (currentTags.includes(tagText)) return;

      const newTags = [...currentTags, tagText];
      setMemoryForm({...memoryForm, tags: newTags});
      await supabase.from('leads').update({ tags: newTags }).eq('id', currentAnalysis.id);
  };

  const handleRemoveTag = async (tagText: string) => {
      const newTags = (memoryForm.tags || []).filter((t: string) => t !== tagText);
      setMemoryForm({...memoryForm, tags: newTags});
      await supabase.from('leads').update({ tags: newTags }).eq('id', currentAnalysis.id);
  };

  // Funciones de Recordatorios
  const handleAddReminder = () => {
      const newReminders = [...(memoryForm.reminders || []), { id: Date.now().toString(), title: '', datetime: '', notify_minutes: 15 }];
      setMemoryForm({...memoryForm, reminders: newReminders});
  };
  const handleUpdateReminder = (id: string, field: string, val: any) => {
      const newReminders = memoryForm.reminders.map((r: any) => r.id === id ? { ...r, [field]: val } : r);
      setMemoryForm({...memoryForm, reminders: newReminders});
  };
  const handleRemoveReminder = (id: string) => {
      const newReminders = memoryForm.reminders.filter((r: any) => r.id !== id);
      setMemoryForm({...memoryForm, reminders: newReminders});
  };

  const currentAgentName = agents.find(a => a.id === currentAnalysis.assigned_to)?.full_name || 'Bot Global';
  const currentChannelName = channels.find(c => c.id === currentAnalysis.channel_id)?.name || 'Canal Desconocido';
  const allAvailableTags = [...globalTags, ...localTags];

  return (
    <div className="w-full flex-shrink-0 bg-[#0a0a0c] flex flex-col h-full text-slate-300">
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
        {contactData && (
           <div className="px-5 pt-5 flex gap-2">
              <Button onClick={() => setIsFullEditOpen(true)} variant="outline" className="flex-1 h-9 bg-[#121214] border-[#222225] hover:bg-[#161618] text-slate-300 text-[10px] font-bold uppercase tracking-widest">
                 <FileEdit className="w-3.5 h-3.5 mr-1.5" /> Editar
              </Button>
              {isManager && (
                 <Button onClick={() => setIsCreditOpen(true)} className="flex-1 h-9 bg-amber-600 hover:bg-amber-500 text-slate-950 text-[10px] font-bold uppercase tracking-widest shadow-lg">
                    <Wallet className="w-3.5 h-3.5 mr-1.5" /> Venta / Pagos
                 </Button>
              )}
           </div>
        )}

        <div className="p-5 border-b border-[#1a1a1a] space-y-4">
           <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2">
              <span className="w-3 h-3 border border-indigo-400 rounded-sm flex items-center justify-center text-[6px] text-indigo-400">💳</span> Auditoría de Pago
           </h4>
           <div className="bg-[#121214] border border-[#222225] rounded-xl p-4 space-y-4">
              <div className="flex justify-between items-center">
                 <span className="text-[10px] text-[#7A8A9E]">Dictamen IA:</span>
                 <Badge variant="outline" className="text-[9px] border-[#222225] bg-[#0a0a0c] text-[#7A8A9E] h-5 px-2">
                    {currentAnalysis.payment_status === 'VALID' ? 'APROBADO' : currentAnalysis.payment_status === 'INVALID' ? 'RECHAZADO' : 'SIN COMPROBANTE'}
                 </Badge>
              </div>
              <div className="flex gap-3">
                 <Button onClick={() => handleUpdatePaymentStatus('VALID')} variant="outline" size="sm" className="flex-1 h-8 bg-transparent border-emerald-900/50 text-emerald-500 hover:bg-emerald-950/30 hover:text-emerald-400 text-[10px] uppercase font-bold tracking-widest">Validar</Button>
                 <Button onClick={() => handleUpdatePaymentStatus('INVALID')} variant="outline" size="sm" className="flex-1 h-8 bg-transparent border-red-900/50 text-red-500 hover:bg-red-950/30 hover:text-red-400 text-[10px] uppercase font-bold tracking-widest">Denegar</Button>
              </div>
           </div>
        </div>

        <div className="p-5 border-b border-[#1a1a1a] space-y-4">
           <div className="flex justify-between items-center mb-2">
              <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2">
                 <Fingerprint className="w-3.5 h-3.5 text-[#7A8A9E]" /> Identidad & CRM
              </h4>
              <div className="flex gap-2">
                {isManager && onDeleteLead && (
                   <button onClick={() => { if(confirm("¿Borrar lead permanentemente?")) onDeleteLead(); }} className="text-[#7A8A9E] hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                   </button>
                )}
                {!isEditing && (
                   <button onClick={() => setIsEditing(true)} className="text-[#7A8A9E] hover:text-white transition-colors" title="Edición Rápida">
                      <Edit2 className="w-3.5 h-3.5" />
                   </button>
                )}
              </div>
           </div>

           {isEditing ? (
              <div className="space-y-4 bg-[#121214] p-4 rounded-xl border border-[#222225] animate-in fade-in">
                 <div className="grid grid-cols-2 gap-2">
                    <Input value={memoryForm.nombre} onChange={e => setMemoryForm({...memoryForm, nombre: e.target.value})} placeholder="Nombre" className="h-8 text-xs bg-[#0a0a0c] border-[#222225] focus-visible:ring-indigo-500" />
                    <Input value={memoryForm.ciudad} onChange={e => setMemoryForm({...memoryForm, ciudad: e.target.value})} placeholder="Ciudad" className="h-8 text-xs bg-[#0a0a0c] border-[#222225] focus-visible:ring-indigo-500" />
                 </div>
                 <Input value={memoryForm.email} onChange={e => setMemoryForm({...memoryForm, email: e.target.value})} placeholder="Email" className="h-8 text-xs bg-[#0a0a0c] border-[#222225] focus-visible:ring-indigo-500" />
                 
                 <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <Label className="text-[9px] text-slate-500 uppercase tracking-widest">Asesor:</Label>
                        <Select value={memoryForm.assigned_to || "unassigned"} onValueChange={v => setMemoryForm({...memoryForm, assigned_to: v === "unassigned" ? null : v})} disabled={!isManager}>
                        <SelectTrigger className="h-8 text-xs bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                            <SelectItem value="unassigned">Bot Global</SelectItem>
                            {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[9px] text-slate-500 uppercase tracking-widest">Canal WA:</Label>
                        <Select value={memoryForm.channel_id || "default"} onValueChange={v => setMemoryForm({...memoryForm, channel_id: v === "default" ? null : v})}>
                        <SelectTrigger className="h-8 text-xs bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                            <SelectItem value="default">Instancia Principal</SelectItem>
                            {channels.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                        </Select>
                    </div>
                 </div>

                 {/* SECCIÓN RECORDATORIOS (MODO EDICIÓN) */}
                 <div className="pt-3 border-t border-[#222225] space-y-3">
                    <Label className="text-[10px] text-amber-500 uppercase tracking-widest flex items-center justify-between font-bold">
                       <span className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5"/> Agendar Seguimiento</span>
                       <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[9px] bg-[#0a0a0c] border-[#333336] text-slate-300 uppercase font-bold" onClick={handleAddReminder}>
                          <Plus className="w-3 h-3 mr-1"/> Tarea
                       </Button>
                    </Label>
                    <div className="space-y-2">
                       {memoryForm.reminders?.length === 0 ? (
                          <p className="text-[9px] text-slate-500 italic text-center py-2">No hay tareas programadas.</p>
                       ) : (
                          memoryForm.reminders?.map((r: any) => (
                             <ReminderItem key={r.id} reminder={r} onUpdate={handleUpdateReminder} onRemove={handleRemoveReminder} />
                          ))
                       )}
                    </div>
                 </div>

                 <Button onClick={onSave} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-9 text-xs font-bold rounded-lg uppercase tracking-widest mt-2 shadow-lg">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar Ficha"}
                 </Button>
              </div>
           ) : (
              <div className="space-y-4">
                 <div>
                    <button onClick={() => setTacticalOpen(!tacticalOpen)} className="w-full flex justify-between items-center py-2 text-[10px] font-bold text-white uppercase tracking-widest hover:text-indigo-400 transition-colors">
                       Resumen Táctico
                       <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", tacticalOpen ? "rotate-180" : "")} />
                    </button>
                    {tacticalOpen && (
                       <div className="grid grid-cols-2 gap-y-5 gap-x-4 pt-2 pb-4 animate-in slide-in-from-top-2">
                          <div>
                             <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest">Agente</span>
                             {isManager ? (
                                <Select value={memoryForm.assigned_to || "unassigned"} onValueChange={handleDirectAgentChange}>
                                   <SelectTrigger className="h-6 text-[11px] bg-transparent border-0 p-0 text-slate-300 hover:text-indigo-400 focus:ring-0 w-full justify-start gap-1.5 shadow-none h-auto">
                                      <User className="w-3 h-3 text-[#7A8A9E]"/> <SelectValue />
                                   </SelectTrigger>
                                   <SelectContent className="bg-[#121214] border-[#222225] text-white text-xs">
                                       <SelectItem value="unassigned">Bot Global</SelectItem>
                                       {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                                   </SelectContent>
                                </Select>
                             ) : (
                                <p className="text-[11px] text-slate-300 mt-1 flex items-center gap-1.5"><User className="w-3 h-3 text-[#7A8A9E]"/> {currentAgentName}</p>
                             )}
                          </div>
                          <div>
                             <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest">Canal</span>
                             <p className="text-[11px] text-indigo-400 mt-1 flex items-center gap-1.5 font-bold"><Smartphone className="w-3 h-3 text-indigo-400"/> {currentChannelName}</p>
                          </div>
                          <div className="col-span-2">
                             <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest">Resumen IA</span>
                             <p className="text-[11px] text-emerald-400/80 italic mt-1 leading-relaxed">
                                {currentAnalysis.summary || 'Generando resumen...'}
                             </p>
                          </div>
                          <div className="col-span-2">
                             <span className="text-[9px] text-[#7A8A9E] uppercase font-bold tracking-widest">Perfil Psicográfico</span>
                             <p className="text-[11px] text-amber-500/80 italic mt-1 leading-relaxed">
                                {currentAnalysis.perfil_psicologico || 'Analizando conversaciones para perfilar...'}
                             </p>
                          </div>
                       </div>
                    )}
                 </div>

                 {/* SECCIÓN RECORDATORIOS (MODO LECTURA) */}
                 {currentAnalysis.reminders && currentAnalysis.reminders.length > 0 && (
                    <div className="pt-2 border-t border-[#1a1a1a]">
                       <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2 mb-3">
                          <Bell className="w-3.5 h-3.5"/> Tareas / Follow-Ups
                       </span>
                       <div className="space-y-2">
                          {currentAnalysis.reminders.map((r: any) => (
                             <div key={r.id} className="bg-[#121214] border border-[#222225] p-3 rounded-xl flex justify-between items-center">
                                <span className="text-xs text-slate-200 font-bold truncate pr-4">{r.title || 'Seguimiento'}</span>
                                <span className="text-[10px] text-amber-500 font-mono bg-amber-500/10 px-2 py-1 rounded-md shrink-0">
                                   {r.datetime ? new Date(r.datetime).toLocaleString([], {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : 'Sin fecha'}
                                </span>
                             </div>
                          ))}
                       </div>
                    </div>
                 )}

                 <div className="pt-2 border-t border-[#1a1a1a]">
                    <button onClick={() => setTagsOpen(!tagsOpen)} className="w-full flex justify-between items-center py-2 text-[10px] font-bold text-white uppercase tracking-widest hover:text-indigo-400 transition-colors">
                       <span className="flex items-center gap-2"><Tag className="w-3.5 h-3.5 text-[#7A8A9E]" /> Etiquetas Asignadas</span>
                       <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", tagsOpen ? "rotate-180" : "")} />
                    </button>
                    {tagsOpen && (
                       <div className="flex flex-wrap gap-2 items-center pt-3 pb-2">
                          {(memoryForm.tags || []).map((t: string) => {
                             const tagConf = allAvailableTags.find(lt => lt.text === t);
                             const isGlobal = globalTags.some(gt => gt.text === t);
                             
                             const bgColor = tagConf ? tagConf.color + '15' : '#161618';
                             const textColor = tagConf ? tagConf.color : '#94a3b8';
                             const borderColor = tagConf ? tagConf.color + '40' : '#222225';
                             return (
                                <Badge key={t} style={{ backgroundColor: bgColor, color: textColor, borderColor }} className="text-[9px] h-6 border pr-1 pl-2 font-bold flex items-center gap-1.5 shadow-sm">
                                   <span title={isGlobal ? "Etiqueta Global" : "Etiqueta Privada"} className="flex">
                                     {isGlobal ? <Globe className="w-2.5 h-2.5 opacity-70" /> : <User className="w-2.5 h-2.5 opacity-70" />}
                                   </span>
                                   {t}
                                   <button onClick={() => handleRemoveTag(t)} className="ml-0.5 hover:bg-black/20 rounded-full p-0.5 transition-colors"><X className="w-3 h-3"/></button>
                                </Badge>
                             );
                          })}
                          
                          <Select onValueChange={(v) => { if(v) handleAddTag(v); }}>
                             <SelectTrigger className="h-6 text-[10px] bg-transparent border border-[#222225] hover:bg-[#161618] text-[#7A8A9E] w-auto px-2 shadow-none focus:ring-0 rounded-full transition-colors font-bold uppercase tracking-widest">
                                <Plus className="w-3 h-3 mr-1" /> Añadir
                             </SelectTrigger>
                             <SelectContent className="bg-[#121214] border-[#222225] max-h-64">
                                {globalTags.length > 0 && (
                                   <div className="py-1.5 px-2">
                                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Globales (Equipo)</div>
                                      {globalTags.map(tag => (
                                         <SelectItem key={tag.id} value={tag.text} className="text-xs text-white focus:bg-[#161618] cursor-pointer rounded-lg">
                                            <div className="flex items-center gap-2">
                                               <div className="w-2 h-2 rounded-full" style={{backgroundColor: tag.color}}></div>
                                               {tag.text}
                                            </div>
                                         </SelectItem>
                                      ))}
                                   </div>
                                )}
                                
                                {localTags.length > 0 && (
                                   <div className="py-1.5 px-2 border-t border-[#222225]">
                                      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 px-1">Privadas (Solo tú)</div>
                                      {localTags.map(tag => (
                                         <SelectItem key={tag.id} value={tag.text} className="text-xs text-white focus:bg-[#161618] cursor-pointer rounded-lg">
                                            <div className="flex items-center gap-2">
                                               <div className="w-2 h-2 rounded-full" style={{backgroundColor: tag.color}}></div>
                                               {tag.text}
                                            </div>
                                         </SelectItem>
                                      ))}
                                   </div>
                                )}

                                {allAvailableTags.length === 0 && (
                                   <div className="p-4 text-xs text-center text-[#7A8A9E]">No hay etiquetas creadas</div>
                                )}
                             </SelectContent>
                          </Select>
                       </div>
                    )}
                 </div>

                 <div className="pt-2 border-t border-[#1a1a1a]">
                    <div className="flex flex-col py-2 space-y-2">
                       <span className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center justify-between">
                          <span>$ Estado Financiero</span>
                       </span>
                       <div>
                          <FinancialStatusBadge 
                             leadId={currentAnalysis.id} 
                             currentStatus={contactData?.financial_status || 'Sin transacción'} 
                             isManager={isManager} 
                             onUpdate={() => {
                                fetchContactData();
                                if (onAnalysisComplete) onAnalysisComplete();
                             }} 
                          />
                       </div>
                    </div>
                 </div>

              </div>
           )}
        </div>

        <div className="p-5 space-y-3">
           <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5" /> Reportar a Bitácora #CIA
           </h4>
           <Textarea 
             value={correctionText} 
             onChange={e => setCorrectionText(e.target.value)} 
             placeholder="¿Qué debe corregir Sam?" 
             className="bg-[#050505] border-[#222225] text-xs min-h-[80px] rounded-xl focus-visible:ring-amber-500/30 text-slate-300 resize-none placeholder:text-[#333336]" 
           />
           <Button 
             onClick={handleReportCia} 
             disabled={!correctionText.trim() || reporting} 
             className="w-full h-10 text-[10px] bg-[#1a120b] text-amber-500 border border-[#3b2513] hover:bg-[#291b0f] font-bold uppercase tracking-widest rounded-xl transition-colors"
           >
             {reporting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Zap className="w-3 h-3 mr-2" />}
             NOTIFICAR MEJORA
           </Button>
        </div>
      </div>

      <div className="p-5 bg-[#0a0a0c] border-t border-[#1a1a1a] mt-auto">
         <Button 
            onClick={onToggleFollowup} 
            className={cn(
               "w-full h-12 text-[10px] font-bold tracking-widest uppercase rounded-xl border transition-all duration-300 shadow-none", 
               currentAnalysis.ai_paused 
                  ? "bg-emerald-950/30 text-emerald-500 border-emerald-900/50 hover:bg-emerald-900/40" 
                  : "bg-[#3d0f0f] text-red-400 border-[#5e1616] hover:bg-[#5e1616] hover:text-white"
            )}
         >
            {currentAnalysis.ai_paused ? "▶ ACTIVAR IA (ESTE CHAT)" : "⏸ PAUSAR IA (ESTE CHAT)"}
         </Button>
      </div>

      {isCreditOpen && contactData && (
         <CreateCreditSaleDialog open={isCreditOpen} onOpenChange={setIsCreditOpen} contact={contactData} onSuccess={() => { fetchContactData(); toast.success("Venta a crédito programada."); }} />
      )}

      {isFullEditOpen && contactData && (
         <EditContactDialog open={isFullEditOpen} onOpenChange={setIsFullEditOpen} contact={contactData} existingGroups={groups} allTags={allAvailableTags} onSuccess={() => { fetchContactData(); if (onAnalysisComplete) onAnalysisComplete(); }} />
      )}
    </div>
  );
};