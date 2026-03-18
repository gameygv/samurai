import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Database, Loader2, Fingerprint, Trash2, Edit2, ChevronDown, User, Smartphone, Tag, Plus, ShieldAlert, Zap, X, Wallet, FileEdit, Globe, Bell, Mail, MapPin
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
  const [correctionText, setCorrectionText] = useState('');
  const [reporting, setReporting] = useState(false);
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

  // Lógica defensiva ABSOLUTA para evitar crash
  const emailVal = String(currentAnalysis?.email || '');
  const nombreVal = String(currentAnalysis?.nombre || '');
  const ciudadVal = String(currentAnalysis?.ciudad || '');
  const summaryVal = String(currentAnalysis?.summary || 'Generando resumen...');
  const perfilVal = String(currentAnalysis?.perfil_psicologico || 'Analizando conversaciones para perfilar...');

  const capiFields = [
     true, 
     !!(emailVal && emailVal.includes('@')),
     !!(nombreVal && !nombreVal.toLowerCase().includes('nuevo')),
     !!(ciudadVal && ciudadVal.length > 2)
  ];
  const healthScore = capiFields.filter(Boolean).length;
  const healthPercent = Math.round((healthScore / 4) * 100);

  const safeReminders = Array.isArray(currentAnalysis?.reminders) ? currentAnalysis.reminders : [];
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
        if (local) { try { const parsed = JSON.parse(local); if (Array.isArray(parsed)) setLocalTags(parsed); } catch(e) {} }
        if (global) { try { const parsed = JSON.parse(global); if (Array.isArray(parsed)) setGlobalTags(parsed); } catch(e) {} }
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

  const handleUpdatePaymentStatus = async (status: string) => {
     try {
         const updates: any = { payment_status: status };
         if (status === 'VALID') {
             updates.buying_intent = 'COMPRADO';
             updates.followup_stage = 100;
         }
         await supabase.from('leads').update(updates).eq('id', currentAnalysis.id);
         toast.success("Auditoría actualizada.");
         if (onAnalysisComplete) onAnalysisComplete();
     } catch (err: any) {
         toast.error("Error al actualizar pago.");
     }
  };

  const handleAddTag = async (tagText: string) => {
      const currentTags = Array.isArray(memoryForm.tags) ? memoryForm.tags : [];
      if (currentTags.some((ct: any) => extractTagText(ct) === tagText)) return;
      const newTags = [...currentTags, tagText];
      setMemoryForm({...memoryForm, tags: newTags});
      await supabase.from('leads').update({ tags: newTags }).eq('id', currentAnalysis.id);
  };

  const handleRemoveTag = async (rawTag: any) => {
      const currentTags = Array.isArray(memoryForm.tags) ? memoryForm.tags : [];
      const newTags = currentTags.filter((t: any) => extractTagText(t) !== extractTagText(rawTag));
      setMemoryForm({...memoryForm, tags: newTags});
      await supabase.from('leads').update({ tags: newTags }).eq('id', currentAnalysis.id);
  };

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
              <Button onClick={() => setIsFullEditOpen(true)} variant="outline" className="flex-1 h-9 bg-[#121214] border-[#222225] hover:bg-[#161618] text-slate-300 text-[10px] font-bold uppercase tracking-widest"><FileEdit className="w-3.5 h-3.5 mr-1.5" /> Editar</Button>
              {isManager && <Button onClick={() => setIsCreditOpen(true)} className="flex-1 h-9 bg-amber-600 hover:bg-amber-500 text-slate-950 text-[10px] font-bold uppercase tracking-widest shadow-lg"><Wallet className="w-3.5 h-3.5 mr-1.5" /> Venta / Pagos</Button>}
           </div>
        )}

        <div className="p-5 border-b border-[#1a1a1a] space-y-4">
           <h4 className="text-[10px] font-bold text-[#7A8A9E] uppercase tracking-widest flex items-center gap-2"><span className="w-3 h-3 border border-indigo-400 rounded-sm flex items-center justify-center text-[6px] text-indigo-400">💳</span> Auditoría de Pago</h4>
           <div className="bg-[#121214] border border-[#222225] rounded-xl p-4 space-y-4">
              <div className="flex justify-between items-center">
                 <span className="text-[10px] text-[#7A8A9E]">Dictamen IA:</span>
                 <Badge variant="outline" className="text-[9px] border-[#222225] bg-[#0a0a0c] text-[#7A8A9E] h-5 px-2">{currentAnalysis?.payment_status === 'VALID' ? 'APROBADO' : 'SIN COMPROBANTE'}</Badge>
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
                          
                          {/* DATO AÑADIDO: EMAIL Y CIUDAD EN LECTURA */}
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

                 <div className="pt-2 border-t border-[#1a1a1a]">
                    <button onClick={() => setTagsOpen(!tagsOpen)} className="w-full flex justify-between items-center py-2 text-[10px] font-bold text-white uppercase tracking-widest hover:text-indigo-400 transition-colors"><span className="flex items-center gap-2"><Tag className="w-3.5 h-3.5 text-[#7A8A9E]" /> Etiquetas Asignadas</span><ChevronDown className={cn("w-3.5 h-3.5 transition-transform", tagsOpen ? "rotate-180" : "")} /></button>
                    {tagsOpen && (
                       <div className="flex flex-wrap gap-2 items-center pt-3 pb-2">
                          {Array.isArray(memoryForm.tags) && memoryForm.tags.map((rawTag: any) => {
                             const t = extractTagText(rawTag);
                             if (!t) return null;
                             const tagConf = allAvailableTags.find(lt => lt.text === t);
                             return (
                                <Badge key={t} style={{ backgroundColor: (tagConf?.color || '#161618') + '15', color: tagConf?.color || '#94a3b8', borderColor: (tagConf?.color || '#222225') + '40' }} className="text-[9px] h-6 border pr-1 pl-2 font-bold flex items-center gap-1.5 shadow-sm">
                                   {t}
                                   <button onClick={() => handleRemoveTag(rawTag)} className="ml-0.5 hover:bg-black/20 rounded-full p-0.5 transition-colors"><X className="w-3 h-3"/></button>
                                </Badge>
                             );
                          })}
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
      {isFullEditOpen && contactData && <EditContactDialog open={isFullEditOpen} onOpenChange={setIsFullEditOpen} contact={contactData} existingGroups={groups} allTags={allAvailableTags} onSuccess={() => { fetchContactData(); if (onAnalysisComplete) onAnalysisComplete(); }} />}
    </div>
  );
};