import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Save, Bot, Eye, Zap, Loader2, Terminal, BrainCircuit, Target, 
  GitBranch, User, RefreshCcw, Layers, ShieldCheck, Eye as EyeIcon, 
  ArrowRight, Sparkles, AlertCircle, History, RotateCcw, Quote, Fingerprint, Image
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const AgentBrain = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'identidad';
  const { user, profile } = useAuth();
  
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [versions, setVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [masterPrompt, setMasterPrompt] = useState("");
  const [loadingMaster, setLoadingMaster] = useState(false);

  // Simulation State
  const [simQuestion, setSimQuestion] = useState("");
  const [simSteps, setSimSteps] = useState<any[]>([]);
  const [simulating, setSimulating] = useState(false);
  const [simFinalResponse, setSimFinalResponse] = useState("");
  const [simExplanation, setSimExplanation] = useState<any>(null);

  useEffect(() => {
    fetchPrompts();
    fetchVersions();
  }, []);

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
    const { data } = await supabase.from('prompt_versions').select('*').order('created_at', { ascending: false }).limit(15);
    if (data) setVersions(data);
    setLoadingVersions(false);
  };

  const handleRefreshMaster = async () => {
    setLoadingMaster(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-samurai-context');
      if (error) throw error;
      setMasterPrompt(data.system_prompt || "Kernel vacío.");
    } finally {
      setLoadingMaster(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const promptsToSave = Object.entries(prompts).map(([key, value]) => ({
        key, value: value || '', category: 'PROMPT',
      }));
      await supabase.from('app_config').upsert(promptsToSave, { onConflict: 'key' });
      
      await supabase.from('prompt_versions').insert({
        version_name: `v${new Date().toISOString().split('T')[0]}-${Math.floor(Math.random()*100)}`,
        prompts_snapshot: prompts,
        created_by_name: profile?.username || 'Admin',
        notes: 'Snapshot Manual - Core Config'
      });

      toast.success('Jerarquía sincronizada.');
      handleRefreshMaster();
      fetchVersions();
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreVersion = async (version: any) => {
    if (!confirm(`¿Restaurar la versión ${version.version_name}?`)) return;
    setPrompts(version.prompts_snapshot);
    toast.info("Versión cargada. Dale a 'GUARDAR SNAPSHOT' para aplicar.");
  };

  const runSimulation = async () => {
     if (!simQuestion.trim()) return;
     setSimulating(true);
     setSimSteps([]);
     setSimFinalResponse("");
     setSimExplanation(null);
     
     try {
        // Simulación visual de pasos tácticos
        const visualSteps = [
            { icon: Fingerprint, phase: "PHASE 1: DATA HUNTING", status: "Validando Nombre/Ciudad para Meta CAPI...", color: "text-indigo-400" },
            { icon: Image, phase: "PHASE 2: SEDUCTION", status: "Buscando Posters relevantes en Media Manager...", color: "text-emerald-400" },
            { icon: Target, phase: "PHASE 3: CLOSING", status: "Inyectando Protocolo de Reserva ($1500 MXN)...", color: "text-red-500" },
            { icon: BrainCircuit, phase: "KERNEL AUDIT", status: "Filtrando por Capa 1 (#CIA) y Capa 3 (Web Content)...", color: "text-slate-400" }
        ];

        for (const step of visualSteps) {
           setSimSteps(prev => [...prev, step]);
           await new Promise(r => setTimeout(r, 700));
        }

        const { data, error } = await supabase.functions.invoke('simulate-samurai', { body: { question: simQuestion } });
        if (error) throw error;

        setSimFinalResponse(data.answer);
        setSimExplanation(data.explanation);
        toast.success("Simulación completada.");

     } catch (err: any) {
        toast.error("Error: " + err.message);
     } finally {
        setSimulating(false);
     }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
               <BrainCircuit className="w-8 h-8 text-indigo-500" /> Jerarquía de Consciencia
            </h1>
            <p className="text-slate-400 text-sm">Control maestro de las 5 Capas del Samurai.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 font-bold px-8 shadow-xl">
             {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
             GUARDAR SNAPSHOT
          </Button>
        </div>

        <Tabs value={initialTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-6 flex-wrap h-auto w-full justify-start">
             <TabsTrigger value="identidad" className="gap-2"><User className="w-4 h-4"/> 1. ADN Identidad</TabsTrigger>
             <TabsTrigger value="versiones" className="gap-2"><GitBranch className="w-4 h-4"/> 2. Historial Snapshots</TabsTrigger>
             <TabsTrigger value="simulador" className="gap-2"><Zap className="w-4 h-4"/> 3. Simulador de 3 Fases</TabsTrigger>
             <TabsTrigger value="ojo_halcon" className="gap-2"><EyeIcon className="w-4 h-4"/> 4. Ojo de Halcón</TabsTrigger>
             <TabsTrigger value="debug" className="gap-2"><Terminal className="w-4 h-4"/> 5. Kernel Debug</TabsTrigger>
          </TabsList>

          <TabsContent value="identidad" className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in-50">
             <PromptCard title="ADN CORE (PERSONALIDAD)" icon={Bot} value={prompts['prompt_adn_core']} onChange={(v:string) => setPrompts({...prompts, prompt_adn_core: v})} placeholder="Identidad base..." />
             <PromptCard title="ESTRATEGIA DE CIERRE" icon={Target} value={prompts['prompt_estrategia_cierre']} onChange={(v:string) => setPrompts({...prompts, prompt_estrategia_cierre: v})} placeholder="Lógica de venta..." />
          </TabsContent>

          <TabsContent value="versiones" className="animate-in fade-in-50">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><History className="w-5 h-5 text-indigo-400" /> Puntos de Restauración</CardTitle></CardHeader>
                <CardContent>
                   <Table>
                      <TableHeader><TableRow className="border-slate-800"><TableHead>Snapshot</TableHead><TableHead>Fecha</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader>
                      <TableBody>
                         {loadingVersions ? <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow> : 
                          versions.map(v => (
                            <TableRow key={v.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                               <TableCell className="font-mono text-indigo-400 text-xs">{v.version_name}</TableCell>
                               <TableCell className="text-slate-500 text-xs">{new Date(v.created_at).toLocaleString()}</TableCell>
                               <TableCell className="text-right"><Button variant="outline" size="sm" className="h-7 text-[10px] border-slate-700" onClick={() => handleRestoreVersion(v)}><RotateCcw className="w-3 h-3 mr-1" /> RESTAURAR</Button></TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                   </Table>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="simulador" className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in-50">
             <div className="lg:col-span-5 space-y-4">
                <Card className="bg-slate-900 border-slate-800">
                   <CardHeader><CardTitle className="text-sm text-white">Auditoría de Protocolo</CardTitle><CardDescription>Pon a prueba el flujo: Datos {"->"} Seducción {"->"} Cierre.</CardDescription></CardHeader>
                   <CardContent className="space-y-4">
                      <Textarea placeholder="Ej: Hola, me interesa el taller de cuencos." className="bg-slate-950 border-slate-800 h-32 focus:border-indigo-500" value={simQuestion} onChange={e => setSimQuestion(e.target.value)} />
                      <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={runSimulation} disabled={simulating || !simQuestion}>
                         {simulating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />} PROCESAR EN PROTOCOLO
                      </Button>
                   </CardContent>
                </Card>
                <div className="bg-indigo-900/10 border border-indigo-500/20 p-4 rounded-xl flex items-start gap-3">
                   <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
                   <p className="text-[10px] text-indigo-300 italic">El simulador usa el Kernel real. Si Samurai no pide el nombre al inicio, corrígelo en la Capa 0 o 1.</p>
                </div>
             </div>

             <Card className="lg:col-span-7 bg-slate-950 border-slate-800 flex flex-col min-h-[500px]">
                <CardHeader className="border-b border-slate-800 bg-slate-900/50 py-3"><CardTitle className="text-[10px] uppercase text-emerald-400 tracking-widest flex items-center gap-2"><Terminal className="w-3.5 h-3.5" /> Traza de Pensamiento Estratégico</CardTitle></CardHeader>
                <CardContent className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                   {simSteps.length === 0 && !simulating ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-3 opacity-20"><BrainCircuit className="w-16 h-16" /><p className="text-sm font-bold uppercase tracking-widest">System Idle</p></div>
                   ) : (
                      <div className="space-y-6">
                         {simSteps.map((step, i) => (
                            <div key={i} className="flex gap-4 animate-in slide-in-from-left-2 duration-300">
                               <div className="flex flex-col items-center mt-1">
                                  <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] bg-emerald-500")} />
                                  <div className="w-0.5 h-full bg-slate-800 mt-1 min-h-[20px]" />
                               </div>
                               <div>
                                  <p className={cn("text-[9px] font-bold uppercase tracking-widest mb-0.5", step.color)}>{step.phase}</p>
                                  <p className="text-xs text-slate-300 font-mono">{step.status}</p>
                               </div>
                            </div>
                         ))}
                         {simFinalResponse && (
                            <div className="mt-8 animate-in zoom-in-95 duration-500 space-y-4">
                               <div className="bg-indigo-600/10 border border-indigo-500/30 p-5 rounded-2xl text-sm text-slate-200 leading-relaxed shadow-2xl relative">
                                  <Quote className="absolute -top-3 -left-2 w-8 h-8 text-indigo-500/20" />
                                  {simFinalResponse}
                               </div>
                               {simExplanation && (
                                  <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
                                     <div className="flex flex-wrap gap-2">{simExplanation.layers_used.map((l:string) => (<Badge key={l} variant="outline" className="text-[9px] border-indigo-500/40 text-indigo-400 uppercase tracking-tighter">{l}</Badge>))}</div>
                                     <p className="text-[10px] text-slate-500 italic font-mono leading-relaxed">"Reasoning: {simExplanation.reasoning}"</p>
                                  </div>
                               )}
                            </div>
                         )}
                      </div>
                   )}
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="ojo_halcon" className="animate-in fade-in-50">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-red-600 shadow-2xl">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><EyeIcon className="w-5 h-5 text-red-600" /> Capa 5: Ojo de Halcón (Visión AI)</CardTitle><CardDescription>Protocolos para auditar fotos de comprobantes bancarios.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                   <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Reglas de Validación Visual</Label>
                   <Textarea value={prompts['prompt_vision_instrucciones'] || ''} onChange={e => setPrompts({...prompts, prompt_vision_instrucciones: e.target.value})} className="min-h-[350px] bg-slate-950 border-slate-800 font-mono text-xs focus:border-red-600 leading-relaxed" placeholder="Instrucciones para validar tickets de OXXO, SPEI..." />
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="debug" className="animate-in fade-in-50">
             <Card className="bg-slate-900 border-slate-800 shadow-2xl relative">
                <div className="absolute top-4 right-4 z-10"><Button onClick={handleRefreshMaster} variant="outline" className="h-8 border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/20" disabled={loadingMaster}>{loadingMaster ? <Loader2 className="w-3 h-3 animate-spin mr-2"/> : <RefreshCcw className="w-3 h-3 mr-2"/>} RE-COMPILAR KERNEL</Button></div>
                <CardHeader><CardTitle className="text-[10px] text-indigo-400 flex items-center gap-2 uppercase tracking-widest"><Layers className="w-4 h-4" /> Kernel Consolidado (Raw Prompt)</CardTitle></CardHeader>
                <CardContent className="h-full">
                   {loadingMaster ? <div className="h-[400px] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div> : 
                    <ScrollArea className="h-[500px] rounded-xl border border-slate-800 p-6 bg-black shadow-inner">
                       <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed select-text">{masterPrompt}</pre>
                    </ScrollArea>}
                </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

const PromptCard = ({ title, icon: Icon, value, onChange, placeholder }: any) => (
  <Card className="bg-slate-900 border-slate-800 h-full hover:border-indigo-500/30 transition-colors shadow-lg">
    <CardHeader className="pb-3 border-b border-slate-800/50 bg-slate-950/30"><CardTitle className="text-xs text-white flex items-center gap-2 uppercase tracking-widest"><Icon className="w-4 h-4 text-indigo-500"/> {title}</CardTitle></CardHeader>
    <CardContent className="pt-4"><Textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="min-h-[400px] bg-slate-950 border-slate-800 font-mono text-xs focus:border-indigo-500 leading-relaxed" /></CardContent>
  </Card>
);

const Label = ({ children, className }: { children: React.ReactNode, className?: string }) => (<label className={`block text-sm font-medium leading-none ${className}`}>{children}</label>);

export default AgentBrain;