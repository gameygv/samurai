"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Save, Bot, Eye as EyeIcon, Zap, Loader2, Terminal, BrainCircuit, Target, 
  GitBranch, User, RefreshCcw, Layers, History, RotateCcw, Send, Sparkles, Fingerprint, MessageSquare, AlertTriangle, Database, ImageIcon, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PromptEditor } from '@/components/brain/PromptEditor';
import { KernelStep } from '@/components/brain/KernelStep';

const AgentBrain = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'alma';
  const { profile } = useAuth();
  
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [masterPrompt, setMasterPrompt] = useState("");
  const [loadingMaster, setLoadingMaster] = useState(false);

  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  
  const [tunerMessages, setTunerMessages] = useState<any[]>([]);
  const [tunerInput, setTunerInput] = useState('');
  const [tuning, setTuning] = useState(false);

  const [simMessages, setSimMessages] = useState<any[]>([]);
  const [simInput, setSimInput] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simProfile, setSimProfile] = useState('NORMAL');

  const tunerEndRef = useRef<HTMLDivElement>(null);
  const simEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchPrompts(); fetchVersions(); }, []);
  useEffect(() => tunerEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [tunerMessages, tuning]);
  useEffect(() => simEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [simMessages, simulating]);

  const fetchPrompts = async () => {
    setLoading(true);
    const { data } = await supabase.from('app_config').select('key, value').eq('category', 'PROMPT');
    if (data) {
        const p: any = {};
        data.forEach(item => p[item.key] = item.value);
        setPrompts(p);
    }
    await handleRefreshMaster();
    setLoading(false);
  };

  const fetchVersions = async () => {
    const { data } = await supabase.from('prompt_versions').select('*').order('created_at', { ascending: false });
    if (data) setVersions(data);
  };

  const handleRefreshMaster = async () => {
    setLoadingMaster(true);
    const { data } = await supabase.functions.invoke('get-samurai-context');
    if (data) setMasterPrompt(data.system_prompt || "");
    setLoadingMaster(false);
  };

  const restoreMasterPrompts = async () => {
     setRestoring(true);
     const tid = toast.loading("Restaurando ADN desde la memoria maestra...");
     try {
        const masterDefaults = [
           { key: 'prompt_alma_samurai', category: 'PROMPT', value: 'Eres Sam, Asistente Digital Senior de The Elephant Bowl. Tu misión es guiar en sanación sonora con calma y efectividad comercial.' },
           { key: 'prompt_adn_core', category: 'PROMPT', value: 'TONO: Cálido y místico. ESTILO: Conciso (3 párrafos max). Usa emojis (🧘‍♂️, ✨) con moderación.' },
           { key: 'prompt_estrategia_cierre', category: 'PROMPT', value: 'FASE 1: Pide Nombre/Ciudad. FASE 2: Envía póster ciudad. FASE 3: Anticipo $1,500 MXN. Pide EMAIL para datos de pago.' },
           { key: 'prompt_vision_instrucciones', category: 'PROMPT', value: 'Auditor Financiero: Extrae Banco, Monto ($), Fecha y Referencia de comprobantes.' }
        ];
        await supabase.from('app_config').upsert(masterDefaults, { onConflict: 'key' });
        toast.success("¡Memoria Restaurada! Los cambios están en los paneles.", { id: tid });
        fetchPrompts();
     } finally { setRestoring(false); }
  };

  const handleSaveSnapshot = async () => {
    if (!snapshotName.trim()) return toast.error("El nombre del snapshot es obligatorio.");
    setSaving(true);
    try {
      const updates = Object.entries(prompts).map(([k, v]) => ({ key: k, value: v || '', category: 'PROMPT' }));
      await supabase.from('app_config').upsert(updates, { onConflict: 'key' });
      await supabase.from('prompt_versions').insert({
        version_name: snapshotName,
        prompts_snapshot: prompts,
        created_by_name: profile?.username || 'Admin'
      });
      toast.success('Snapshot guardado y aplicado al Kernel.');
      setIsSaveDialogOpen(false);
      setSnapshotName('');
      fetchVersions();
      handleRefreshMaster();
    } finally { setSaving(false); }
  };

  const handleSimulate = async () => {
    if (!simInput.trim()) return;
    const text = simInput;
    setSimMessages(prev => [...prev, { role: 'user', text: `[${simProfile}] ${text}` }]);
    setSimInput('');
    setSimulating(true);
    try {
      const { data, error } = await supabase.functions.invoke('simulate-samurai', { body: { question: text, profile: simProfile } });
      if (error) throw error;
      setSimMessages(prev => [...prev, { role: 'assistant', text: data.answer, explanation: data.explanation }]);
    } catch (e: any) { toast.error("Kernel desconectado: " + e.message); } finally { setSimulating(false); }
  };

  const handleTune = async () => {
    if (!tunerInput.trim()) return;
    const text = tunerInput;
    setTunerMessages(prev => [...prev, { role: 'user', text }]);
    setTunerInput('');
    setTuning(true);
    try {
      const { data, error } = await supabase.functions.invoke('tune-samurai-prompts', { body: { messages: [...tunerMessages, { role: 'user', text }], currentPrompts: prompts } });
      if (error) throw error;
      setTunerMessages(prev => [...prev, { role: 'assistant', text: data.result.message }]);
      setPrompts({ ...prompts, ...data.result.prompts });
      toast.success("Sugerencias de IA aplicadas a los paneles.");
    } finally { setTuning(false); }
  };

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto flex flex-col h-[calc(100vh-140px)] gap-6 overflow-hidden">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
               <BrainCircuit className="w-8 h-8 text-indigo-500" /> Cerebro Core
            </h1>
            <p className="text-slate-400 text-sm">Configuración Maestra e Inteligencia de Vuelo.</p>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" onClick={restoreMasterPrompts} disabled={restoring} className="border-red-500/50 text-red-500 hover:bg-red-500/10 font-bold px-6">
                {restoring ? <Loader2 className="animate-spin w-4 h-4 mr-2"/> : <RotateCcw className="w-4 h-4 mr-2"/>}
                RESTAURAR ADN
             </Button>
             <Button onClick={() => setIsSaveDialogOpen(true)} disabled={loading || saving} className="bg-indigo-600 hover:bg-indigo-700 font-bold px-8 shadow-xl border border-indigo-400/30">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                GUARDAR SNAPSHOT
             </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })} className="flex-1 flex flex-col min-h-0">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-4 w-full justify-start shrink-0 overflow-x-auto overflow-y-hidden h-auto flex-nowrap">
             <TabsTrigger value="alma" className="gap-2 shrink-0"><Bot className="w-4 h-4"/> 1. Alma</TabsTrigger>
             <TabsTrigger value="identidad" className="gap-2 shrink-0"><Fingerprint className="w-4 h-4"/> 2. ADN & Venta</TabsTrigger>
             <TabsTrigger value="snapshots" className="gap-2 shrink-0"><GitBranch className="w-4 h-4"/> 3. Snapshots</TabsTrigger>
             <TabsTrigger value="vision" className="gap-2 shrink-0"><EyeIcon className="w-4 h-4"/> 4. Ojo Halcón</TabsTrigger>
             <TabsTrigger value="simulador" className="gap-2 shrink-0 data-[state=active]:bg-blue-600"><MessageSquare className="w-4 h-4"/> 5. Simulador</TabsTrigger>
             <TabsTrigger value="tuner" className="gap-2 shrink-0 data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 transition-all"><Sparkles className="w-4 h-4 text-yellow-400"/> 6. Laboratorio IA</TabsTrigger>
             <TabsTrigger value="debug" className="gap-2 shrink-0"><Terminal className="w-4 h-4"/> 7. Kernel Debug</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 relative">
            <TabsContent value="alma" className="absolute inset-0 m-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                  <PromptEditor title="Alma de Samurai" icon={Bot} value={prompts['prompt_alma_samurai']} onChange={v => setPrompts({...prompts, prompt_alma_samurai: v})} placeholder="Cargando misión..." />
                  <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-emerald-500 flex flex-col h-full overflow-hidden">
                    <CardHeader className="shrink-0 py-4 border-b border-slate-800 bg-slate-950/20"><CardTitle className="text-white text-xs flex items-center gap-2 uppercase tracking-widest"><Layers className="w-4 h-4 text-emerald-400" /> Jerarquía del Kernel</CardTitle></CardHeader>
                    <ScrollArea className="flex-1 p-6">
                      <div className="space-y-4">
                          <KernelStep num={1} title="Alma & ADN Core" desc="Personalidad, empatía y misión suprema." color="text-indigo-400" icon={Bot}/>
                          <KernelStep num={2} title="Estrategia de Cierre" desc="Protocolo de 3 fases y captación de datos." color="text-blue-400" icon={Target}/>
                          <KernelStep num={3} title="Media Manager" desc="Pósters y disparadores visuales por ciudad." color="text-yellow-500" icon={ImageIcon}/>
                          <KernelStep num={4} title="Verdad Maestra" desc="Datos reales leídos de theelephantbowl.com." color="text-emerald-400" icon={Database}/>
                          <KernelStep num={5} title="Base Conocimiento" desc="PDFs y documentos técnicos adicionales." color="text-orange-400" icon={Fingerprint}/>
                          <KernelStep num={6} title="Bitácora #CIA" desc="Correcciones de conducta (Prioridad Máxima)." color="text-red-500" icon={AlertTriangle}/>
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
            </TabsContent>

            <TabsContent value="identidad" className="absolute inset-0 m-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                  <PromptEditor title="ADN Core (Personalidad)" icon={Fingerprint} value={prompts['prompt_adn_core']} onChange={v => setPrompts({...prompts, prompt_adn_core: v})} placeholder="Tono y estilo..." />
                  <PromptEditor title="Estrategia de Cierre" icon={Target} value={prompts['prompt_estrategia_cierre']} onChange={v => setPrompts({...prompts, prompt_estrategia_cierre: v})} placeholder="Táctica de ventas..." color="text-blue-400" />
                </div>
            </TabsContent>

            <TabsContent value="snapshots" className="absolute inset-0 m-0">
               <Card className="bg-slate-900 border-slate-800 h-full flex flex-col overflow-hidden">
                  <CardHeader className="shrink-0 border-b border-slate-800 pb-4 flex flex-row items-center justify-between"><CardTitle className="text-white text-xs flex items-center gap-2 uppercase tracking-widest"><History className="w-5 h-5 text-indigo-400" /> Historial Maestro</CardTitle></CardHeader>
                  <ScrollArea className="flex-1">
                     <Table>
                        <TableHeader><TableRow className="border-slate-800"><TableHead className="pl-6">Snapshot</TableHead><TableHead>Fecha</TableHead><TableHead className="text-right pr-6">Acción</TableHead></TableRow></TableHeader>
                        <TableBody>
                           {versions.map(v => (
                              <TableRow key={v.id} className="border-slate-800 hover:bg-slate-800/30">
                                 <TableCell className="font-mono text-indigo-400 text-xs pl-6">{v.version_name}</TableCell>
                                 <TableCell className="text-slate-500 text-xs">{new Date(v.created_at).toLocaleString()}</TableCell>
                                 <TableCell className="text-right pr-6"><Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => { setPrompts(v.prompts_snapshot); toast.info("Cargado. Guarda para aplicar."); }}><RotateCcw className="w-3 h-3 mr-1" /> RESTAURAR</Button></TableCell>
                              </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                  </ScrollArea>
               </Card>
            </TabsContent>

            <TabsContent value="vision" className="absolute inset-0 m-0">
                <PromptEditor title="Ojo de Halcón (Instrucciones OCR)" icon={EyeIcon} value={prompts['prompt_vision_instrucciones']} onChange={v => setPrompts({...prompts, prompt_vision_instrucciones: v})} placeholder="Reglas para leer imágenes..." color="text-red-400" />
            </TabsContent>

            <TabsContent value="simulador" className="absolute inset-0 m-0 flex flex-col">
                <Card className="bg-slate-950 border-slate-800 shadow-2xl flex-1 flex flex-col overflow-hidden border-t-4 border-t-blue-600">
                    <CardHeader className="border-b border-slate-800 bg-slate-900/50 py-4 flex flex-row items-center justify-between shrink-0 px-6">
                        <div>
                          <CardTitle className="text-white text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-blue-400" /> Simulador de Combate</CardTitle>
                          <CardDescription className="text-[10px]">Verifica que Sam recuerde tus reglas de venta.</CardDescription>
                        </div>
                        <Select value={simProfile} onValueChange={setSimProfile}><SelectTrigger className="w-40 bg-slate-950 border-slate-800 h-9 text-[10px]"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-900 text-white border-slate-800"><SelectItem value="NORMAL">Lead Normal</SelectItem><SelectItem value="SIN_DATOS">Sin Datos Previos</SelectItem><SelectItem value="HOSTIL">Lead Difícil</SelectItem></SelectContent></Select>
                    </CardHeader>
                    <ScrollArea className="flex-1 p-6 bg-black/20">
                        <div className="space-y-6 max-w-4xl mx-auto">
                           {simMessages.map((msg, i) => (
                              <div key={i} className={cn("flex flex-col gap-2", msg.role === 'user' ? 'items-end' : 'items-start')}>
                                 <div className={cn("max-w-[85%] rounded-2xl p-4 text-sm relative group shadow-xl", msg.role === 'user' ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100' : 'bg-slate-900 border border-slate-800 text-slate-300')}>
                                    <p className="whitespace-pre-wrap">{msg.text}</p>
                                 </div>
                                 {msg.explanation && <div className="text-[9px] text-slate-500 italic ml-4 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/50 max-w-[80%]"><strong className="text-indigo-400 uppercase">Reasoning:</strong> {msg.explanation.reasoning}</div>}
                              </div>
                           ))}
                           {simulating && <div className="text-slate-500 flex gap-2 items-center text-xs p-4 animate-pulse"><Loader2 className="w-3 h-3 animate-spin text-blue-500"/> Sam analizando el prompt...</div>}
                           <div ref={simEndRef} />
                        </div>
                    </ScrollArea>
                    <div className="p-6 bg-slate-900 border-t border-slate-800 shrink-0">
                        <div className="flex gap-3 max-w-4xl mx-auto">
                           <Input value={simInput} onChange={e => setSimInput(e.target.value)} placeholder="Simular mensaje del cliente..." className="bg-slate-950 border-slate-700 h-12 shadow-inner" onKeyDown={e => e.key === 'Enter' && handleSimulate()} />
                           <Button onClick={handleSimulate} disabled={simulating || !simInput.trim()} className="bg-blue-600 h-12 w-14 shadow-lg hover:bg-blue-500"><Send className="w-5 h-5" /></Button>
                        </div>
                    </div>
                </Card>
            </TabsContent>

            <TabsContent value="tuner" className="absolute inset-0 m-0 flex flex-col">
                <Card className="bg-slate-950 border-slate-800 shadow-2xl flex-1 flex flex-col overflow-hidden border-t-4 border-t-purple-600">
                    <CardHeader className="border-b border-slate-800 bg-slate-900/50 py-4 shrink-0 px-6">
                        <CardTitle className="text-white text-sm flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-400" /> Laboratorio IA (Meta-Tuner)</CardTitle>
                        <CardDescription className="text-[10px]">Indica un error o mejora y el Ingeniero Maestro reescribirá tus prompts.</CardDescription>
                    </CardHeader>
                    <ScrollArea className="flex-1 p-6 bg-black/20">
                        <div className="space-y-6 max-w-4xl mx-auto">
                           {tunerMessages.length === 0 && (
                              <div className="text-center py-24 opacity-40">
                                 <Sparkles className="w-12 h-12 mx-auto mb-4 text-purple-500" />
                                 <p className="text-lg">Laboratorio listo para calibración.</p>
                                 <p className="text-xs mt-2 italic">"Sam está siendo muy agresivo, suaviza su tono místico."</p>
                              </div>
                           )}
                           {tunerMessages.map((msg, i) => (
                              <div key={i} className={cn("flex", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                                 <div className={cn("max-w-[85%] rounded-2xl p-4 text-sm shadow-2xl", msg.role === 'user' ? 'bg-indigo-600/20 border border-indigo-500/30' : 'bg-slate-900 border border-slate-800')}>
                                    <p className="whitespace-pre-wrap">{msg.text}</p>
                                 </div>
                              </div>
                           ))}
                           {tuning && <div className="p-4 text-xs text-purple-400 animate-pulse font-mono flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/> RE-ESCRIBIENDO ADN CORE...</div>}
                           <div ref={tunerEndRef} />
                        </div>
                    </ScrollArea>
                    <div className="p-6 bg-slate-900 border-t border-slate-800 shrink-0">
                        <div className="flex gap-3 max-w-4xl mx-auto items-end">
                           <Textarea value={tunerInput} onChange={e => setTunerInput(e.target.value)} placeholder="Instrucción al Ingeniero Maestro..." className="bg-slate-950 border-slate-700 min-h-[50px] max-h-40 resize-none py-3 text-sm focus-visible:ring-purple-500 shadow-inner" onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTune(); }}} />
                           <Button onClick={handleTune} disabled={tuning || !tunerInput.trim()} className="h-12 w-14 shrink-0 bg-purple-600 hover:bg-purple-700 shadow-lg"><Send className="w-5 h-5" /></Button>
                        </div>
                    </div>
                </Card>
            </TabsContent>

            <TabsContent value="debug" className="absolute inset-0 m-0 flex flex-col">
                <Card className="bg-slate-900 border-slate-800 shadow-2xl relative flex-1 flex flex-col overflow-hidden">
                    <div className="absolute top-4 right-6 z-10">
                       <Button onClick={handleRefreshMaster} variant="outline" className="h-9 text-[10px] border-indigo-500/50 text-indigo-400 bg-slate-950 hover:bg-indigo-500/20 font-bold" disabled={loadingMaster}>
                          {loadingMaster ? <Loader2 className="w-3 h-3 animate-spin mr-2"/> : <RefreshCcw className="w-3 h-3 mr-2"/>} RE-COMPILAR KERNEL
                       </Button>
                    </div>
                    <CardHeader className="shrink-0 py-4 bg-slate-950/20 border-b border-slate-800"><CardTitle className="text-[10px] text-slate-500 flex items-center gap-2 uppercase tracking-widest"><Terminal className="w-4 h-4" /> Ensamblaje Maestro Final</CardTitle></CardHeader>
                    <div className="flex-1 bg-black p-8 overflow-y-auto custom-scrollbar">
                       <pre className="text-[11px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed select-text">
                          {loadingMaster ? "Cargando constitución..." : masterPrompt || "Inicia el Kernel para ver el ADN final."}
                       </pre>
                    </div>
                </Card>
            </TabsContent>
          </div>
        </Tabs>

        <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
           <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-sm shadow-2xl">
              <div className="p-6 space-y-4">
                <h2 className="text-xl font-bold flex items-center gap-2"><GitBranch className="text-indigo-400"/> Crear Snapshot</h2>
                <Input value={snapshotName} onChange={e => setSnapshotName(e.target.value)} placeholder="Ej: Fix Venta CDMX" className="bg-slate-950 border-slate-800 h-11" />
                <Button onClick={handleSaveSnapshot} disabled={saving || !snapshotName} className="bg-indigo-600 w-full h-11 font-bold">
                    {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <ShieldCheck className="w-4 h-4 mr-2" />} Confirmar & Aplicar
                </Button>
              </div>
           </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AgentBrain;