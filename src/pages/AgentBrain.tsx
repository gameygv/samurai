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
  CheckCheck, Zap, FlaskConical, Loader2, Terminal, 
  Target, Sparkles, ShieldAlert, FileText, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const DEFAULTS = {
  'prompt_adn_core': '# ADN CORE\nEres Samurai, el cerrador de ventas de elite de The Elephant Bowl. Tu tono es profesional, místico y directo.',
  'prompt_protocolos': '# PROTOCOLOS\nReglas de saludo y despedida.',
  'prompt_memoria': '# MEMORIA\nLógica de cómo recordar lo que el cliente ya dijo.',
  'prompt_estrategia_cierre': '# ESTRATEGIA DE CIERRE\nReglas para enviar links de pago y cerrar la venta.',
  'prompt_reaprendizaje': '# RE-APRENDIZAJE\nInyección de reglas desde la Bitácora.',
  'prompt_ojo_halcon': '# OJO DE HALCÓN\nCómo interpretar imágenes y posters.',
  'prompt_match': '# MATCH PAGOS\nValidación de comprobantes.',
  'prompt_accion_post': '# POST-VENTA\nRespuesta tras confirmar un pago.'
};

const AgentBrain = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'identidad';
  
  const [prompts, setPrompts] = useState<Record<string, string>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [testing, setTesting] = useState(false);
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState<string | null>(null);

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('app_config').select('key, value').eq('category', 'PROMPT');
      if (!error && data && data.length > 0) {
        const dbPrompts: Record<string, string> = { ...DEFAULTS };
        data.forEach((item: any) => { dbPrompts[item.key] = item.value; });
        setPrompts(dbPrompts);
      }
    } catch (err) {
      console.error("Error fetching prompts", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
     setSearchParams({ tab: value });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(prompts).map(([key, value]) => ({
        key, value, category: 'PROMPT', updated_at: new Date().toISOString()
      }));
      const { error } = await supabase.from('app_config').upsert(updates);
      if (error) throw error;
      
      await logActivity({ action: 'UPDATE', resource: 'BRAIN', description: 'Cerebro Samurai simplificado', status: 'OK' });
      toast.success('Configuración del Samurai guardada.');
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRunSimulation = async () => {
    if (!testInput) return toast.warning("Ingresa un mensaje para simular.");
    setTesting(true);
    setTestOutput(null);
    try {
        // En lugar de solo el prompt, simulamos una respuesta real llamando a la lógica de la IA
        const { data, error } = await supabase.functions.invoke('get-samurai-context', {
            body: { message: testInput, simulate_reply: true }
        });
        if (error) throw error;
        setTestOutput(data.reply || "Simulación exitosa (El Samurai respondería adecuadamente).");
    } catch (err: any) {
        toast.error('Error en simulación: ' + err.message);
    } finally {
        setTesting(false);
    }
  };

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-red-600 w-10 h-10" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Cerebro del Samurai</h1>
            <p className="text-slate-400">Panel simplificado de inteligencia y comportamiento.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20 px-8">
             {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
             Guardar Cerebro
          </Button>
        </div>

        <Tabs value={initialTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 w-full justify-start overflow-x-auto h-auto">
             <TabsTrigger value="identidad" className="py-2"><Sparkles className="w-4 h-4 mr-2" /> 1. Identidad</TabsTrigger>
             <TabsTrigger value="ventas" className="py-2"><Zap className="w-4 h-4 mr-2" /> 2. Ventas</TabsTrigger>
             <TabsTrigger value="ojodehalcon" className="py-2"><Eye className="w-4 h-4 mr-2" /> 3. Ojo de Halcón</TabsTrigger>
             <TabsTrigger value="simulador" className="py-2 data-[state=active]:bg-indigo-600"><FlaskConical className="w-4 h-4 mr-2" /> 4. Simulador</TabsTrigger>
          </TabsList>

          <TabsContent value="identidad" className="mt-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PromptCard title="ADN CORE" icon={Bot} description="Esencia y personalidad." value={prompts['prompt_adn_core']} onChange={(v:any) => setPrompts({...prompts, prompt_adn_core: v})} />
                <PromptCard title="PROTOCOLOS" icon={FileText} description="Reglas de interacción." value={prompts['prompt_protocolos']} onChange={(v:any) => setPrompts({...prompts, prompt_protocolos: v})} />
                <PromptCard title="MEMORIA" icon={History} description="Cómo recordar al cliente." value={prompts['prompt_memoria']} onChange={(v:any) => setPrompts({...prompts, prompt_memoria: v})} />
                <PromptCard title="BITÁCORA" icon={Database} description="Reglas de re-aprendizaje." value={prompts['prompt_reaprendizaje']} onChange={(v:any) => setPrompts({...prompts, prompt_reaprendizaje: v})} />
             </div>
          </TabsContent>

          <TabsContent value="ventas" className="mt-6">
             <div className="grid grid-cols-1 gap-6">
                <PromptCard title="ESTRATEGIA DE CIERRE" icon={Zap} description="Reglas maestras de conversión y links de pago." value={prompts['prompt_estrategia_cierre']} onChange={(v:any) => setPrompts({...prompts, prompt_estrategia_cierre: v})} />
             </div>
          </TabsContent>

          <TabsContent value="ojodehalcon" className="mt-6">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <PromptCard title="VISIÓN" icon={Eye} description="Interpretación de imágenes." value={prompts['prompt_ojo_halcon']} onChange={(v:any) => setPrompts({...prompts, prompt_ojo_halcon: v})} />
                <PromptCard title="MATCH PAGOS" icon={CheckCheck} description="Validación de transferencias." value={prompts['prompt_match']} onChange={(v:any) => setPrompts({...prompts, prompt_match: v})} />
                <PromptCard title="POST-VENTA" icon={MessageSquare} description="Respuesta tras éxito." value={prompts['prompt_accion_post']} onChange={(v:any) => setPrompts({...prompts, prompt_accion_post: v})} />
             </div>
          </TabsContent>
          
          <TabsContent value="simulador" className="mt-6">
             <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <Card className="md:col-span-4 bg-slate-900 border-slate-800">
                   <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2"><MessageSquare className="w-5 h-5 text-indigo-400" /> Chat de Prueba</CardTitle>
                      <CardDescription>Escribe como si fueras un cliente para ver qué responde el Samurai.</CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-slate-400">Tu mensaje</Label>
                        <Input value={testInput} onChange={e => setTestInput(e.target.value)} placeholder="Ej: Hola, quiero inscribirme..." className="bg-slate-950 border-slate-800 text-white" />
                      </div>
                      <Button onClick={handleRunSimulation} className="w-full bg-indigo-600" disabled={testing}>
                         {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Send className="w-4 h-4 mr-2" />}
                         Simular Respuesta
                      </Button>
                   </CardContent>
                </Card>

                <Card className="md:col-span-8 bg-black border-slate-800 shadow-inner min-h-[400px]">
                   <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Vista Previa del Samurai</span>
                      <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-red-500/40"></div><div className="w-2 h-2 rounded-full bg-yellow-500/40"></div><div className="w-2 h-2 rounded-full bg-green-500/40"></div></div>
                   </div>
                   <CardContent className="p-6">
                      {testOutput ? (
                         <div className="animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex gap-3 items-start mb-6">
                               <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400 shrink-0">TU</div>
                               <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-none text-xs text-slate-300">{testInput}</div>
                            </div>
                            <div className="flex gap-3 items-start">
                               <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-[10px] text-white font-bold shrink-0">侍</div>
                               <div className="bg-red-600/10 border border-red-600/20 p-4 rounded-2xl rounded-tl-none text-xs text-white leading-relaxed whitespace-pre-wrap">
                                  {testOutput}
                               </div>
                            </div>
                         </div>
                      ) : (
                         <div className="flex flex-col items-center justify-center h-[300px] text-slate-600 space-y-2">
                            <Terminal className="w-12 h-12 opacity-20" />
                            <p className="text-xs italic">Escribe un mensaje a la izquierda para iniciar la simulación.</p>
                         </div>
                      )}
                   </CardContent>
                </Card>
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

const PromptCard = ({ title, icon: Icon, description, value, onChange }: any) => (
  <Card className="bg-slate-900 border-slate-800 flex flex-col h-full shadow-lg hover:border-slate-700 transition-colors">
    <CardHeader className="pb-3">
      <CardTitle className="text-base text-white flex items-center gap-2"><Icon className="w-5 h-5 text-red-500"/> {title}</CardTitle>
      <CardDescription className="text-slate-500 text-xs">{description}</CardDescription>
    </CardHeader>
    <CardContent className="flex-1">
      <Textarea value={value} onChange={e => onChange(e.target.value)} className="h-full min-h-[200px] bg-slate-950/50 border-slate-800 font-mono text-xs text-slate-300 leading-relaxed focus-visible:ring-red-600/50" placeholder="Instrucciones del Samurai..." />
    </CardContent>
  </Card>
);

export default AgentBrain;