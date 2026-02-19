import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Save, Bot, Eye, Database, History, MessageSquare, 
  CheckCheck, Zap, Loader2, FileText, Send, ShoppingCart, Scan, Terminal, FlaskConical, Image as ImageIcon, Search, ArrowRight, BrainCircuit
} from 'lucide-react';
import { toast } from 'sonner';

const DEFAULTS = {
  'prompt_adn_core': '# ADN CORE\nEres Samurai, el cerrador de ventas de elite de The Elephant Bowl.',
  'prompt_protocolos': '# PROTOCOLOS\nReglas de conducta y comunicación.',
  'prompt_estrATEGIA_cierre': '# ESTRATEGIA DE CIERRE\nReglas para manejar objeciones y cerrar ventas.',
  'prompt_vision_instrucciones': '# OJO DE HALCÓN (VISIÓN)\nInstrucciones para analizar posters y comprobantes de pago.',
};

const AgentBrain = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'identidad';
  
  const [prompts, setPrompts] = useState<Record<string, string>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Simulation State
  const [testing, setTesting] = useState(false);
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [foundContext, setFoundContext] = useState<any[]>([]);
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('app_config').select('key, value').eq('category', 'PROMPT');
      if (!error && data && data.length > 0) {
        const dbPrompts = { ...DEFAULTS };
        data.forEach((item: any) => { dbPrompts[item.key as keyof typeof DEFAULTS] = item.value; });
        setPrompts(dbPrompts);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(prompts).map(([key, value]) => ({
        key, value, category: 'PROMPT', updated_at: new Date().toISOString()
      }));
      const { error } = await supabase.from('app_config').upsert(updates);
      if (error) throw error;
      toast.success('Cerebro del Samurai actualizado con éxito.');
    } catch (err: any) {
      toast.error('Fallo al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRunSimulation = async () => {
    if (!testInput) return toast.warning("Ingresa un mensaje de prueba.");
    setTesting(true);
    setFoundContext([]);
    
    try {
        // 1. Simular búsqueda de conocimiento (RAG simulado)
        const [docsRes, webRes] = await Promise.all([
           supabase.from('knowledge_documents').select('title, content').ilike('content', `%${testInput.split(' ')[0]}%`).limit(2),
           supabase.from('main_website_content').select('title, content').ilike('content', `%${testInput.split(' ')[0]}%`).limit(2)
        ]);

        const combinedContext = [...(docsRes.data || []), ...(webRes.data || [])];
        setFoundContext(combinedContext);

        // 2. Ejecutar Simulación IA
        const { data, error } = await supabase.functions.invoke('get-samurai-context', {
            body: { 
               message: testInput, 
               simulate_reply: true, 
               custom_adn: prompts['prompt_adn_core'],
               context: combinedContext.map(c => `[${c.title}]: ${c.content?.substring(0, 100)}...`).join('\n')
            }
        });
        
        if (error) throw error;
        setTestOutput(data?.reply || "No se generó respuesta.");
        
    } catch (err: any) {
        toast.error('Error en simulación: ' + err.message);
    } finally {
        setTesting(false);
    }
  };

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-indigo-500 w-10 h-10" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Cerebro del Samurai</h1>
            <p className="text-slate-400">Control maestro de la lógica y visión de la IA.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 px-8 shadow-lg shadow-red-900/20">
             {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
             Guardar Configuración
          </Button>
        </div>

        <Tabs value={initialTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-6 flex-wrap h-auto">
             <TabsTrigger value="identidad" className="data-[state=active]:bg-red-600">1. Identidad</TabsTrigger>
             <TabsTrigger value="ventas" className="data-[state=active]:bg-indigo-600">2. Ventas</TabsTrigger>
             <TabsTrigger value="ojo-de-halcon" className="data-[state=active]:bg-blue-600">3. Ojo de Halcón</TabsTrigger>
             <TabsTrigger value="simulador" className="data-[state=active]:bg-indigo-600">4. Simulador de Respuesta</TabsTrigger>
          </TabsList>

          <TabsContent value="identidad" className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PromptCard title="ADN CORE" icon={Bot} value={prompts['prompt_adn_core']} onChange={(v:string) => setPrompts({...prompts, prompt_adn_core: v})} />
                <PromptCard title="PROTOCOLOS" icon={FileText} value={prompts['prompt_protocolos']} onChange={(v:string) => setPrompts({...prompts, prompt_protocolos: v})} />
             </div>
          </TabsContent>

          <TabsContent value="ventas" className="space-y-6">
             <PromptCard title="ESTRATEGIA DE CIERRE" icon={ShoppingCart} value={prompts['prompt_estrategia_cierre']} onChange={(v:string) => setPrompts({...prompts, prompt_estrategia_cierre: v})} />
          </TabsContent>

          <TabsContent value="ojo-de-halcon" className="space-y-6">
             <PromptCard title="INSTRUCCIONES DE VISIÓN" icon={Scan} value={prompts['prompt_vision_instrucciones']} onChange={(v:string) => setPrompts({...prompts, prompt_vision_instrucciones: v})} />
          </TabsContent>

          <TabsContent value="simulador" className="space-y-6">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-6">
                   <Card className="bg-slate-900 border-slate-800 h-fit">
                      <CardHeader>
                         <CardTitle className="text-sm text-white flex items-center gap-2">
                            <FlaskConical className="w-4 h-4 text-indigo-400"/> Laboratorio de ADN
                         </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                         <div className="space-y-2">
                            <Label className="text-xs text-slate-500">Simular mensaje de cliente:</Label>
                            <Input 
                               value={testInput} 
                               onChange={e => setTestInput(e.target.value)} 
                               placeholder="¿Cuándo es el próximo taller?" 
                               className="bg-slate-950 border-slate-800" 
                            />
                         </div>
                         <Button onClick={handleRunSimulation} className="w-full bg-indigo-600 h-11" disabled={testing || !testInput}>
                            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BrainCircuit className="w-4 h-4 mr-2" />}
                            Probar Inteligencia
                         </Button>
                      </CardContent>
                   </Card>

                   {foundContext.length > 0 && (
                      <Card className="bg-slate-900 border-slate-800">
                         <CardHeader className="py-3">
                            <CardTitle className="text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-2">
                               <Database className="w-3 h-3 text-indigo-400" /> Conocimiento Recuperado
                            </CardTitle>
                         </CardHeader>
                         <CardContent className="space-y-2">
                            {foundContext.map((c, i) => (
                               <div key={i} className="p-2 bg-slate-950 rounded border border-slate-800">
                                  <p className="text-[10px] font-bold text-indigo-400 truncate">{c.title}</p>
                                  <p className="text-[9px] text-slate-500 line-clamp-2 mt-1 italic">"{c.content}"</p>
                               </div>
                            ))}
                         </CardContent>
                      </Card>
                   )}
                </div>

                <div className="lg:col-span-8">
                   <Card className="bg-black border-slate-800 p-8 min-h-[500px] shadow-2xl relative overflow-hidden flex flex-col">
                      <div className="absolute top-4 right-4 text-[10px] font-mono text-slate-800 uppercase tracking-tighter">SAMURAI_CORE_v0.8</div>
                      
                      {testOutput ? (
                         <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex gap-4">
                               <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold shrink-0 shadow-lg shadow-red-900/40">侍</div>
                               <div className="bg-indigo-600/10 border border-indigo-600/20 p-5 rounded-2xl rounded-tl-none text-sm text-white leading-relaxed max-w-[90%] shadow-xl">
                                  {testOutput}
                               </div>
                            </div>
                            <div className="pl-14">
                               <Badge variant="outline" className="border-green-500/30 text-green-500 bg-green-500/5 text-[9px] px-2">
                                  <CheckCheck className="w-3 h-3 mr-1" /> RESPUESTA VALIDADA POR ADN
                               </Badge>
                            </div>
                         </div>
                      ) : (
                         <div className="flex-1 flex flex-col items-center justify-center text-slate-800 space-y-4">
                            <Bot className="w-20 h-20 opacity-10" />
                            <p className="font-mono text-xs uppercase tracking-widest opacity-40">Esperando entrada de datos...</p>
                         </div>
                      )}

                      {testing && (
                         <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
                            <div className="text-center space-y-4">
                               <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto" />
                               <p className="text-xs font-mono text-indigo-400 uppercase tracking-widest animate-pulse">Consultando Red Neuronal...</p>
                            </div>
                         </div>
                      )}
                   </Card>
                </div>
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

const PromptCard = ({ title, icon: Icon, value, onChange }: any) => (
  <Card className="bg-slate-900 border-slate-800 h-full hover:border-slate-700 transition-all">
    <CardHeader className="pb-3 border-b border-slate-800/50">
       <CardTitle className="text-sm text-white flex items-center gap-2"><Icon className="w-4 h-4 text-red-500"/> {title}</CardTitle>
    </CardHeader>
    <CardContent className="pt-4"><Textarea value={value} onChange={e => onChange(e.target.value)} className="min-h-[450px] bg-slate-950 border-slate-800 font-mono text-xs leading-relaxed focus:border-red-500/50" /></CardContent>
  </Card>
);

export default AgentBrain;