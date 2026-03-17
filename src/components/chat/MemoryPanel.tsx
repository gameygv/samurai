import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Edit2, Save, Loader2, Fingerprint, MapPin, User, ShieldAlert, Smartphone, Trash2, Tag, Plus, X, Zap, CalendarClock 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

// Componentes Modulares
import { FinancialAudit } from './memory/FinancialAudit';
import { CapiStatus } from './memory/CapiStatus';
import { ReminderItem } from './memory/ReminderItem';

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

  useEffect(() => { 
    fetchAgents(); 
    fetchChannels();
    if (user) fetchLocalTags();
  }, [user]);

  const fetchAgents = async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, role');
      if (data) setAgents(data);
  };

  const fetchChannels = async () => {
      const { data } = await supabase.from('whatsapp_channels').select('id, name, provider').eq('is_active', true);
      if (data) setChannels(data);
  };

  const fetchLocalTags = async () => {
     if(!user) return;
     const { data } = await supabase.from('app_config').select('value').eq('key', `agent_tags_${user.id}`).maybeSingle();
     if (data?.value) {
        try { setLocalTags(JSON.parse(data.value)); } catch(e) {}
     }
  };

  const handleUpdateReminder = (id: string, field: string, val: any) => {
     const newRems = memoryForm.reminders.map((r: any) => r.id === id ? { ...r, [field]: val } : r);
     setMemoryForm({ ...memoryForm, reminders: newRems });
  };

  const handleAddReminder = () => {
     const newRem = { id: Date.now().toString(), title: '', datetime: '', notify_minutes: 30 };
     setMemoryForm({ ...memoryForm, reminders: [...(memoryForm.reminders || []), newRem] });
  };

  const handleRemoveReminder = (id: string) => {
     setMemoryForm({ ...memoryForm, reminders: memoryForm.reminders.filter((r: any) => r.id !== id) });
  };

  const handleReportCia = async () => {
      if (!correctionText.trim()) return;
      setReporting(true);
      try {
          const { data: lastMsgs } = await supabase.from('conversaciones').select('mensaje, emisor').eq('lead_id', currentAnalysis.id).order('created_at', { ascending: false }).limit(2);
          await supabase.from('errores_ia').insert({
              usuario_id: user?.id,
              cliente_id: currentAnalysis.id,
              mensaje_cliente: lastMsgs?.find(m => m.emisor === 'CLIENTE')?.mensaje || 'Contexto activo',
              respuesta_ia: lastMsgs?.find(m => m.emisor !== 'CLIENTE')?.mensaje || 'N/A',
              correccion_sugerida: correctionText,
              categoria: 'CONDUCTA',
              created_by: profile?.full_name || 'Agente'
          });
          toast.success("Enviado a Bitácora #CIA.");
          setCorrectionText('');
      } catch (err: any) { toast.error("Error al reportar."); } finally { setReporting(false); }
  };

  const capiFields = [true, !!(currentAnalysis.email && currentAnalysis.email.includes('@')), !!(currentAnalysis.nombre && !currentAnalysis.nombre.toLowerCase().includes('nuevo')), !!(currentAnalysis.ciudad && currentAnalysis.ciudad.length > 2)];
  const healthScore = capiFields.filter(Boolean).length;
  const healthPercent = Math.round((healthScore / 4) * 100);

  return (
    <div className="w-full flex-shrink-0 bg-[#0d0a08] flex flex-col h-full">
      <CapiStatus healthScore={healthScore} healthPercent={healthPercent} onRunAnalysis={() => supabase.functions.invoke('analyze-leads', { body: { lead_id: currentAnalysis.id, force: true } }).then(onAnalysisComplete)} analyzing={analyzing} />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-8">
        <FinancialAudit status={currentAnalysis.payment_status} onUpdate={(s) => supabase.from('leads').update({ payment_status: s, buying_intent: s === 'VALID' ? 'COMPRADO' : currentAnalysis.buying_intent }).eq('id', currentAnalysis.id).then(onAnalysisComplete)} loading={saving} />

        {/* CRM SECTION */}
        <div>
           <div className="flex justify-between items-center mb-2">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Fingerprint className="w-4 h-4" /> Identidad & CRM</h4>
              <div className="flex gap-1">
                {isManager && <Button variant="ghost" size="icon" className="h-6 w-6 text-red-900/50 hover:text-red-500" onClick={onDeleteLead}><Trash2 className="w-3.5 h-3.5" /></Button>}
                {!isEditing && <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-white" onClick={() => setIsEditing(true)}><Edit2 className="w-3.5 h-3.5" /></Button>}
              </div>
           </div>

           {isEditing ? (
              <div className="space-y-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                 <div className="grid grid-cols-2 gap-2">
                    <Input value={memoryForm.nombre} onChange={e => setMemoryForm({...memoryForm, nombre: e.target.value})} placeholder="Nombre" className="h-8 text-xs bg-slate-950 border-slate-800" />
                    <Input value={memoryForm.ciudad} onChange={e => setMemoryForm({...memoryForm, ciudad: e.target.value})} placeholder="Ciudad" className="h-8 text-xs bg-slate-950 border-slate-800" />
                 </div>
                 <Input value={memoryForm.email} onChange={e => setMemoryForm({...memoryForm, email: e.target.value})} placeholder="Email" className="h-8 text-xs bg-slate-950 border-slate-800" />
                 <Button onClick={onSave} disabled={saving} className="w-full bg-indigo-600 text-white h-9 text-xs font-bold rounded-lg">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "ACTUALIZAR CRM"}</Button>
              </div>
           ) : (
              <Accordion type="single" collapsible defaultValue="reminders" className="w-full space-y-4">
                 <AccordionItem value="tactico" className="border-0 bg-slate-900/20 border border-slate-800/50 rounded-xl px-3">
                    <AccordionTrigger className="text-[10px] font-bold text-slate-400 uppercase py-3 hover:no-underline">Resumen Táctico</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-1 pb-4">
                       <div className="grid grid-cols-2 gap-4">
                          <div><span className="text-[9px] text-slate-500 uppercase font-bold">Email</span><p className="text-xs font-bold mt-0.5 truncate text-emerald-400">{currentAnalysis.email || 'Pendiente'}</p></div>
                          <div><span className="text-[9px] text-slate-500 uppercase font-bold">Ubicación</span><p className="text-xs font-bold mt-0.5 truncate text-indigo-300">{currentAnalysis.ciudad || 'No id'}</p></div>
                       </div>
                       <div><span className="text-[9px] text-slate-500 uppercase font-bold">Perfil</span><p className="text-xs text-slate-400 italic">{currentAnalysis.perfil_psicologico || 'Analizando...'}</p></div>
                    </AccordionContent>
                 </AccordionItem>

                 <AccordionItem value="reminders" className="border-0 bg-slate-900/20 border border-slate-800/50 rounded-xl px-3">
                    <AccordionTrigger className="text-[10px] font-bold text-indigo-400 uppercase py-3 hover:no-underline flex gap-2">
                       <CalendarClock className="w-3.5 h-3.5" /> Próximos Pasos ({memoryForm.reminders?.length || 0})
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-1 pb-4">
                       <div className="space-y-2">
                          {(memoryForm.reminders || []).map((rem: any) => (
                             <ReminderItem key={rem.id} reminder={rem} onUpdate={handleUpdateReminder} onRemove={handleRemoveReminder} />
                          ))}
                       </div>
                       <Button variant="outline" onClick={handleAddReminder} className="w-full h-8 text-[10px] border-dashed border-slate-700 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50">
                          <Plus className="w-3 h-3 mr-2" /> AÑADIR RECORDATORIO
                       </Button>
                       {(memoryForm.reminders?.length > 0) && (
                          <Button onClick={onSave} disabled={saving} className="w-full h-8 bg-indigo-900/50 text-indigo-300 text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-900">
                             {saving ? <Loader2 className="w-3 h-3 animate-spin mr-2"/> : <Save className="w-3 h-3 mr-2"/>} Sincronizar Agenda
                          </Button>
                       )}
                    </AccordionContent>
                 </AccordionItem>
              </Accordion>
           )}
        </div>

        {/* CIA REPORT */}
        <div className="space-y-3">
           <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2"><ShieldAlert className="w-3.5 h-3.5" /> Reportar a Bitácora #CIA</h4>
           <Textarea value={correctionText} onChange={e => setCorrectionText(e.target.value)} placeholder="Ej: Sam fue muy agresivo..." className="bg-slate-950 border-slate-800 text-xs min-h-[80px] rounded-xl" />
           <Button onClick={handleReportCia} disabled={!correctionText.trim() || reporting} className="w-full h-10 text-[10px] bg-[#1a120b] text-amber-500 border border-[#3b2513] hover:bg-[#291b0f] font-bold uppercase tracking-widest rounded-xl">
             {reporting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Zap className="w-3 h-3 mr-2" />} NOTIFICAR MEJORA
           </Button>
        </div>
      </div>

      <div className="p-5 border-t border-slate-800 bg-[#0d0a08]">
         <Button onClick={onToggleFollowup} className={cn("w-full h-12 text-[10px] font-bold tracking-widest uppercase rounded-xl border transition-all duration-300", currentAnalysis.ai_paused ? "bg-emerald-900/20 text-emerald-500 border-emerald-900/50" : "bg-red-950 text-red-500 border-red-900")}>
            {currentAnalysis.ai_paused ? "▶ ACTIVAR IA (ESTE CHAT)" : "⏸ PAUSAR IA (ESTE CHAT)"}
         </Button>
      </div>
    </div>
  );
};