import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Edit2, Save, Loader2, Fingerprint, MapPin, User, ShieldAlert, Brain, Smartphone, Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

// Import Componentes Modulares
import { FinancialAudit } from './memory/FinancialAudit';
import { CapiStatus } from './memory/CapiStatus';

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
  onDeleteLead?: () => void; // Prop añadida para corregir TS2322
}

export const MemoryPanel = ({
  currentAnalysis, isEditing, setIsEditing,
  memoryForm, setMemoryForm, onSave, saving,
  onToggleFollowup, onAnalysisComplete, onDeleteLead
}: MemoryPanelProps) => {

  const { user, isAdmin } = useAuth();
  const [correctionText, setCorrectionText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);

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
  }, []);

  const fetchAgents = async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, role');
      if (data) setAgents(data);
  };

  const fetchChannels = async () => {
      const { data } = await supabase.from('whatsapp_channels').select('id, name, provider').eq('is_active', true);
      if (data) setChannels(data);
  };

  const handleRunAnalysis = async () => {
     setAnalyzing(true);
     try {
        await supabase.functions.invoke('analyze-leads', { body: { lead_id: currentAnalysis.id, force: true } });
        toast.success(`Cerebro sincronizado`);
        if (onAnalysisComplete) onAnalysisComplete();
     } catch (err: any) {
        toast.error("Error: " + err.message);
     } finally {
        setAnalyzing(false);
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

  const currentAgentName = agents.find(a => a.id === currentAnalysis.assigned_to)?.full_name || 'Bot Global';
  const currentChannelName = channels.find(c => c.id === currentAnalysis.channel_id)?.name || 'Canal Desconocido';

  return (
    <div className="w-full flex-shrink-0 bg-[#0d0a08] flex flex-col h-full">
      <CapiStatus healthScore={healthScore} healthPercent={healthPercent} onRunAnalysis={handleRunAnalysis} analyzing={analyzing} />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-8">
        
        <FinancialAudit status={currentAnalysis.payment_status} onUpdate={handleUpdatePaymentStatus} loading={saving} />

        <div>
           <div className="flex justify-between items-center mb-2">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <Fingerprint className="w-4 h-4" /> Identidad & CRM
              </h4>
              <div className="flex gap-1">
                {isAdmin && onDeleteLead && (
                   <Button variant="ghost" size="icon" className="h-6 w-6 text-red-900/50 hover:text-red-500" onClick={() => { if(confirm("¿Borrar lead?")) onDeleteLead(); }} title="Eliminar de raíz">
                      <Trash2 className="w-3.5 h-3.5" />
                   </Button>
                )}
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
                 
                 <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <Label className="text-[9px] text-slate-500 uppercase tracking-widest">Asesor:</Label>
                        <Select value={memoryForm.assigned_to || "unassigned"} onValueChange={v => setMemoryForm({...memoryForm, assigned_to: v === "unassigned" ? null : v})}>
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

                 <Button onClick={onSave} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-9 text-xs font-bold rounded-lg">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-2" /> ACTUALIZAR CRM</>}
                 </Button>
              </div>
           ) : (
              <Accordion type="single" collapsible defaultValue="tactico" className="w-full bg-slate-900/20 border border-slate-800/50 rounded-xl px-3">
                 <AccordionItem value="tactico" className="border-0">
                    <AccordionTrigger className="text-[10px] font-bold text-slate-300 uppercase py-3 hover:no-underline hover:text-indigo-400">Resumen Táctico</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-1 pb-4">
                       <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Agente</span>
                                <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-500"/> {currentAgentName}</p>
                            </div>
                            <div>
                                <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Canal</span>
                                <p className="text-xs text-indigo-400 mt-0.5 flex items-center gap-1.5 font-bold"><Smartphone className="w-3.5 h-3.5"/> {currentChannelName}</p>
                            </div>
                       </div>
                       <div>
                          <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Email</span>
                          <p className={cn("text-xs font-bold mt-0.5", currentAnalysis.email && currentAnalysis.email.includes('@') ? "text-emerald-400" : "text-emerald-400/60 italic")}>
                             {currentAnalysis.email || 'Pendiente'}
                          </p>
                       </div>
                       <div>
                          <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Perfil Psicográfico</span>
                          <p className="text-xs text-slate-400 italic mt-0.5">{currentAnalysis.perfil_psicologico || 'Analizando...'}</p>
                       </div>
                    </AccordionContent>
                 </AccordionItem>
              </Accordion>
           )}
        </div>

        <div className="space-y-3">
           <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2"><ShieldAlert className="w-3.5 h-3.5" /> Reportar a Bitácora #CIA</h4>
           <Textarea value={correctionText} onChange={e => setCorrectionText(e.target.value)} placeholder="¿Qué debe corregir Sam?" className="bg-slate-950 border-slate-800 text-xs min-h-[80px] rounded-xl" />
           <Button onClick={() => { toast.success("Enviado a Auditoría"); setCorrectionText(''); }} disabled={!correctionText.trim()} className="w-full h-10 text-[10px] bg-[#1a120b] text-amber-500 border border-[#3b2513] hover:bg-[#291b0f] font-bold uppercase tracking-widest rounded-xl transition-colors">
             NOTIFICAR MEJORA
           </Button>
        </div>
      </div>

      {/* BIG RED BUTTON AT BOTTOM */}
      <div className="p-5 border-t border-slate-800 bg-[#0d0a08]">
         <Button 
            onClick={onToggleFollowup} 
            className={cn(
               "w-full h-12 text-[10px] font-bold tracking-widest uppercase rounded-xl border transition-all duration-300", 
               currentAnalysis.ai_paused 
                  ? "bg-emerald-900/20 text-emerald-500 border-emerald-900/50 hover:bg-emerald-900/40" 
                  : "bg-red-950 text-red-500 border-red-900 hover:bg-red-900 hover:text-red-100"
            )}
         >
            {currentAnalysis.ai_paused ? "▶ ACTIVAR IA (ESTE CHAT)" : "⏸ PAUSAR IA (ESTE CHAT)"}
         </Button>
      </div>
    </div>
  );
};