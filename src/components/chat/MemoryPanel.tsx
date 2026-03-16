import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Edit2, Save, Loader2, Zap, Fingerprint, MapPin, User, Tag, X, Plus, ShieldAlert, Brain, Target
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useAuth } from '@/context/AuthContext';

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
  onDeleteLead?: () => void;
}

export const MemoryPanel = ({
  currentAnalysis, isEditing, setIsEditing,
  memoryForm, setMemoryForm, onSave, saving,
  onToggleFollowup, onAnalysisComplete
}: MemoryPanelProps) => {

  const { user } = useAuth();
  const [correctionText, setCorrectionText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [tagInput, setTagInput] = useState('');

  const capiFields = [
     true, 
     !!(currentAnalysis.email && currentAnalysis.email.includes('@')),
     !!(currentAnalysis.nombre && !currentAnalysis.nombre.toLowerCase().includes('nuevo')),
     !!(currentAnalysis.ciudad && currentAnalysis.ciudad.length > 2)
  ];
  
  const healthScore = capiFields.filter(Boolean).length;
  const healthPercent = Math.round((healthScore / 4) * 100);

  useEffect(() => { fetchAgents(); }, []);

  const fetchAgents = async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, role');
      if (data) setAgents(data);
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

  const handleAddTag = (text: string) => {
    const clean = text.trim().toUpperCase();
    if (clean && !memoryForm.tags.includes(clean)) {
      setMemoryForm({ ...memoryForm, tags: [...memoryForm.tags, clean] });
    }
    setTagInput('');
  };

  const handleUpdatePaymentStatus = async (status: string) => {
     const tid = toast.loading("Actualizando auditoría...");
     try {
         // Si es válido, lo marcamos como comprado también
         const updates: any = { payment_status: status };
         if (status === 'VALID') updates.buying_intent = 'COMPRADO';
         
         const { error } = await supabase.from('leads').update(updates).eq('id', currentAnalysis.id);
         if (error) throw error;
         
         toast.success("Auditoría actualizada.", { id: tid });
         if (onAnalysisComplete) onAnalysisComplete(); // Refrescar chat/lead
     } catch (err: any) {
         toast.error(err.message, { id: tid });
     }
  };

  const currentAgentName = agents.find(a => a.id === currentAnalysis.assigned_to)?.full_name || 'Bot Global (Sin Asignar)';

  return (
    <div className="w-full flex-shrink-0 bg-slate-900/90 flex flex-col h-full">
      <CapiStatus healthScore={healthScore} healthPercent={healthPercent} onRunAnalysis={handleRunAnalysis} analyzing={analyzing} />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        
        {/* SECCIÓN PSICOGRÁFICA (EXTRACTO IA) */}
        <div className="space-y-3 bg-indigo-900/10 border border-indigo-500/20 p-4 rounded-2xl shadow-inner relative overflow-hidden">
           <div className="absolute top-0 right-0 p-2 opacity-10"><Brain className="w-12 h-12 text-indigo-400" /></div>
           <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
              <Brain className="w-3.5 h-3.5" /> Perfil Psicográfico (IA)
           </h4>
           <p className="text-xs text-slate-300 leading-relaxed italic">
              {currentAnalysis.perfil_psicologico || "Sam está perfilando al cliente... Sigue charlando para obtener más insights."}
           </p>
        </div>

        <div className="space-y-2">
           <div className="flex justify-between items-center mb-1">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Fingerprint className="w-3.5 h-3.5" /> Ficha Técnica & CRM</h4>
              {!isEditing && <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-white" onClick={() => setIsEditing(true)}><Edit2 className="w-3.5 h-3.5" /></Button>}
           </div>

           {isEditing ? (
              <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-indigo-500/50 shadow-inner">
                 <div className="space-y-1">
                    <Label className="text-[9px] text-slate-500 uppercase tracking-widest">Asignación Directa</Label>
                    <Select value={memoryForm.assigned_to || "unassigned"} onValueChange={v => setMemoryForm({...memoryForm, assigned_to: v === "unassigned" ? null : v})}>
                       <SelectTrigger className="h-8 text-xs bg-slate-900 border-slate-800"><SelectValue /></SelectTrigger>
                       <SelectContent className="bg-slate-900 border-slate-800 text-white">
                          <SelectItem value="unassigned">Sin Asignar (IA Global)</SelectItem>
                          {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>

                 <div className="grid grid-cols-2 gap-2">
                    <Input value={memoryForm.nombre} onChange={e => setMemoryForm({...memoryForm, nombre: e.target.value})} placeholder="Nombre" className="h-8 text-xs bg-slate-900 border-slate-800" />
                    <Input value={memoryForm.ciudad} onChange={e => setMemoryForm({...memoryForm, ciudad: e.target.value})} placeholder="Ciudad" className="h-8 text-xs bg-slate-900 border-slate-800" />
                 </div>
                 
                 <Input value={memoryForm.email} onChange={e => setMemoryForm({...memoryForm, email: e.target.value})} placeholder="Email" className="h-8 text-xs bg-slate-900 border-slate-800" />

                 <Button onClick={onSave} disabled={saving} className="w-full bg-amber-600 hover:bg-amber-500 text-slate-900 h-9 text-xs font-bold rounded-lg shadow-glow">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-2" /> ACTUALIZAR CRM</>}
                 </Button>
              </div>
           ) : (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-5">
                 <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                       <span className="text-[9px] text-slate-500 uppercase">Agente Responsable</span>
                       <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 mt-0.5">
                          <User className="w-3 h-3"/> {currentAgentName}
                       </span>
                    </div>
                    <Badge variant="outline" className="text-[9px] border-indigo-500/30 text-indigo-400 bg-indigo-900/10">
                       {currentAnalysis.buying_intent || 'BAJO'}
                    </Badge>
                 </div>
                 
                 <div className="pt-3 border-t border-slate-800/50">
                    <div className="flex flex-col gap-1 mb-4">
                       <span className="text-[9px] text-slate-500 uppercase flex items-center gap-1"><MapPin className="w-2.5 h-2.5"/> Ubicación</span>
                       <span className="text-xs text-slate-300">{currentAnalysis.ciudad || 'Desconocida'}</span>
                    </div>
                    
                    {/* Componente de Auditoría Financiera Restaurado */}
                    <FinancialAudit 
                       status={currentAnalysis.payment_status} 
                       onUpdate={handleUpdatePaymentStatus} 
                       loading={saving} 
                    />
                 </div>
              </div>
           )}
        </div>

        <div className="space-y-3 border-t border-slate-800 pt-6">
           <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2"><ShieldAlert className="w-3 h-3" /> Reportar a Bitácora #CIA</h4>
           <Textarea value={correctionText} onChange={e => setCorrectionText(e.target.value)} placeholder="¿Qué debe corregir Sam? (Tono, datos, repetición...)" className="bg-slate-950 border-slate-800 text-xs min-h-[60px] rounded-xl" />
           <Button onClick={() => { toast.success("Enviado a Auditoría"); setCorrectionText(''); }} disabled={!correctionText.trim()} className="w-full h-8 text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/30 font-bold uppercase rounded-lg">
             NOTIFICAR MEJORA
           </Button>
        </div>
      </div>
    </div>
  );
};