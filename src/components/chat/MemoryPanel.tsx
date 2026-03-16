import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BrainCircuit, Edit2, Save, Loader2, ShieldAlert, Zap, 
  Fingerprint, Sparkles, Heart, ShieldX, ShieldCheck, AlertTriangle, 
  CreditCard, MapPin, Navigation, TrendingUp, BarChart3, Database, History, Activity, ExternalLink, User, Tag, X, CalendarClock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useAuth } from '@/context/AuthContext';

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
}

export const MemoryPanel = ({
  currentAnalysis, isEditing, setIsEditing,
  memoryForm, setMemoryForm, onSave, saving,
  onToggleFollowup, onAnalysisComplete
}: MemoryPanelProps) => {

  const { isAdmin } = useAuth();
  const [correctionText, setCorrectionText] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [capiHistory, setCapiHistory] = useState<any[]>([]);
  const [loadingCapi, setLoadingCapi] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [tagInput, setTagInput] = useState('');

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
     if (currentAnalysis?.id) fetchCapiHistory();
     fetchAgents();
  }, [currentAnalysis?.id]);

  const fetchAgents = async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, role').in('role', ['admin', 'dev', 'sales']);
      if (data) setAgents(data);
  };

  const fetchCapiHistory = async () => {
     setLoadingCapi(true);
     const { data } = await supabase
        .from('meta_capi_events')
        .select('*')
        .eq('lead_id', currentAnalysis.id)
        .order('created_at', { ascending: false });
     if (data) setCapiHistory(data);
     setLoadingCapi(false);
  };

  const handleRunAnalysis = async () => {
     setAnalyzing(true);
     const tid = toast.loading("Analista CAPI escaneando datos...");
     try {
        const { data, error } = await supabase.functions.invoke('analyze-leads', {
           body: { lead_id: currentAnalysis.id, force: true }
        });
        if (error) throw new Error(error.message);
        toast.success(`¡Perfil enriquecido y segmentado!`, { id: tid });
        if (onAnalysisComplete) onAnalysisComplete();
     } catch (err: any) {
        toast.error("Error: " + err.message, { id: tid });
     } finally {
        setAnalyzing(false);
     }
  };

  const handleSaveCorrection = async () => {
    if (!correctionText.trim()) return;
    setIsReporting(true);
    try {
      await supabase.from('errores_ia').insert({
        cliente_id: currentAnalysis.id,
        mensaje_cliente: 'Corrección manual',
        respuesta_ia: 'N/A',
        correccion_sugerida: correctionText,
        categoria: 'CONDUCTA'
      });
      toast.success('Lección guardada en Bitácora');
      setCorrectionText('');
    } finally {
      setIsReporting(false);
    }
  };

  const handleUpdatePaymentStatus = async (status: string) => {
    setUpdatingPayment(true);
    try {
      await supabase.from('leads').update({ payment_status: status }).eq('id', currentAnalysis.id);
      toast.success(`Estatus de pago actualizado a ${status}`);
      if (onAnalysisComplete) onAnalysisComplete(); 
    } catch (err: any) {
      toast.error('Fallo al actualizar el pago: ' + err.message);
    } finally {
      setUpdatingPayment(false);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toUpperCase();
      if (!memoryForm.tags.includes(newTag)) {
        setMemoryForm({ ...memoryForm, tags: [...memoryForm.tags, newTag] });
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setMemoryForm({ ...memoryForm, tags: memoryForm.tags.filter((t: string) => t !== tagToRemove) });
  };

  const currentAgentName = agents.find(a => a.id === currentAnalysis.assigned_to)?.full_name || 'Bot Global (Sin Asignar)';
  
  // Format datetime for input
  const formatDateTimeForInput = (dateString: string | null) => {
     if (!dateString) return '';
     const date = new Date(dateString);
     return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  return (
    <div className="w-full flex-shrink-0 bg-slate-900/90 flex flex-col h-full">
      <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex justify-between items-center shrink-0">
         <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Event Match Quality</span>
            <div className="flex items-center gap-2 mt-1">
               <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={cn("h-full transition-all duration-1000", healthPercent > 70 ? 'bg-emerald-500' : healthPercent > 40 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${healthPercent}%` }} />
               </div>
               <span className="text-[10px] font-mono font-bold text-amber-500">{healthScore}/7</span>
            </div>
         </div>
         <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-amber-500 bg-slate-900 border border-slate-800 shadow-sm rounded-lg" onClick={handleRunAnalysis} disabled={analyzing} title="Forzar Análisis IA">
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
         </Button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">

        {/* FINANCIAL AUDIT */}
        <div className="space-y-3">
           <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5 text-indigo-400" /> Auditoría de Pago
           </h4>
           <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-inner space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Dictamen IA:</span>
                {currentAnalysis.payment_status === 'VALID' && <Badge className="bg-emerald-900/30 text-emerald-400 border-emerald-500/30 text-[9px]"><ShieldCheck className="w-3 h-3 mr-1"/> APROBADO</Badge>}
                {currentAnalysis.payment_status === 'INVALID' && <Badge className="bg-red-900/30 text-red-400 border-red-500/30 text-[9px]"><AlertTriangle className="w-3 h-3 mr-1"/> RECHAZADO</Badge>}
                {currentAnalysis.payment_status === 'DOUBTFUL' && <Badge className="bg-amber-900/30 text-amber-400 border-amber-500/30 text-[9px]"><AlertTriangle className="w-3 h-3 mr-1"/> DUDOSO</Badge>}
                {(!currentAnalysis.payment_status || currentAnalysis.payment_status === 'NONE') && <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-500">SIN COMPROBANTE</Badge>}
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <Button size="sm" variant="outline" className="flex-1 h-7 text-[9px] border-emerald-500/30 text-emerald-500 hover:bg-emerald-900/20 rounded-lg" onClick={() => handleUpdatePaymentStatus('VALID')} disabled={updatingPayment}>
                  VALIDAR
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-7 text-[9px] border-red-500/30 text-red-500 hover:bg-red-900/20 rounded-lg" onClick={() => handleUpdatePaymentStatus('INVALID')} disabled={updatingPayment}>
                  DENEGAR
                </Button>
              </div>
           </div>
        </div>

        {/* CORE DATA ACCORDION */}
        <div className="space-y-2">
           <div className="flex justify-between items-center mb-1">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Fingerprint className="w-3.5 h-3.5" /> Identidad & CRM</h4>
              {!isEditing && <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-white" onClick={() => setIsEditing(true)}><Edit2 className="w-3 h-3" /></Button>}
           </div>

           {isEditing ? (
              <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-indigo-500/50 shadow-inner">
                 
                 {/* Tareas y Recordatorios */}
                 <div className="space-y-1 mb-4 p-2 bg-indigo-900/20 border border-indigo-500/30 rounded-lg">
                    <Label className="text-[9px] text-indigo-400 uppercase tracking-widest flex items-center gap-1.5"><CalendarClock className="w-3 h-3"/> Recordatorio / Próxima Acción</Label>
                    <Input 
                       type="datetime-local" 
                       value={formatDateTimeForInput(memoryForm.next_followup_at)} 
                       onChange={e => setMemoryForm({...memoryForm, next_followup_at: e.target.value ? new Date(e.target.value).toISOString() : null})}
                       className="h-8 text-xs bg-slate-900 border-slate-700 text-slate-200" 
                    />
                 </div>

                 {isAdmin && (
                    <div className="space-y-1 mb-3 border-b border-slate-800 pb-3">
                       <Label className="text-[9px] text-slate-500 uppercase tracking-widest">Asignado A (Vendedor)</Label>
                       <Select 
                          value={memoryForm.assigned_to || "unassigned"} 
                          onValueChange={v => setMemoryForm({...memoryForm, assigned_to: v === "unassigned" ? null : v})}
                       >
                          <SelectTrigger className="h-8 text-xs bg-slate-900 border-slate-700">
                             <SelectValue placeholder="Seleccionar Agente" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800 text-white">
                             <SelectItem value="unassigned">Bot Global (Sin Asignar)</SelectItem>
                             {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                 )}

                 <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><Label className="text-[9px] text-slate-500">Nombre</Label><Input value={memoryForm.nombre} onChange={e => setMemoryForm({...memoryForm, nombre: e.target.value})} className="h-8 text-xs bg-slate-900 border-slate-700" /></div>
                    <div className="space-y-1"><Label className="text-[9px] text-slate-500">Apellido</Label><Input value={memoryForm.apellido} onChange={e => setMemoryForm({...memoryForm, apellido: e.target.value})} className="h-8 text-xs bg-slate-900 border-slate-700" /></div>
                 </div>
                 <div className="space-y-1"><Label className="text-[9px] text-slate-500">Email</Label><Input value={memoryForm.email} onChange={e => setMemoryForm({...memoryForm, email: e.target.value})} className="h-8 text-xs bg-slate-900 border-slate-700" /></div>
                 
                 <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                    <div className="space-y-1"><Label className="text-[9px] text-slate-500">Ciudad</Label><Input value={memoryForm.ciudad} onChange={e => setMemoryForm({...memoryForm, ciudad: e.target.value})} className="h-8 text-xs bg-slate-900 border-slate-700" /></div>
                    <div className="space-y-1"><Label className="text-[9px] text-slate-500">Estado</Label><Input value={memoryForm.estado} onChange={e => setMemoryForm({...memoryForm, estado: e.target.value})} className="h-8 text-xs bg-slate-900 border-slate-700" placeholder="nl, jalisco..." /></div>
                 </div>

                 {/* Sección de Etiquetas en Edición */}
                 <div className="pt-2 border-t border-slate-800 space-y-2">
                    <Label className="text-[9px] text-slate-500 uppercase tracking-widest flex items-center gap-1"><Tag className="w-3 h-3"/> Etiquetas</Label>
                    <Input 
                      value={tagInput} 
                      onChange={e => setTagInput(e.target.value)} 
                      onKeyDown={handleAddTag}
                      placeholder="Ej: MAYORISTA (Presiona Enter)" 
                      className="h-8 text-xs bg-slate-900 border-slate-700" 
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {memoryForm.tags.map((t: string) => (
                        <Badge key={t} variant="secondary" className="text-[9px] py-0 bg-slate-800 text-slate-300 hover:bg-red-900/30 hover:text-red-400 cursor-pointer flex items-center gap-1" onClick={() => removeTag(t)}>
                          {t} <X className="w-2.5 h-2.5" />
                        </Badge>
                      ))}
                    </div>
                 </div>
                 
                 <Button onClick={onSave} disabled={saving} className="w-full bg-amber-600 hover:bg-amber-500 text-slate-900 h-9 text-xs font-bold shadow-lg rounded-lg mt-2"><Save className="w-3.5 h-3.5 mr-2" /> Guardar Todos</Button>
              </div>
           ) : (
              <Accordion type="single" collapsible defaultValue="identidad" className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
                <AccordionItem value="identidad" className="border-b border-slate-800">
                  <AccordionTrigger className="px-4 py-3 text-xs font-bold hover:no-underline">Contacto</AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-2">
                     <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest">Nombre Completo</span>
                        <span className="text-xs text-slate-200">{currentAnalysis.nombre || ''} {currentAnalysis.apellido || ''} {!currentAnalysis.nombre && !currentAnalysis.apellido && 'Desconocido'}</span>
                     </div>
                     <div className="flex flex-col gap-1 mt-2">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest">Email</span>
                        <span className="text-xs text-emerald-400 font-mono">{currentAnalysis.email || 'Falta Correo'}</span>
                     </div>

                     {currentAnalysis.next_followup_at && (
                        <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-slate-800">
                           <span className="text-[9px] text-indigo-400 uppercase tracking-widest flex items-center gap-1"><CalendarClock className="w-3 h-3"/> Recordatorio / Tarea</span>
                           <span className="text-xs text-slate-200 font-medium">
                              {new Date(currentAnalysis.next_followup_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                           </span>
                        </div>
                     )}

                     <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-slate-800">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest flex items-center gap-1"><User className="w-3 h-3"/> Responsable</span>
                        <span className="text-xs text-slate-300">{currentAgentName}</span>
                     </div>

                     {currentAnalysis.tags && currentAnalysis.tags.length > 0 && (
                       <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-slate-800">
                          {currentAnalysis.tags.map((t: string) => (
                             <Badge key={t} variant="outline" className="text-[8px] border-indigo-500/30 text-indigo-300 bg-indigo-900/10">
                               <Tag className="w-2 h-2 mr-1"/> {t}
                             </Badge>
                          ))}
                       </div>
                     )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="capi_history" className="border-b border-slate-800">
                  <AccordionTrigger className="px-4 py-3 text-xs font-bold hover:no-underline flex items-center gap-2">
                     <BarChart3 className="w-3 h-3 text-indigo-400" /> Historial CAPI
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-2">
                     {loadingCapi ? (
                        <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-slate-700"/></div>
                     ) : capiHistory.length === 0 ? (
                        <p className="text-[10px] text-slate-600 italic">No se han disparado eventos aún.</p>
                     ) : (
                        <div className="space-y-2">
                           {capiHistory.map((ev, i) => (
                              <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800 group">
                                 <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-indigo-300">{ev.event_name}</span>
                                    <span className="text-[8px] text-slate-500">{new Date(ev.created_at).toLocaleDateString()}</span>
                                 </div>
                                 <div className="flex items-center gap-2">
                                    <Badge className={cn("text-[8px] h-4 px-1", ev.status === 'OK' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400')}>
                                       {ev.status}
                                    </Badge>
                                    <button onClick={() => window.location.href='/meta-capi'} className="opacity-0 group-hover:opacity-100 transition-opacity"><ExternalLink className="w-3 h-3 text-slate-600 hover:text-amber-500"/></button>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="contexto">
                  <AccordionTrigger className="px-4 py-3 text-xs font-bold hover:no-underline">Segmentación</AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 space-y-3">
                     <div className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest">Lead Score</span>
                        <Badge variant="outline" className="bg-indigo-900/30 text-indigo-300 border-indigo-500/30">{currentAnalysis.lead_score || 0}/100</Badge>
                     </div>
                     <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest">Dolor Principal</span>
                        <span className="text-xs text-slate-200 italic">{currentAnalysis.main_pain || 'No detectado'}</span>
                     </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
           )}
        </div>

        {/* BITÁCORA #CIA QUICK (Solamente visible para Admin/Dev si se desea, pero lo dejamos por si los vendedores pueden sugerir) */}
        {isAdmin && (
           <div className="space-y-3 border-t border-slate-800/60 pt-6">
              <h4 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                 <ShieldAlert className="w-3 h-3" /> #CorregirIA
              </h4>
              <Textarea value={correctionText} onChange={e => setCorrectionText(e.target.value)} placeholder="Instrucción de conducta..." className="bg-slate-950 border-slate-800 text-xs min-h-[60px] focus:border-amber-500 rounded-xl" />
              <Button onClick={handleSaveCorrection} disabled={isReporting || !correctionText.trim()} className="w-full h-9 text-[10px] border-amber-500/50 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 font-bold uppercase tracking-widest rounded-xl">
                {isReporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 mr-2" />} Inyectar Lección
              </Button>
           </div>
        )}

      </div>
      
      {/* ACTION FOOTER */}
      <div className="p-4 bg-slate-950/50 border-t border-slate-800 shrink-0">
         <Button variant="outline" className={`w-full h-11 text-xs font-bold uppercase tracking-widest rounded-xl shadow-lg transition-all ${currentAnalysis.ai_paused ? 'border-emerald-500/50 text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20' : 'border-red-500/50 text-red-500 bg-red-500/10 hover:bg-red-500/20'}`} onClick={onToggleFollowup}>
            {currentAnalysis.ai_paused ? <Zap className="w-4 h-4 mr-2"/> : <ShieldAlert className="w-4 h-4 mr-2"/>}
            {currentAnalysis.ai_paused ? 'ACTIVAR SAMURAI' : 'PAUSAR SAMURAI'}
         </Button>
      </div>
    </div>
  );
};