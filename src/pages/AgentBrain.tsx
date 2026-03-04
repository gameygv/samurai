import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Save, Bot, Eye as EyeIcon, Zap, Loader2, Terminal, BrainCircuit, Target, 
  GitBranch, User, RefreshCcw, Layers, History, RotateCcw, Trash2, Send, Image as ImageIcon, Sparkles, X, Fingerprint, MessageSquare, AlertTriangle, Database
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const AgentBrain = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'alma';
  const { profile } = useAuth();
  
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [versions, setVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [masterPrompt, setMasterPrompt] = useState("");
  const [loadingMaster, setLoadingMaster] = useState(false);

  // Snapshot Dialog
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');

  // Meta-Tuner State
  const [tunerMessages, setTunerMessages] = useState<any[]>([]);
  const [tunerInput, setTunerInput] = useState('');
  const [tunerImage, setTunerImage] = useState<string | null>(null);
  const [tuning, setTuning] = useState(false);
  const tunerScrollRef = useRef<HTMLDivElement>(null);

  // Simulator State
  const [simMessages, setSimMessages] = useState<{role: string, text: string, explanation?: any}[]>([]);
  const [simInput, setSimInput] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simProfile, setSimProfile] = useState('NORMAL');
  const simScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { 
    fetchPrompts(); 
    fetchVersions(); 
  }, []);
  
  useEffect(() => { if (tunerScrollRef.current) tunerScrollRef.current.scrollIntoView({ behavior: 'smooth' }); }, [tunerMessages, tuning]);
  useEffect(() => { if (simScrollRef.current) simScrollRef.current.scrollIntoView({ behavior: 'smooth' }); }, [simMessages, simulating]);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
        const { data } = await supabase.from('app_config').select('key, value').eq('category', 'PROMPT');
        if (data) {
            const p: any = {};
            data.forEach(item => p[item.key] = item.value);
            setPrompts(p);
        }
        handleRefreshMaster();
    } finally {
        setLoading(false);
    }
  };

  const fetchVersions = async () => {
    setLoadingVersions(true);
    try {
      const { data } = await supabase.from('prompt_versions').select('*').order('created_at', { ascending: false });
      if (data) setVersions(data);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRefreshMaster = async () => {
    setLoadingMaster(true);
    try {
      const { data } = await supabase.functions.invoke('get-samurai-context');
      if (data) setMasterPrompt(data.system_prompt || "");
    } finally {
      setLoadingMaster(false);
    }
  };

  const handleSaveSnapshot = async () => {
    setSaving(true);
    try {
      const promptsToSave = Object.entries(prompts).map(([key, value]) => ({
        key, value: value || '', category: 'PROMPT',
      }));
      await supabase.from('app_config').upsert(promptsToSave, { onConflict: 'key' });
      
      await supabase.from('prompt_versions').insert({
        version_name: snapshotName || `Manual ${new Date().toLocaleDateString()}`,
        prompts_snapshot: prompts,
        created_by_name: profile?.username || 'Admin',
        notes: 'Snapshot guardado desde el panel'
      });

      toast.success('Cambios aplicados y snapshot creado.');
      setIsSaveDialogOpen(false);
      setSnapshotName('');
      handleRefreshMaster();
      fetchVersions();
    } finally {
      setSaving(false);
    }
  };

  // --- SIMULADOR ---
  const handleSimulateSubmit = async () => {
     if (!simInput.trim()) return;
     const userText = simInput;
     setSimMessages(prev => [...prev, { role: 'user', text: `[PERFIL: ${simProfile}] ${userText}` }]);
     setSimInput('');
     setSimulating(true);
     try {
        const { data, error } = await supabase.functions.invoke('simulate-samurai', { body: { question: userText, profile: simProfile } });
        if (error) throw error;
        setSimMessages(prev => [...prev, { role: 'assistant', text: data.answer, explanation: data.explanation }]);
     } catch (e: any) {
        toast.error("Error en simulación: " + e.message);
     } finally {
        setSimulating(false);
     }
  };

  const handleReportSimError = async (userMsg: string, aiRes: string) => {
     const instruction = prompt("¿Qué debería haber respondido o qué instrucción de #CIA quieres inyectar?");
     if (!instruction) return;
     const tid = toast.loading("Inyectando lección en Bitácora...");
     try {
        await supabase.from('errores_ia').insert({
            mensaje_cliente: `SIMULACIÓN: ${userMsg}`, respuesta_ia: aiRes,
            correccion_sugerida: instruction, categoria: 'CONDUCTA', estado_correccion: 'REPORTADA'
        });
        toast.success("Lección enviada a la Bitácora para validación.", { id: tid });
     } catch (err) { toast.error("Error al reportar", { id: tid }); }
  };

  const handleTuneSubmit = async () => {
      if (!tunerInput.trim() && !tunerImage) return;
      const newUserMsg = { role: 'user', text: tunerInput, image: tunerImage };
      setTunerMessages(prev => [...prev, newUserMsg]);
      setTunerInput('');
      setTuning(true);
      try {
          const { data, error } = await supabase.functions.invoke('tune-samurai-prompts', { body: { messages: [...tunerMessages, newUserMsg], currentPrompts: prompts } });
          if (error) throw error;
          const result = data.result;
          setTunerMessages(prev => [...prev, { role: 'assistant', text: result.message }]);
          setPrompts({ ...prompts, ...result.prompts });
          toast.success("¡Prompts regenerados! Revisa las pestañas.");
      } catch (e: any) {
          toast.error("Error en laboratorio: " + e.message);
      } finally {
          setTuning(false);
      }
  };

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto flex flex-col h-[calc(100vh-140px)] gap-6 overflow-hidden">
        
        {/* HEADER FIJO */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 px-1">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
               <BrainCircuit className="w-8 h-8 text-indigo-500" /> Cerebro Core
            </h1>
            <p className="text-slate-400 text-sm">Control transparente y absoluto de la IA (Sin código oculto).</p>
          </div>
          <Button onClick={() => setIsSaveDialogOpen(true)} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 font-bold px-8 shadow-xl border border-indigo-400/30">
             {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
             GUARDAR SNAPSHOT
          </Button>
        </div>

        {/* TABS CON ALTURA CONTROLADA */}
        <Tabs value={initialTab} onValueChange={v => setSearchParams({ tab: v })} className="flex-1 flex flex-col min-h-0 bg-slate-900/30 rounded-xl border border-slate-800 p-1">
          <TabsList className="bg-slate-950/50 border border-slate-800 p-1 mb-2 flex-wrap h-auto w-full justify-start shrink-0">
             <TabsTrigger value="alma" className="gap-2 data-[state=active]:bg-indigo-600"><Target className="w-4 h-4"/> 1. Alma</TabsTrigger>
             <TabsTrigger value="identidad" className="gap-2 data-[state=active]:bg-indigo-600"><User className="w-4 h-4"/> 2. ADN & Cierre</TabsTrigger>
             <TabsTrigger value="versiones" className="gap-2 data-[state=active]:bg-indigo-600"><GitBranch className="w-4 h-4"/> 3. Snapshots</TabsTrigger>
             <TabsTrigger value="ojo_halcon" className="gap-2 data-[state=active]:bg-indigo-600"><EyeIcon className="w-4 h-4"/> 4. Ojo de Halcón</TabsTrigger>
             <TabsTrigger value="simulador" className="gap-2 data-[state=active]:bg-blue-600"><MessageSquare className="w-4 h-4"/> 5. Simulador</TabsTrigger>
             <TabsTrigger value="tuner" className="gap-2 data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600"><Sparkles className="w-4 h-4"/> 6. Laboratorio IA</TabsTrigger>
             <TabsTrigger value="debug" className="gap-2 data-[state=active]:bg-slate-700"><Terminal className="w-4 h-4"/> 7. Kernel Debug</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 relative">
            
            {/* PESTAÑA 1: ALMA */}
            <TabsContent value="alma" className="absolute inset-0 m-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                   <PromptCard title="ALMA DE SAMURAI" icon={Bot} value={prompts['prompt_alma_samurai']} onChange={(v:string) => setPrompts({...prompts, prompt_alma_samurai: v})} placeholder="Misión base de Sam..." />
                   <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-emerald-500 flex flex-col h-full overflow-hidden">
                      <CardHeader className="shrink-0 py-3 border-b border-slate-800 bg-slate-950/20"><CardTitle className="text-white text-xs flex items-center gap-2 uppercase tracking-widest"><Layers className="w-4 h-4 text-emerald-400" /> Jerarquía del Kernel</CardTitle></CardHeader>
                      <ScrollArea className="flex-1 p-4">
                        <div className="space-y-3">
                            <LogicStep num={1} title="Alma & ADN Core" desc="Propósito, personalidad y tono." color="text-indigo-400" icon={Bot}/>
                            <LogicStep num={2} title="Estrategia de Cierre" desc="Táctica de ventas y fases (1, 2, 3)." color="text-blue-400" icon={Target}/>
                            <LogicStep num={3} title="Media Manager" desc="Pósters y disparadores visuales." color="text-yellow-500" icon={ImageIcon}/>
                            <LogicStep num={4} title="Verdad Maestra" desc="Datos oficiales de theelephantbowl.com." color="text-emerald-400" icon={Database}/>
                            <LogicStep num={5} title="Base Conocimiento" desc="PDFs y documentos técnicos." color="text-orange-400" icon={Fingerprint}/>
                            <LogicStep num={6} title="Bitácora #CIA" desc="Correcciones de última milla (Prioridad Máxima)." color="text-red-500" icon={AlertTriangle}/>
                        </div>
                      </ScrollArea>
                   </Card>
                </div>
            </TabsContent>

            {/* PESTAÑA 2: ADN & CIERRE */}
            <TabsContent value="identidad" className="absolute inset-0 m-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                   <PromptCard title="ADN CORE" icon={Fingerprint} value={prompts['prompt_adn_core']} onChange={(v:string) => setPrompts({...prompts, prompt_adn_core: v})} placeholder="Personalidad..." />
                   <PromptCard title="ESTRATEGIA DE CIERRE" icon={Target} value={prompts['prompt_estrategia_cierre']} onChange={(v:string) => setPrompts({...prompts, prompt_estrategia_cierre: v})} placeholder="Fases de venta..." />
                </div>
            </TabsContent>

            {/* PESTAÑA 3: SNAPSHOTS */}
            <TabsContent value="versiones" className="absolute inset-0 m-0">
               <Card className="bg-slate-900 border-slate-800 h-full flex flex-col overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 py-3 shrink-0">
                     <CardTitle className="text-white text-xs flex items-center gap-2 uppercase tracking-widest"><History className="w-4 h-4 text-indigo-400" /> Historial de Snapshots</CardTitle>
                     <Button variant="ghost" size="sm" className="h-7 text-red-500 hover:bg-red-500/10 text-[10px]" onClick={async () => { if(confirm("¿Purgar todo el historial?")) { await supabase.functions.invoke('manage-prompt-versions', { body: { action: 'PURGE' } }); fetchVersions(); } }}>PURGAR HISTORIAL</Button>
                  </CardHeader>
                  <ScrollArea className="flex-1">
                     <Table>
                        <TableHeader><TableRow className="border-slate-800 bg-slate-950/20"><TableHead className="pl-6 text-[10px]">Versión / Snapshot</TableHead><TableHead className="text-[10px]">Fecha de Creación</TableHead><TableHead className="text-right pr-6 text-[10px]">Acciones</TableHead></TableRow></TableHeader>
                        <TableBody>
                           {loadingVersions ? (
                              <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                           ) : versions.length === 0 ? (
                              <TableRow><TableCell colSpan={3} className="text-center py-10 text-slate-500 italic">No hay snapshots guardados.</TableCell></TableRow>
                           ) : versions.map(v => (
                              <TableRow key={v.id} className="border-slate-800 hover:bg-slate-800/30">
                                 <TableCell className="font-mono text-indigo-400 text-xs pl-6">{v.version_name}</TableCell>
                                 <TableCell className="text-slate-500 text-xs">{new Date(v.created_at).toLocaleString()}</TableCell>
                                 <TableCell className="text-right pr-6"><Button variant="outline" size="sm" className="h-7 text-[9px] border-indigo-500/30 text-indigo-400" onClick={() => { setPrompts(v.prompts_snapshot); toast.info("Snapshot cargado. No olvides GUARDAR."); }}><RotateCcw className="w-3 h-3 mr-1" /> RESTAURAR</Button></TableCell>
                              </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                  </ScrollArea>
               </Card>
            </TabsContent>

            {/* PESTAÑA 4: OJO DE HALCÓN */}
            <TabsContent value="ojo_halcon" className="absolute inset-0 m-0">
                <PromptCard title="VISIÓN AI (INSTRUCCIONES OCR)" icon={EyeIcon} value={prompts['prompt_vision_instrucciones']} onChange={(v:string) => setPrompts({...prompts, prompt_vision_instrucciones: v})} placeholder="Instrucciones para recibos..." />
            </TabsContent>

            {/* PESTAÑA 5: SIMULADOR */}
            <TabsContent value="simulador" className="absolute inset-0 m-0 flex flex-col">
                <Card className="bg-slate-950 border-slate-800 shadow-2xl flex-1 flex flex-col overflow-hidden border-t-4 border-t-blue-600">
                    <CardHeader className="border-b border-slate-800 bg-slate-900/50 py-3 flex flex-row items-center justify-between shrink-0 px-4">
                        <div><CardTitle className="text-white text-xs flex items-center gap-2 uppercase tracking-widest"><MessageSquare className="w-4 h-4 text-blue-400" /> Simulador de Combate</CardTitle></div>
                        <Select value={simProfile} onValueChange={setSimProfile}><SelectTrigger className="w-40 bg-slate-950 border-slate-800 h-8 text-[10px]"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-900 text-white border-slate-800"><SelectItem value="NORMAL">Lead Normal</SelectItem><SelectItem value="HOSTIL">Lead Hostil</SelectItem><SelectItem value="SIN_DATOS">Sin Datos Previos</SelectItem></SelectContent></Select>
                    </CardHeader>
                    <ScrollArea className="flex-1 p-4 bg-black/10">
                        <div className="space-y-4 max-w-4xl mx-auto">
                           {simMessages.length === 0 && <div className="py-20 text-center text-slate-600 italic text-sm">Inicia una conversación para probar el Kernel...</div>}
                           {simMessages.map((msg, i) => (
                              <div key={i} className={cn("flex flex-col gap-2", msg.role === 'user' ? 'items-end' : 'items-start')}>
                                 <div className={cn("max-w-[85%] rounded-2xl p-4 text-sm relative group shadow-lg", msg.role === 'user' ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100' : 'bg-slate-900 border border-slate-800 text-slate-300')}>
                                    <p className="whitespace-pre-wrap">{msg.text}</p>
                                    {msg.role === 'assistant' && (<button onClick={() => handleReportSimError(simMessages[i-1]?.text, msg.text)} className="absolute -right-10 top-0 p-2 opacity-0 group-hover:opacity-100 text-red-500 transition-opacity"><AlertTriangle className="w-4 h-4" /></button>)}
                                 </div>
                                 {msg.explanation && <div className="text-[9px] text-slate-500 italic ml-4 bg-slate-900/30 p-2 rounded border border-slate-800/50 max-w-[80%]"><strong className="text-indigo-400 uppercase">Kernel Reasoning:</strong> {msg.explanation.reasoning}</div>}
                              </div>
                           ))}
                           {simulating && <div className="text-slate-500 flex gap-2 items-center text-xs p-4"><Loader2 className="w-3 h-3 animate-spin text-blue-500"/> Sam analizando prompt...</div>}
                           <div ref={simScrollRef} />
                        </div>
                    </ScrollArea>
                    <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
                        <div className="flex gap-2 max-w-4xl mx-auto">
                           <Input value={simInput} onChange={e => setSimInput(e.target.value)} placeholder="Simular mensaje del cliente..." className="bg-slate-950 border-slate-700 h-12 text-sm" onKeyDown={e => e.key === 'Enter' && handleSimulateSubmit()} />
                           <Button onClick={handleSimulateSubmit} disabled={simulating || !simInput.trim()} className="bg-blue-600 h-12 w-12"><Send className="w-4 h-4" /></Button>
                        </div>
                    </div>
                </Card>
            </TabsContent>

            {/* PESTAÑA 6: LABORATORIO IA */}
            <TabsContent value="tuner" className="absolute inset-0 m-0 flex flex-col">
                <Card className="bg-slate-950 border-slate-800 shadow-2xl flex-1 flex flex-col overflow-hidden border-t-4 border-t-purple-600">
                    <CardHeader className="border-b border-slate-800 bg-slate-900/50 py-3 shrink-0 px-4">
                        <CardTitle className="text-white text-xs flex items-center gap-2 uppercase tracking-widest"><Sparkles className="w-4 h-4 text-purple-400" /> Laboratorio IA (Meta-Tuner)</CardTitle>
                        <CardDescription className="text-[10px]">Indica qué quieres cambiar y la IA reescribirá tus prompts técnicos.</CardDescription>
                    </CardHeader>
                    <ScrollArea className="flex-1 p-4 bg-black/10">
                        <div className="space-y-4 max-w-4xl mx-auto">
                           {tunerMessages.length === 0 && (
                              <div className="text-center py-20">
                                 <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4"><Sparkles className="w-8 h-8 text-purple-500" /></div>
                                 <p className="text-slate-400 text-sm">Dile al Ingeniero qué corregir en la personalidad o táctica de Sam.</p>
                                 <p className="text-[10px] text-slate-600 italic mt-2">"Asegúrate de que Sam siempre pida la ciudad antes del precio."</p>
                              </div>
                           )}
                           {tunerMessages.map((msg, i) => (
                              <div key={i} className={cn("flex", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                                 <div className={cn("max-w-[85%] rounded-2xl p-4 text-sm shadow-xl", msg.role === 'user' ? 'bg-indigo-600/20 border border-indigo-500/30' : 'bg-slate-900 border border-slate-800')}>
                                    <p className="whitespace-pre-wrap">{msg.text}</p>
                                 </div>
                              </div>
                           ))}
                           {tuning && <div className="p-4 text-xs text-purple-400 animate-pulse font-mono">REESCRIVIENDO MEMORIA CORE...</div>}
                           <div ref={tunerScrollRef} />
                        </div>
                    </ScrollArea>
                    <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
                        <div className="flex gap-2 max-w-4xl mx-auto items-end">
                           <Textarea value={tunerInput} onChange={e => setTunerInput(e.target.value)} placeholder="Instrucciones para el Ingeniero Maestro..." className="bg-slate-950 border-slate-700 min-h-[50px] max-h-40 resize-none py-3 text-sm focus-visible:ring-purple-500" onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTuneSubmit(); }}} />
                           <Button onClick={handleTuneSubmit} disabled={tuning || !tunerInput.trim()} className="h-12 w-12 shrink-0 bg-purple-600 hover:bg-purple-700"><Send className="w-4 h-4" /></Button>
                        </div>
                    </div>
                </Card>
            </TabsContent>

            {/* PESTAÑA 7: KERNEL DEBUG */}
            <TabsContent value="debug" className="absolute inset-0 m-0 flex flex-col">
                <Card className="bg-slate-900 border-slate-800 shadow-2xl relative flex-1 flex flex-col overflow-hidden">
                    <div className="absolute top-3 right-4 z-10">
                       <Button onClick={handleRefreshMaster} variant="outline" className="h-8 text-[10px] border-indigo-500/50 text-indigo-400 bg-slate-950" disabled={loadingMaster}>
                          {loadingMaster ? <Loader2 className="w-3 h-3 animate-spin mr-1"/> : <RefreshCcw className="w-3 h-3 mr-1"/>} RE-ENSAMBLAR KERNEL
                       </Button>
                    </div>
                    <CardHeader className="shrink-0 py-3 bg-slate-950/20 border-b border-slate-800"><CardTitle className="text-[10px] text-slate-500 flex items-center gap-2 uppercase tracking-widest"><Terminal className="w-4 h-4" /> Ensamblaje Maestro Final</CardTitle></CardHeader>
                    <ScrollArea className="flex-1 bg-black p-6">
                       <pre className="text-[11px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed select-text">
                          {loadingMaster ? "Cargando constitución samurai..." : masterPrompt || "Inicia el Kernel para ver el prompt final."}
                       </pre>
                    </ScrollArea>
                </Card>
            </TabsContent>

          </div>
        </Tabs>

        {/* DIALOG SNAPSHOT */}
        <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
           <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-sm">
              <DialogHeader><DialogTitle>Crear Snapshot Maestro</DialogTitle><DialogDescription>Esto guarda tus prompts y crea un punto de restauración.</DialogDescription></DialogHeader>
              <div className="py-4"><Input value={snapshotName} onChange={e => setSnapshotName(e.target.value)} placeholder="Ej: Fix Venta CDMX" className="bg-slate-950 border-slate-800" /></div>
              <DialogFooter><Button onClick={handleSaveSnapshot} disabled={saving || !snapshotName} className="bg-indigo-600 w-full">{saving ? <Loader2 className="animate-spin w-4 h-4" /> : 'Confirmar & Aplicar'}</Button></DialogFooter>
           </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

const PromptCard = ({ title, icon: Icon, value, onChange, placeholder }: any) => (
  <Card className="bg-slate-900 border-slate-800 h-full flex flex-col overflow-hidden shadow-xl border-t-2 border-t-indigo-500/30">
    <CardHeader className="py-3 border-b border-slate-800 bg-slate-950/20 shrink-0"><CardTitle className="text-[11px] text-white flex items-center gap-2 uppercase tracking-widest"><Icon className="w-4 h-4 text-indigo-500"/> {title}</CardTitle></CardHeader>
    <CardContent className="p-0 flex-1 flex flex-col">
        <Textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="flex-1 rounded-none border-0 bg-slate-950 font-mono text-xs focus-visible:ring-0 p-5 leading-relaxed custom-scrollbar resize-none" />
    </CardContent>
  </Card>
);

const LogicStep = ({ num, title, desc, color, icon: Icon }: any) => (
   <div className="flex gap-4 items-start bg-slate-950/30 p-3 rounded-lg border border-slate-800/50 hover:bg-slate-800/20 transition-colors">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-900 border border-slate-700 shrink-0 ${color}`}><Icon className="w-4 h-4" /></div>
      <div><p className={`text-xs font-bold ${color}`}>{num}. {title}</p><p className="text-[10px] text-slate-500 leading-relaxed mt-1">{desc}</p></div>
   </div>
);

export default AgentBrain;