import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Save, Bot, Eye, Zap, Loader2, Terminal, BrainCircuit, Target, GitBranch, User, RefreshCcw, Layers, ShieldCheck, Eye as EyeIcon, ArrowRight, Sparkles, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const AgentBrain = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'identidad';
  const { user, profile } = useAuth();
  
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Maestro Prompt State
  const [masterPrompt, setMasterPrompt] = useState("");
  const [loadingMaster, setLoadingMaster] = useState(false);

  // Simulator State
  const [simQuestion, setSimQuestion] = useState("");
  const [simResult, setSimResult] = useState<any[]>([]);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    fetchPrompts();
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
      // Carga inicial del prompt maestro
      handleRefreshMaster();
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshMaster = async () => {
    setLoadingMaster(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-samurai-context');
      if (error) throw error;
      setMasterPrompt(data.system_prompt || "No se pudo generar el prompt maestro.");
    } catch (err: any) {
      console.error("Error fetching master prompt:", err);
      toast.error("Error al conectar con el Kernel");
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
      
      toast.success('Cerebro sincronizado correctamente.');
      handleRefreshMaster();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const runSimulation = async () => {
     if (!simQuestion.trim()) return;
     setSimulating(true);
     setSimResult([]);
     
     // Simulamos el paso por las 5 capas definidas en el Kernel
     const steps = [
        { layer: "LAYER 1: #CIA", status: "Buscando reglas correctivas...", delay: 600 },
        { layer: "LAYER 2: ADN CORE", status: "Inyectando personalidad Samurai...", delay: 1200 },
        { layer: "LAYER 3: VERDAD MAESTRA", status: "Consultando datos en theelephantbowl.com...", delay: 1800 },
        { layer: "LAYER 4: MEDIA CATALOG", status: "Buscando posters o promos relacionadas...", delay: 2400 },
        { layer: "LAYER 5: OJO DE HALCÓN", status: "Protocolo de visión financiera en espera...", delay: 3000 }
     ];

     for (const step of steps) {
        await new Promise(r => setTimeout(r, 600));
        setSimResult(prev => [...prev, step]);
     }
     
     setSimulating(false);
     toast.success("Simulación de jerarquía completada");
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
               <BrainCircuit className="w-8 h-8 text-red-600" /> Cerebro del Samurai
            </h1>
            <p className="text-slate-400">Control maestro de la lógica, visión y jerarquía de la IA.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 px-8 font-bold shadow-lg shadow-red-900/20">
             {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
             GUARDAR TODO
          </Button>
        </div>

        <div className="bg-red-600/10 border border-red-600/20 rounded-lg p-4 flex items-start gap-4">
           <div className="p-2 bg-red-600/20 rounded-lg"><ShieldCheck className="w-5 h-5 text-red-500" /></div>
           <div>
              <h4 className="text-sm font-bold text-white">Identidad Samurai Blindada v3.0</h4>
              <p className="text-xs text-slate-400 mt-1">El sistema ahora orquesta automáticamente la Verdad Maestra y Reglas #CIA para evitar alucinaciones en el chat.</p>
           </div>
        </div>

        <Tabs value={initialTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-6 flex-wrap h-auto">
             <TabsTrigger value="identidad">1. Identidad Core</TabsTrigger>
             <TabsTrigger value="simulador">2. Simulador de Jerarquía</TabsTrigger>
             <TabsTrigger value="ojo_halcon">3. Ojo de Halcón</TabsTrigger>
             <TabsTrigger value="debug">4. Ver Prompt Maestro</TabsTrigger>
          </TabsList>

          <TabsContent value="identidad" className="space-y-6">
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

          <TabsContent value="simulador">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="bg-slate-900 border-slate-800">
                   <CardHeader>
                      <CardTitle className="text-sm text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-400" /> Prueba de Pensamiento</CardTitle>
                      <CardDescription>Envía una pregunta para ver cómo el Samurai usa los 5 niveles jerárquicos.</CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <Textarea 
                        placeholder="Ej: ¿Qué talleres tienen en Marzo?" 
                        className="bg-slate-950 border-slate-800 h-32 text-sm"
                        value={simQuestion}
                        onChange={e => setSimQuestion(e.target.value)}
                      />
                      <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={runSimulation} disabled={simulating || !simQuestion}>
                         {simulating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                         Ejecutar Simulación
                      </Button>
                   </CardContent>
                </Card>

                <Card className="bg-slate-950 border-slate-800 flex flex-col">
                   <CardHeader className="border-b border-slate-800">
                      <CardTitle className="text-sm text-emerald-400">Respuesta del Sistema</CardTitle>
                   </CardHeader>
                   <CardContent className="flex-1 p-4">
                      {simResult.length === 0 ? (
                         <div className="h-full flex items-center justify-center text-slate-700 italic text-sm">
                            Ingresa una pregunta a la izquierda para iniciar la simulación.
                         </div>
                      ) : (
                         <div className="space-y-4">
                            {simResult.map((step, i) => (
                               <div key={i} className="flex gap-3 animate-in slide-in-from-left-2 duration-300">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                  <div>
                                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{step.layer}</p>
                                     <p className="text-xs text-slate-300">{step.status}</p>
                                  </div>
                               </div>
                            ))}
                         </div>
                      )}
                   </CardContent>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="ojo_halcon">
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
                        placeholder="Pendiente de implementación: Aquí irán las reglas para validar montos, bancos y referencias..."
                      />
                      <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded text-[10px] text-blue-400 flex items-center gap-2">
                         <AlertCircle className="w-3 h-3" /> Este campo será procesado por el módulo de visión en la Fase 2.
                      </div>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="debug">
             <Card className="bg-slate-950 border-slate-800 shadow-2xl relative min-h-[600px]">
                <div className="absolute top-4 right-4 z-10">
                   <Button onClick={handleRefreshMaster} variant="outline" className="bg-indigo-600/10 border-indigo-500/50 text-indigo-400" disabled={loadingMaster}>
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
                      <div className="h-[500px] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>
                   ) : (
                      <ScrollArea className="h-[500px] rounded-xl border border-slate-800 p-6 bg-black shadow-inner">
                         <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">
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
  <Card className="bg-slate-900 border-slate-800 h-full">
    <CardHeader className="pb-3 border-b border-slate-800/50">
       <CardTitle className="text-sm text-white flex items-center gap-2"><Icon className="w-4 h-4 text-red-500"/> {title}</CardTitle>
    </CardHeader>
    <CardContent className="pt-4"><Textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="min-h-[350px] bg-slate-950 border-slate-800 font-mono text-xs" /></CardContent>
  </Card>
);

const Label = ({ children, className }: { children: React.ReactNode, className?: string }) => (
   <label className={`block text-sm font-medium leading-none ${className}`}>{children}</label>
);

export default AgentBrain;