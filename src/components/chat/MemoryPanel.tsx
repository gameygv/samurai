import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { EditContactDialog } from '@/components/contacts/EditContactDialog';
import { CiaReportDialog } from '@/components/chat/CiaReportDialog';
import { extractTagText } from '@/lib/tag-parser';

import { EmqHeader } from './memory/EmqHeader';
import { QuickActions } from './memory/QuickActions';
import { FunnelStage } from './memory/FunnelStage';
import { RetargetingRadar } from './memory/RetargetingRadar';
import { PaymentAudit } from './memory/PaymentAudit';
import { IdentityCrm } from './memory/IdentityCrm';
import { RemindersBlock } from './memory/RemindersBlock';
import { StudentProfile } from './memory/StudentProfile';
import { AcademicRecord } from './memory/AcademicRecord';
import { CreditHistory } from './memory/CreditHistory';
import { InternalNotes } from './memory/InternalNotes';
import { TagsManager } from './memory/TagsManager';

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
  messages?: any[];
}

export const MemoryPanel = ({
  currentAnalysis, isEditing, setIsEditing,
  memoryForm, setMemoryForm, onSave, saving,
  onToggleFollowup, onAnalysisComplete, onDeleteLead,
  messages = []
}: MemoryPanelProps) => {

  const { user, isManager, profile } = useAuth();
  const [analyzing, setAnalyzing] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  
  const [localTags, setLocalTags] = useState<{id: string, text: string, color: string}[]>([]);
  const [globalTags, setGlobalTags] = useState<{id: string, text: string, color: string}[]>([]);
  
  const [contactData, setContactData] = useState<any>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [isFullEditOpen, setIsFullEditOpen] = useState(false);
  const [isCiaDialogOpen, setIsCiaDialogOpen] = useState(false);

  const [internalNotes, setInternalNotes] = useState<any[]>([]);
  const [sendingNote, setSendingNote] = useState(false);
  const [savingReminders, setSavingReminders] = useState(false);

  const emailVal = String(currentAnalysis?.email || '');
  const nombreVal = String(currentAnalysis?.nombre || '');
  const ciudadVal = String(currentAnalysis?.ciudad || '');
  const estadoVal = String(currentAnalysis?.estado || '');
  const cpVal = String(currentAnalysis?.cp || '');
  const summaryVal = String(currentAnalysis?.summary || 'Generando resumen...');
  const perfilVal = String(currentAnalysis?.perfil_psicologico || 'Analizando conversaciones para perfilar...');

  const capiFields = [ true, !!(emailVal && emailVal.includes('@')), !!(nombreVal && !nombreVal.toLowerCase().includes('nuevo')), !!(ciudadVal && ciudadVal.length > 2), !!cpVal ];
  const healthScore = capiFields.filter(Boolean).length;
  const healthPercent = Math.round((healthScore / 5) * 100);

  const safeAgents = Array.isArray(agents) ? agents : [];
  const safeChannels = Array.isArray(channels) ? channels : [];
  const currentAgentName = String(safeAgents.find(a => a.id === currentAnalysis?.assigned_to)?.full_name || 'Bot Global');
  const currentChannelName = String(safeChannels.find(c => c.id === currentAnalysis?.channel_id)?.name || 'WhatsApp API');
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
        .eq('platform', 'PANEL_INTERNO')
        .order('created_at', { ascending: true });
     if (data) setInternalNotes(data);
  };

  const handleAddInternalNote = async (text: string) => {
     if (!text.trim()) return;
     setSendingNote(true);
     try {
        const payload = {
           lead_id: currentAnalysis.id,
           emisor: 'HUMANO',
           platform: 'PANEL_INTERNO',
           mensaje: text.trim(),
           metadata: { author: profile?.full_name || 'Miembro del Equipo' }
        };
        const { data, error } = await supabase.from('conversaciones').insert(payload).select().single();
        if (error) throw error;
        setInternalNotes(prev => [...prev, data]);
     } catch (err: any) {
        toast.error("Error al guardar nota: " + err.message);
     } finally {
        setSendingNote(false);
     }
  };

  const handleDeleteInternalNote = async (id: string) => {
     if (!confirm("¿Seguro que quieres borrar esta nota?")) return;
     try {
        const { error } = await supabase.from('conversaciones').delete().eq('id', id);
        if (error) throw error;
        setInternalNotes(prev => prev.filter(n => n.id !== id));
        toast.success("Nota eliminada.");
     } catch (err: any) {
        toast.error("Fallo al eliminar: " + err.message);
     }
  };

  const fetchGroups = async () => {
     const { data } = await supabase.from('contacts').select('grupo').not('grupo', 'is', null).limit(500);
     if (data) setGroups(Array.from(new Set(data.map(d => d.grupo).filter(Boolean))) as string[]);
  };

  const fetchContactData = async () => {
     const { data } = await supabase.from('contacts').select('*').eq('lead_id', currentAnalysis.id).maybeSingle();
     if (data) setContactData(data);
  };

  const fetchAgents = async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, role').eq('is_active', true);
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

  const handleAgentChange = async (agentId: string) => {
      const newAgent = agentId === 'unassigned' ? null : agentId;
      try {
          await supabase.from('leads').update({ assigned_to: newAgent }).eq('id', currentAnalysis.id);
          setMemoryForm({ ...memoryForm, assigned_to: newAgent });
          if (onAnalysisComplete) onAnalysisComplete();
          toast.success("Agente reasignado exitosamente.");
      } catch (err: any) {
          toast.error("Error al reasignar agente.");
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
         toast.success(status === 'VALID' ? "Comprobante aprobado." : "Comprobante denegado.");
         if (onAnalysisComplete) onAnalysisComplete();
     } catch (err: any) { 
         toast.error("Error al actualizar estado del pago."); 
     }
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
          setMemoryForm(prev => ({ ...prev, buying_intent: newIntent })); // UPDATE LOCAL STATE
          toast.success(`Movido a: ${newIntent}`);
          if (onAnalysisComplete) onAnalysisComplete();
      } catch (err: any) {
          toast.error("Error al actualizar etapa");
      }
  };

  const handleAddReminder = () => {
      const newReminder = {
          id: `rem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          title: '',
          datetime: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
          notify_minutes: 15,
          notify_wa: true,
          target: 'agent'
      };
      const currentRems = Array.isArray(memoryForm.reminders) ? memoryForm.reminders : [];
      setMemoryForm({ ...memoryForm, reminders: [...currentRems, newReminder] });
  };

  const handleUpdateReminder = (id: string, field: string, val: any) => {
      const currentRems = Array.isArray(memoryForm.reminders) ? memoryForm.reminders : [];
      const updated = currentRems.map((r: any) => r.id === id ? { ...r, [field]: val } : r);
      setMemoryForm({ ...memoryForm, reminders: updated });
  };

  const handleRemoveReminder = async (id: string) => {
      const currentRems = Array.isArray(memoryForm.reminders) ? memoryForm.reminders : [];
      const updated = currentRems.filter((r: any) => r.id !== id);
      setMemoryForm({ ...memoryForm, reminders: updated });
      try { await supabase.from('leads').update({ reminders: updated }).eq('id', currentAnalysis.id); } catch(e){}
  };

  const handleSaveReminders = async () => {
      setSavingReminders(true);
      try {
         const currentRems = Array.isArray(memoryForm.reminders) ? memoryForm.reminders : [];
         await supabase.from('leads').update({ reminders: currentRems }).eq('id', currentAnalysis.id);
         toast.success("Tareas programadas correctamente.");
      } catch(e) {
         toast.error("Error al guardar tareas.");
      } finally {
         setSavingReminders(false);
      }
  };

  const minutesSinceLastMsg = currentAnalysis?.last_message_at 
      ? Math.floor((new Date().getTime() - new Date(currentAnalysis.last_message_at).getTime()) / 60000) 
      : 0;

  const validGlobalTags = globalTags.filter(t => t.text && String(t.text).trim() !== '');
  const validLocalTags = localTags.filter(t => t.text && String(t.text).trim() !== '');

  let academicArray = [];
  try {
      academicArray = contactData?.academic_record 
        ? (Array.isArray(contactData.academic_record) ? contactData.academic_record : JSON.parse(contactData.academic_record)) 
        : [];
  } catch(e) { academicArray = []; }

  return (
    <div className="w-full flex-shrink-0 bg-[#0a0a0c] flex flex-col h-full text-slate-300">
      
      <EmqHeader 
         healthPercent={healthPercent} 
         healthScore={healthScore} 
         capiSent={currentAnalysis?.capi_lead_event_sent_at} 
         analyzing={analyzing} 
         onRunAnalysis={handleRunAnalysis} 
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
         
         <QuickActions 
            contactData={contactData} 
            isManager={isManager} 
            onEdit={() => setIsFullEditOpen(true)} 
            onCia={() => setIsCiaDialogOpen(true)} 
         />

         <FunnelStage 
            buyingIntent={currentAnalysis?.buying_intent} 
            onIntentChange={handleIntentChange} 
         />

         <RetargetingRadar 
            aiPaused={currentAnalysis?.ai_paused} 
            buyingIntent={currentAnalysis?.buying_intent} 
            minutesSinceLastMsg={minutesSinceLastMsg} 
            followupStage={currentAnalysis?.followup_stage} 
         />

         <PaymentAudit
            paymentStatus={currentAnalysis?.payment_status}
            onUpdateStatus={handleUpdatePaymentStatus}
            leadId={currentAnalysis?.id}
         />

         <IdentityCrm 
            isEditing={isEditing} 
            setIsEditing={setIsEditing} 
            memoryForm={memoryForm} 
            setMemoryForm={setMemoryForm} 
            onSave={onSave} 
            saving={saving} 
            agentName={currentAgentName} 
            channelName={currentChannelName} 
            email={emailVal} 
            ciudad={ciudadVal} 
            estado={estadoVal} 
            cp={cpVal} 
            summary={summaryVal} 
            perfil={perfilVal} 
            onRunAnalysis={handleRunAnalysis}
            analyzing={analyzing}
            agents={safeAgents}
            isManager={isManager}
            onAgentChange={handleAgentChange}
         />

         <RemindersBlock 
            memoryForm={memoryForm} 
            savingReminders={savingReminders} 
            onAddReminder={handleAddReminder} 
            onUpdateReminder={handleUpdateReminder} 
            onRemoveReminder={handleRemoveReminder} 
            onSaveReminders={handleSaveReminders} 
         />

         <StudentProfile
            dieta={contactData?.dieta}
            alimentacion={contactData?.alimentacion}
            alergias={contactData?.alergias}
            motivoCurso={contactData?.motivo_curso}
         />

         <AcademicRecord academicArray={academicArray} />

         <CreditHistory contactId={contactData?.id || null} />

         <InternalNotes 
            internalNotes={internalNotes} 
            onAddNote={handleAddInternalNote} 
            onDeleteNote={handleDeleteInternalNote}
            sendingNote={sendingNote} 
         />

         <TagsManager 
            memoryForm={memoryForm} 
            allAvailableTags={allAvailableTags} 
            validGlobalTags={validGlobalTags} 
            validLocalTags={validLocalTags} 
            onAddTag={handleAddTag} 
            onRemoveTag={handleRemoveTag} 
         />

      </div>

      <div className="p-5 bg-[#0a0a0c] border-t border-[#1a1a1a] mt-auto">
         <Button onClick={onToggleFollowup} className={cn("w-full h-12 text-[10px] font-bold tracking-widest uppercase rounded-xl border transition-all duration-300 shadow-none", currentAnalysis?.ai_paused ? "bg-emerald-950/30 text-emerald-500 border-emerald-900/50" : "bg-[#3d0f0f] text-red-400 border-[#5e1616]")}>
            {currentAnalysis?.ai_paused ? "▶ ACTIVAR IA" : "⏸ PAUSAR IA"}
         </Button>
      </div>

      {isCiaDialogOpen && <CiaReportDialog open={isCiaDialogOpen} onOpenChange={setIsCiaDialogOpen} lead={currentAnalysis} messages={messages} />}
      {isFullEditOpen && contactData && <EditContactDialog open={isFullEditOpen} onOpenChange={setIsFullEditOpen} contact={contactData} existingGroups={groups} allTags={allAvailableTags} globalTags={globalTags} onSuccess={() => { fetchContactData(); if (onAnalysisComplete) onAnalysisComplete(); }} />}
    </div>
  );
};