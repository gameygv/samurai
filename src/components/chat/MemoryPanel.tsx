import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Edit2, Save, Loader2, Zap, Fingerprint, MapPin, User, Tag, X, Plus, ShieldAlert
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useAuth } from '@/context/AuthContext';

// Import Componentes Modulares
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
  onToggleFollowup, onAnalysisComplete
}: MemoryPanelProps) => {

  const { user, isAdmin, profile } = useAuth();
  const [correctionText, setCorrectionText] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [mergedTags, setMergedTags] = useState<any[]>([]);

  const capiFields = [
     true, 
     !!(currentAnalysis.email && currentAnalysis.email.includes('@')),
     !!(currentAnalysis.nombre && !currentAnalysis.nombre.includes('Nuevo')),
     !!(currentAnalysis.apellido && currentAnalysis.apellido.length > 1),
     !!(currentAnalysis.ciudad && currentAnalysis.ciudad.length > 2),
     !!(currentAnalysis.estado && currentAnalysis.estado.length > 1),
     !!(currentAnalysis.cp && currentAnalysis.cp.length > 3)
  ];
  
  const healthScore = capiFields.filter(Boolean).length;
  const healthPercent = Math.round((healthScore / 7) * 100);

  useEffect(() => {
     fetchAgents();
     fetchMergedTags();
  }, []);

  const fetchAgents = async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, role').in('role', ['admin', 'dev', 'sales']);
      if (data) setAgents(data);
  };

  const fetchMergedTags = async () => {
      if (!user) return;
      const { data } = await supabase.from('app_config').select('key, value').in('key', ['global_tags', `agent_tags_${user.id}`]);
      let allTags: any[] = [];
      if (data) {
          data.forEach(d => { if (d.value) try { allTags = [...allTags, ...JSON.parse(d.value)]; } catch(e){} });
      }
      setMergedTags(allTags);
  };

  const handleRunAnalysis = async () => {
     setAnalyzing(true);
     try {
        await supabase.functions.invoke('analyze-leads', { body: { lead_id: currentAnalysis.id, force: true } });
        toast.success(`Perfil sincronizado`);
        if (onAnalysisComplete) onAnalysisComplete();
     } catch (err: any) {
        toast.error("Error: " + err.message);
     } finally {
        setAnalyzing(false);
     }
  };

  const handleUpdatePaymentStatus = async (status: string) => {
    setUpdatingPayment(true);
    try {
      await supabase.from('leads').update({ payment_status: status }).eq('id', currentAnalysis.id);
      toast.success(`Estatus: ${status}`);
      if (onAnalysisComplete) onAnalysisComplete(); 
    } catch (err: any) { toast.error('Fallo: ' + err.message); } finally { setUpdatingPayment(false); }
  };

  const handleAddTag = (text: string) => {
    const clean = text.trim().toUpperCase();
    if (clean && !memoryForm.tags.includes(clean)) {
      setMemoryForm({ ...memoryForm, tags: [...memoryForm.tags, clean] });
    }
    setTagInput('');
  };

  const currentAgentName = agents.find(a => a.id === currentAnalysis.assigned_to)?.full_name || 'Bot Global';

  return (
    <div className="w-full flex-shrink-0 bg-slate-900/90 flex flex-col h-full">
      <CapiStatus healthScore={healthScore} healthPercent={healthPercent} onRunAnalysis={handleRunAnalysis} analyzing={analyzing} />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        
        <FinancialAudit status={currentAnalysis.payment_status} onUpdate={handleUpdatePaymentStatus} loading={updatingPayment} />

        <div className="space-y-2">
           <div className="flex justify-between items-center mb-1">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Fingerprint className="w-3.5 h-3.5" /> Identidad & CRM</h4>
              {!isEditing && <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-white" onClick={() => setIsEditing(true)}><Edit2 className="w-3.5 h-3.5" /></Button>}
           </div>

           {isEditing ? (
              <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-indigo-500/50 shadow-inner">
                 <div className="space-y-1">
                    <Label className="text-[9px] text-slate-500 uppercase tracking-widest">Responsable</Label>
                    <Select value={memoryForm.assigned_to || "unassigned"} onValueChange={v => setMemoryForm({...memoryForm, assigned_to: v === "unassigned" ? null : v})}>
                       <SelectTrigger className="h-8 text-xs bg-slate-900 border-slate-800"><SelectValue /></SelectTrigger>
                       <SelectContent className="bg-slate-900 border-slate-800 text-white">{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                 </div>

                 <div className="grid grid-cols-2 gap-2">
                    <Input value={memoryForm.nombre} onChange={e => setMemoryForm({...memoryForm, nombre: e.target.value})} placeholder="Nombre" className="h-8 text-xs bg-slate-900 border-slate-800" />
                    <Input value={memoryForm.apellido} onChange={e => setMemoryForm({...memoryForm, apellido: e.target.value})} placeholder="Apellido" className="h-8 text-xs bg-slate-900 border-slate-800" />
                 </div>
                 
                 <Input value={memoryForm.email} onChange={e => setMemoryForm({...memoryForm, email: e.target.value})} placeholder="Email" className="h-8 text-xs bg-slate-900 border-slate-800" />

                 <div className="pt-2 border-t border-slate-800">
                    <Label className="text-[9px] text-slate-500 uppercase flex items-center gap-1 mb-2"><Tag className="w-3 h-3"/> Etiquetas</Label>
                    <div className="flex flex-wrap gap-1 mb-2">
                       {memoryForm.tags.map((t: string) => (
                          <Badge key={t} className="text-[9px] bg-indigo-600 cursor-pointer" onClick={() => setMemoryForm({...memoryForm, tags: memoryForm.tags.filter((tag: string) => tag !== t)})}>{t} <X className="w-2 h-2 ml-1"/></Badge>
                       ))}
                    </div>
                    <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTag(tagInput)} placeholder="Nueva etiqueta..." className="h-7 text-[10px] bg-slate-900 border-slate-800" />
                 </div>
                 
                 <Button onClick={onSave} disabled={saving} className="w-full bg-amber-600 hover:bg-amber-500 text-slate-900 h-9 text-xs font-bold rounded-lg shadow-glow">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-2" /> GUARDAR DATOS</>}
                 </Button>
              </div>
           ) : (
              <Accordion type="single" collapsible defaultValue="identidad" className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <AccordionItem value="identidad" className="border-0">
                  <AccordionTrigger className="px-4 py-3 text-xs font-bold hover:no-underline">Resumen Táctico</AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-3">
                     <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-slate-500 uppercase">Contacto</span>
                        <span className="text-xs text-slate-200">{currentAnalysis.nombre || 'Desconocido'}</span>
                     </div>
                     <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-slate-500 uppercase">Email</span>
                        <span className="text-xs text-emerald-400 font-mono">{currentAnalysis.email || 'Pendiente'}</span>
                     </div>
                     <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1"><User className="w-2.5 h-2.5"/> Agente</span>
                        <span className="text-xs text-slate-300">{currentAgentName}</span>
                     </div>
                     {currentAnalysis.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-800">
                           {currentAnalysis.tags.map((t: string) => <Badge key={t} variant="outline" className="text-[8px] border-indigo-500/30 text-indigo-400">{t}</Badge>)}
                        </div>
                     )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
           )}
        </div>

        <div className="space-y-3 border-t border-slate-800 pt-6">
           <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2"><ShieldAlert className="w-3 h-3" /> Reportar a Bitácora #CIA</h4>
           <Textarea value={correctionText} onChange={e => setCorrectionText(e.target.value)} placeholder="¿Qué debe corregir Sam?" className="bg-slate-950 border-slate-800 text-xs min-h-[60px] rounded-xl" />
           <Button onClick={() => toast.success("Reporte enviado")} disabled={!correctionText.trim()} className="w-full h-8 text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/30 font-bold uppercase rounded-lg">
             NOTIFICAR MEJORA
           </Button>
        </div>
      </div>
      
      <div className="p-4 bg-slate-950/50 border-t border-slate-800 shrink-0">
         <Button variant="outline" className={`w-full h-11 text-xs font-bold uppercase rounded-xl transition-all ${currentAnalysis.ai_paused ? 'border-emerald-500/50 text-emerald-500 bg-emerald-500/10' : 'border-red-500/50 text-red-500 bg-red-500/10'}`} onClick={onToggleFollowup}>
            {currentAnalysis.ai_paused ? 'ACTIVAR IA' : 'PAUSAR IA'}
         </Button>
      </div>
    </div>
  );
};