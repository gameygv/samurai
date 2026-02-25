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
  ArrowRight, Sparkles, AlertCircle, History, RotateCcw, Quote
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
  
  // Versions State
  const [versions, setVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  
  // Maestro Prompt State
  const [masterPrompt, setMasterPrompt] = useState("");
  const [loadingMaster, setLoadingMaster] = useState(false);

  // Simulator State
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
    const { data } = await supabase
      .from('prompt_versions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setVersions(data);
    setLoadingVersions(false);
  };

  const handleRefreshMaster = async () => {
    setLoadingMaster(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-samurai-context');
      if (error) throw error;
      setMasterPrompt(data.system_prompt || "No se pudo generar el prompt maestro.");
    } catch (err: any) {
      console.error("Error fetching master prompt:", err);
      setMasterPrompt("Error conectando con el Kernel. Verifica tu conexión.");
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
      const { error } = await supabase.from('app_config').upsert(promptsToSave, { onConflict: 'key' });
      if (error) throw error;
      
      const versionName = `v${new Date().toISOString().split('T')[0]}-${Math.floor(Math.random()*1000)}`;
      await supabase.from('prompt_versions').insert({
        version_name: versionName,
        prompts_snapshot: prompts,
        created_by_name: profile?.username || 'Admin',
        notes: 'Guardado manual desde Cerebro Core'
      });

      toast.success('Cerebro sincronizado y versión guardada.');
      handleRefreshMaster();
      fetchVersions();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreVersion = async (version: any) => {
    if (!confirm(`¿Restaurar la versión ${version.version_name}? Se perderán los cambios no guardados actuales.`)) return;
    setPrompts(version.prompts_snapshot);
    toast.success(`Versión ${version.version_name} cargada. Pulsa "GUARDAR SNAPSHOT" para aplicar.`);
  };

  const runSimulation = async () => {
     if (!simQuestion.trim()) return;
     setSimulating(true);
     setSimSteps([]);
     setSimFinalResponse("");
     setSimExplanation(null);
     
     try {
        // Visual steps for the simulator
        const fakeSteps = [
            { layer: "LAYER 1: #CIA", status: "Buscando reglas correctivas...", delay: 600 },
            { layer: "LAYER 2: ADN CORE", status: "Inyectando personalidad...", delay: 1200 },
            { layer: "LAYER 3: VERDAD MAESTRA", status: "Consultando theelephantbowl.com...", delay: 1800 },
            { layer: "LAYER 4: MEDIA CATALOG", status: "Buscando triggers visuales...", delay: 2400 }
        ];

        for (const step of fakeSteps) {
           await new Promise(r => setTimeout(r, 600));
           setSimSteps(prev => [...prev, step]);
        }

        // Real AI call
        const { data, error } = await supabase.functions.invoke('simulate-samurai', {
           body: { question: simQuestion }
        });

        if (error) throw error;

        setSimFinalResponse(data.answer);
        setSimExplanation(data.explanation);
        toast.success("Cerebro simulado con éxito");

     } catch (err: any) {
        toast.error("Error en simulación: " + err.message);
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
               <BrainCircuit className="w-8 h-8 text-red-600" /> Cerebro del Samurai
            </h1>
            <p className="text-slate-400">Control maestro de la lógica, visión y jerarquía de la IA.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 px-8 font-bold shadow-lg shadow-red-900/20">
             {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
             GUARDAR SNAPSHOT
          </Button>
        </div>

        <Tabs value={initialTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-6 flex-wrap h-auto w-full justify-start">
             <TabsTrigger value="identidad" className="gap-2"><User className="w-4 h-4"/> 1. Identidad Core</TabsTrigger>
             <TabsTrigger value="versiones" className="gap-2"><GitBranch className="w-4 h-4"/> 2. Control de Versiones</TabsTrigger>
             <TabsTrigger value="simulador" className="gap-2"><Zap className="w-4 h-4"/> 3. Simulador</TabsTrigger>
             <TabsTrigger value="ojo_halcon" className="gap-2"><EyeIcon className="w-4 h-4"/> 4. Ojo de Halcón</TabsTrigger>
             <TabsTrigger value="debug" className="gap-2"><Terminal className="w-4 h-4"/> 5. Kernel Debug</TabsTrigger>
          </TabsList>

          <TabsContent value="identidad" className="space-y-6 animate-in fade-in-50">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PromptCard 
                    title="ADN CORE (PERSONALIDAD)" 
                    icon={Bot} 
                    value={prompts['prompt_adn_core']} 
                    onChange={(v:string) => setPrompts({...prompts, prompt_adn_core: v})} 
                    placeholder="Describe quién es Samurai..."
                />
                <PromptCard 
                    title="ESTRATEGIA DE CIERRE" 
                    icon={Target} 
                    value={prompts['prompt_estrategia_cierre']} 
                    onChange={(v:string) => setPrompts({...prompts, prompt_estrategia_cierre: v})} 
                    placeholder="Instrucciones tácticas para vender..."
                />
             </div>
          </TabsContent>

          <TabsContent value="versiones" className="animate-in fade-in-50">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2">
                      <History className="w-5 h-5 text-indigo-400" /> Historial de Snapshots
                   </CardTitle>
                   <CardDescription>
                      Cada guardado manual crea un punto de restauración del sistema.
                   </CardDescription>
                </CardHeader>
                <CardContent>
                   <Table>
                      <TableHeader>
                         <TableRow className="border-slate-800 bg-slate-950/50">
                            <TableHead className="text-slate-400">Snapshot ID</TableHead>
                            <TableHead className="text-slate-400">Fecha de Registro</TableHead>
                            <TableHead className="text-slate-400 text-right">Acción</TableHead>
                         </TableRow>
                      </TableHeader>
                      <TableBody>
                         {loadingVersions ? (
                            <TableRow><TableCell colSpan={3} className="text-center h-24"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500"/></TableCell></TableRow>
                         ) : versions.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center h-24 text-slate-500">Sin snapshots previos.</TableCell></TableRow>
                         ) : versions.map((v) => (
                           <TableRow key={v.id} className="border-slate-800 hover:bg-slate-800/30">
                              <TableCell className="font-mono text-indigo-400 font-bold">{v.version_name}</TableCell>
                              <TableCell className="text-slate-400 text-xs">{new Date(v.created_at).toLocaleString()}</TableCell>
                              <TableCell className="text-right">
                                 <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold border-slate-700 hover:bg-indigo-600 hover:text-white" onClick={() => handleRestoreVersion(v)}>
                                    <RotateCcw className="w-3 h-3 mr-1" /> RESTAURAR
                                 </Button>
                              </TableCell>
                           </TableRow>
                         ))}
                      </TableBody>
                   </Table>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="simulador" className="animate-in fade-in-50">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="bg-slate-900 border-slate-800 h-fit">
                   <CardHeader>
                      <CardTitle className="text-sm text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-400" /> Simulador de Consciencia</CardTitle>
                      <CardDescription>Envía una consulta para ver cómo Samurai responde usando su Kernel completo.</CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <Textarea 
                        placeholder="Ej: Hola, ¿cuánto cuesta el taller de cuencos y cuándo es el próximo?" 
                        className="bg-slate-950 border-slate-800 h-32 text-sm focus:border-indigo-500"
                        value={simQuestion}
                        onChange={e => setSimQuestion(e.target.value)}
                      />
                      <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={runSimulation} disabled={simulating || !simQuestion}>
                         {simulating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                         PROCESAR EN KERNEL
                      </Button>
                   </CardContent>
                </Card>

                <Card className="bg-slate-950 border-slate-800 flex flex-col min-h-[500px] overflow-hidden">
                   <CardHeader className="border-b border-slate-800 bg-slate-900/50">
                      <CardTitle className="text-xs text-emerald-400 flex items-center gap-2 uppercase tracking-widest">
                         <Terminal className="w-4 h-4" /> Traza de Pensamiento
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                      {simSteps.length === 0 && !simulating ? (
                         <div className="h-full flex flex-col items-center justify-center text-slate-700 italic text-sm gap-2">
                            <BrainCircuit className="w-10 h-10 opacity-20" />
                            <p>Esperando señal del simulador...</p>
                         </div>
                      ) : (
                         <div className="space-y-6">
                            {simSteps.map((step, i) => (
                               <div key={i} className="flex gap-4 animate-in slide-in-from-left-2 duration-300 items-start">
                                  <div className="flex flex-col items-center mt-1">
                                     <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                     <div className="w-0.5 h-full bg-slate-800 mt-1 min-h-[20px]" />
                                  </div>
                                  <div>
                                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{step.layer}</p>
                                     <p className="text-xs text-slate-300 font-mono mt-0.5">{step.status}</p>
                                  </div>
                               </div>
                            ))}
                            
                            {simFinalResponse && (
                               <div className="mt-4 animate-in zoom-in-95 duration-500">
                                  <div className="flex items-center gap-2 mb-3">
                                     <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                     <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">SAMURAI_CORE_OUTPUT</p>
                                  </div>
                                  <div className="bg-indigo-600/10 border border-indigo-500/30 p-4 rounded-xl text-sm text-slate-200 leading-relaxed shadow-lg relative">
                                     <Quote className="absolute -top-2 -left-2 w-6 h-6 text-indigo-500/20" />
                                     {simFinalResponse}
                                  </div>
                                  
                                  {simExplanation && (
                                     <div className="mt-4 p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                                        <div className="flex flex-wrap gap-2">
                                           {simExplanation.layers_used.map((l:string) => (
                                              <Badge key={l} variant="outline" className="text-[9px] border-indigo-500/50 text-indigo-400 bg-indigo-500/5">{l}</Badge>
                                           ))}
                                        </div>
                                        <p className="text-[10px] text-slate-500 italic">"Razonamiento: {simExplanation.reasoning}"</p>
                                     </div>
                                  )}
                               </div>
                            )}
                         </div>
                      )}
                   </CardContent>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="ojo_halcon" className="animate-in fade-in-50">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-red-600">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2">
                      <EyeIcon className="w-5 h-5 text-red-600" /> Ojo de Halcón (Visión AI)
                   </CardTitle>
                   <CardDescription>
                      Instrucciones para que Samurai analice imágenes de tickets, transferencias y comprobantes de pago.
                   </CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="space-y-4">
                      <Label className="text-xs text-slate-500 uppercase tracking-widest font-bold">Instrucciones de Auditoría Visual</Label>
                      <Textarea 
                        value={prompts['prompt_vision_instrucciones'] || ''} 
                        onChange={e => setPrompts({...prompts, prompt_vision_instrucciones: e.target.value})}
                        className="min-h-[300px] bg-slate-950 border-slate-800 font-mono text-xs focus:border-red-600"
                        placeholder="Ej: Si detectas un ticket de OXXO, extrae el número de referencia y el monto. Valida que el logo sea el oficial..."
                      />
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="debug" className="animate-in fade-in-50">
             <Card className="bg-slate-900 border-slate-800 shadow-2xl relative min-h-[600px]">
                <div className="absolute top-4 right-4 z-10">
                   <Button onClick={handleRefreshMaster} variant="outline" className="h-8 border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/20" disabled={loadingMaster}>
                      {loadingMaster ? <Loader2 className="w-3 h-3 animate-spin mr-2"/> : <RefreshCcw className="w-3 h-3 mr-2"/>}
                      RE-COMPILAR KERNEL
                   </Button>
                </div>
                <CardHeader>
                   <CardTitle className="text-sm text-indigo-400 flex items-center gap-2 uppercase tracking-widest"><Layers className="w-4 h-4" /> Kernel Consolidado</CardTitle>
                   <CardDescription>Este es el prompt final que recibe el modelo tras unir las 5 capas de consciencia.</CardDescription>
                </CardHeader>
                <CardContent className="h-full">
                   {loadingMaster ? (
                      <div className="h-[500px] flex items-center justify-center flex-col gap-4">
                         <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                         <p className="text-xs text-slate-500 italic">Compilando jerarquía Samurai...</p>
                      </div>
                   ) : (
                      <ScrollArea className="h-[500px] rounded-xl border border-slate-800 p-6 bg-black shadow-inner">
                         <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed select-text">
                            {masterPrompt}
                         </pre>
                      </ScrollArea>
                   )}
                </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

const PromptCard = ({ title, icon: Icon, value, onChange, placeholder }: any) => (
  <Card className="bg-slate-900 border-slate-800 h-full hover:border-indigo-500/30 transition-colors">
    <CardHeader className="pb-3 border-b border-slate-800/50 bg-slate-950/30">
       <CardTitle className="text-sm text-white flex items-center gap-2"><Icon className="w-4 h-4 text-red-500"/> {title}</CardTitle>
    </CardHeader>
    <CardContent className="pt-4"><Textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="min-h-[350px] bg-slate-950 border-slate-800 font-mono text-xs focus:border-indigo-500" /></CardContent>
  </Card>
);

const Label = ({ children, className }: { children: React.ReactNode, className?: string }) => (
   <label className={`block text-sm font-medium leading-none ${className}`}>{children}</label>
);

export default AgentBrain;