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
  ArrowRight, Sparkles, AlertCircle, History, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';

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
  const [simResult, setSimResult] = useState<any[]>([]);
  const [simulating, setSimulating] = useState(false);
  const [simFinalResponse, setSimFinalResponse] = useState("");

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
      // Fallback si falla la edge function
      setMasterPrompt("Error conectando con el Kernel. Verifica tu conexión.");
    } finally {
      setLoadingMaster(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Save current config
      const promptsToSave = Object.entries(prompts).map(([key, value]) => ({
        key, value: value || '', category: 'PROMPT',
      }));
      const { error } = await supabase.from('app_config').upsert(promptsToSave, { onConflict: 'key' });
      if (error) throw error;
      
      // 2. Create Version Snapshot
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
    
    try {
      const snapshot = version.prompts_snapshot;
      if (snapshot) {
        setPrompts(snapshot);
        toast.success(`Versión ${version.version_name} cargada en el editor. Dale a "Guardar Todo" para aplicarla.`);
      }
    } catch (err) {
      toast.error("Error al restaurar versión.");
    }
  };

  const runSimulation = async () => {
     if (!simQuestion.trim()) return;
     setSimulating(true);
     setSimResult([]);
     setSimFinalResponse("");
     
     // Simulamos el paso por las 5 capas definidas en el Kernel
     const steps = [
        { layer: "LAYER 1: #CIA", status: "Buscando reglas correctivas...", delay: 800 },
        { layer: "LAYER 2: ADN CORE", status: "Inyectando personalidad Samurai...", delay: 1500 },
        { layer: "LAYER 3: VERDAD MAESTRA", status: "Consultando datos en theelephantbowl.com...", delay: 2200 },
        { layer: "LAYER 4: MEDIA CATALOG", status: "Buscando posters o promos relacionadas...", delay: 3000 },
        { layer: "LAYER 5: OJO DE HALCÓN", status: "Análisis financiero completado.", delay: 3800 }
     ];

     for (const step of steps) {
        await new Promise(r => setTimeout(r, 700)); // Delay visual
        setSimResult(prev => [...prev, step]);
     }

     // Simular respuesta final
     await new Promise(r => setTimeout(r, 500));
     
     // Respuesta Mock inteligente basada en keywords simples
     let mockResponse = "Hola, soy el Samurai. ¿En qué puedo ayudarte hoy?";
     const q = simQuestion.toLowerCase();
     
     if (q.includes('precio') || q.includes('costo')) {
        mockResponse = "El precio del taller Nivel 1 es de $3,500 MXN. Incluye un cuenco tibetano de regalo si reservas hoy. ¿Te interesa apartar tu lugar?";
     } else if (q.includes('donde') || q.includes('ubicacion')) {
        mockResponse = "Nos ubicamos en la Roma Norte, CDMX. También tenemos sedes en Querétaro y Monterrey. ¿De qué ciudad me escribes?";
     } else if (q.includes('hola') || q.includes('buenos dias')) {
        mockResponse = "¡Saludos! Hablas con el asistente virtual de The Elephant Bowl. Estoy aquí para guiarte en tu camino del sonido. ¿Buscas talleres o terapia?";
     }

     setSimFinalResponse(mockResponse);
     setSimulating(false);
     toast.success("Simulación de jerarquía completada");
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

        <div className="bg-red-600/10 border border-red-600/20 rounded-lg p-4 flex items-start gap-4">
           <div className="p-2 bg-red-600/20 rounded-lg"><ShieldCheck className="w-5 h-5 text-red-500" /></div>
           <div>
              <h4 className="text-sm font-bold text-white">Identidad Samurai Blindada v3.0</h4>
              <p className="text-xs text-slate-400 mt-1">El sistema ahora guarda un historial de versiones cada vez que aplicas cambios.</p>
           </div>
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
                      <History className="w-5 h-5 text-indigo-400" /> Historial de Cambios
                   </CardTitle>
                   <CardDescription>
                      Cada vez que guardas, se crea un punto de restauración.
                   </CardDescription>
                </CardHeader>
                <CardContent>
                   <Table>
                      <TableHeader>
                         <TableRow className="border-slate-800 bg-slate-950/50">
                            <TableHead className="text-slate-400">Versión</TableHead>
                            <TableHead className="text-slate-400">Fecha</TableHead>
                            <TableHead className="text-slate-400">Autor</TableHead>
                            <TableHead className="text-right text-slate-400">Acción</TableHead>
                         </TableRow>
                      </TableHeader>
                      <TableBody>
                         {loadingVersions ? (
                            <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="w-6 h-6 animate-spin mx-auto"/></TableCell></TableRow>
                         ) : versions.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center h-24 text-slate-500">No hay versiones guardadas aún.</TableCell></TableRow>
                         ) : (
                            versions.map((v) => (
                               <TableRow key={v.id} className="border-slate-800 hover:bg-slate-800/30">
                                  <TableCell className="font-mono text-indigo-400 font-bold">{v.version_name}</TableCell>
                                  <TableCell className="text-slate-400 text-xs">{new Date(v.created_at).toLocaleString()}</TableCell>
                                  <TableCell className="text-slate-300 text-xs">{v.created_by_name || 'System'}</TableCell>
                                  <TableCell className="text-right">
                                     <Button variant="outline" size="sm" className="h-7 text-xs border-slate-700 hover:bg-indigo-500/10 hover:text-indigo-400" onClick={() => handleRestoreVersion(v)}>
                                        <RotateCcw className="w-3 h-3 mr-2" /> Restaurar
                                     </Button>
                                  </TableCell>
                               </TableRow>
                            ))
                         )}
                      </TableBody>
                   </Table>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="simulador" className="animate-in fade-in-50">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="bg-slate-900 border-slate-800 h-fit">
                   <CardHeader>
                      <CardTitle className="text-sm text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-400" /> Prueba de Pensamiento</CardTitle>
                      <CardDescription>Envía una pregunta para ver cómo el Samurai procesa los 5 niveles jerárquicos.</CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <Textarea 
                        placeholder="Ej: ¿Qué talleres tienen en Marzo?" 
                        className="bg-slate-950 border-slate-800 h-32 text-sm focus:border-indigo-500"
                        value={simQuestion}
                        onChange={e => setSimQuestion(e.target.value)}
                        onKeyDown={e => {
                           if(e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              runSimulation();
                           }
                        }}
                      />
                      <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={runSimulation} disabled={simulating || !simQuestion}>
                         {simulating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                         Ejecutar Simulación
                      </Button>
                   </CardContent>
                </Card>

                <Card className="bg-slate-950 border-slate-800 flex flex-col min-h-[400px]">
                   <CardHeader className="border-b border-slate-800 bg-slate-900/50">
                      <CardTitle className="text-sm text-emerald-400 flex items-center gap-2">
                         <Terminal className="w-4 h-4" /> Traza de Ejecución
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="flex-1 p-4 overflow-y-auto">
                      {simResult.length === 0 && !simulating ? (
                         <div className="h-full flex flex-col items-center justify-center text-slate-700 italic text-sm gap-2">
                            <BrainCircuit className="w-10 h-10 opacity-20" />
                            <p>Esperando input...</p>
                         </div>
                      ) : (
                         <div className="space-y-6">
                            {simResult.map((step, i) => (
                               <div key={i} className="flex gap-4 animate-in slide-in-from-left-2 duration-300 items-start">
                                  <div className="flex flex-col items-center mt-1">
                                     <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                     {i !== simResult.length - 1 && <div className="w-0.5 h-full bg-slate-800 mt-1 min-h-[20px]" />}
                                  </div>
                                  <div>
                                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{step.layer}</p>
                                     <p className="text-xs text-slate-300 font-mono mt-1">{step.status}</p>
                                  </div>
                               </div>
                            ))}
                            
                            {simFinalResponse && (
                               <div className="mt-6 pt-6 border-t border-slate-800 animate-in zoom-in-95 duration-500">
                                  <p className="text-[10px] text-indigo-400 font-bold uppercase mb-2">Respuesta Generada:</p>
                                  <div className="bg-indigo-600/10 border border-indigo-500/30 p-4 rounded-lg rounded-tl-none text-sm text-indigo-100 leading-relaxed shadow-lg">
                                     {simFinalResponse}
                                  </div>
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
                      <EyeIcon className="w-5 h-5 text-red-600" /> Protocolo Ojo de Halcón
                   </CardTitle>
                   <CardDescription>
                      Espacio reservado para el módulo de **Visión Financiera**. 
                      Aquí configurarás cómo Samurai analiza tickets de OXXO, transferencias y recibos bancarios.
                   </CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="space-y-4">
                      <Label className="text-xs text-slate-500 uppercase tracking-widest font-bold">Instrucciones de Análisis de Pagos</Label>
                      <Textarea 
                        value={prompts['prompt_vision_instrucciones'] || ''} 
                        onChange={e => setPrompts({...prompts, prompt_vision_instrucciones: e.target.value})}
                        className="min-h-[300px] bg-slate-950 border-slate-800 font-mono text-xs focus:border-red-600"
                        placeholder="Ej: Si detectas un comprobante de BBVA, busca siempre el número de referencia de 7 dígitos..."
                      />
                      <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded text-[10px] text-blue-400 flex items-center gap-2">
                         <AlertCircle className="w-3 h-3" /> Este campo será procesado por el módulo de visión en la Fase 2.
                      </div>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="debug" className="animate-in fade-in-50">
             <Card className="bg-slate-900 border-slate-800 shadow-2xl relative min-h-[600px]">
                <div className="absolute top-4 right-4 z-10">
                   <Button onClick={handleRefreshMaster} variant="outline" className="bg-indigo-600/10 border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/20" disabled={loadingMaster}>
                      {loadingMaster ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <RefreshCcw className="w-4 h-4 mr-2"/>}
                      Refrescar Kernel
                   </Button>
                </div>
                <CardHeader>
                   <CardTitle className="text-sm text-indigo-400 flex items-center gap-2"><Layers className="w-4 h-4" /> Consciencia Consolidada (Kernel)</CardTitle>
                   <CardDescription>Este es el prompt final y crudo que recibe la IA después de procesar todas las capas.</CardDescription>
                </CardHeader>
                <CardContent className="h-full">
                   {loadingMaster ? (
                      <div className="h-[500px] flex items-center justify-center flex-col gap-4">
                         <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                         <p className="text-xs text-slate-500">Compilando capas del cerebro...</p>
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