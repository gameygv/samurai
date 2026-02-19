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
  CheckCheck, Zap, Loader2, FileText, Send, ShoppingCart, Scan, Terminal, FlaskConical, Image as ImageIcon, Search
} from 'lucide-react';
import { toast } from 'sonner';

const DEFAULTS = {
  'prompt_adn_core': '# ADN CORE\nEres Samurai, el cerrador de ventas de elite de The Elephant Bowl.',
  'prompt_protocolos': '# PROTOCOLOS\nReglas de conducta y comunicación.',
  'prompt_estrategia_cierre': '# ESTRATEGIA DE CIERRE\nReglas para manejar objeciones y cerrar ventas.',
  'prompt_vision_instrucciones': '# OJO DE HALCÓN (VISIÓN)\nInstrucciones para analizar posters y comprobantes de pago.',
};

const AgentBrain = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'identidad';
  
  const [prompts, setPrompts] = useState<Record<string, string>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Text Simulation State
  const [testing, setTesting] = useState(false);
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  // Vision Simulation State
  const [visionTesting, setVisionTesting] = useState(false);
  const [visionUrl, setVisionUrl] = useState("");
  const [visionResult, setVisionResult] = useState<string | null>(null);

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
    try {
        const { data, error } = await supabase.functions.invoke('get-samurai-context', {
            body: { message: testInput, simulate_reply: true, custom_adn: prompts['prompt_adn_core'] }
        });
        if (error) throw error;
        setTestOutput(data?.reply || "No se generó respuesta.");
    } catch (err: any) {
        toast.error('Error en simulación: ' + err.message);
    } finally {
        setTesting(false);
    }
  };

  const handleTestVision = async () => {
    if (!visionUrl) return toast.warning("Pega una URL de imagen para probar.");
    setVisionTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-website', {
        body: { url: visionUrl, mode: 'VISION' }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Error desconocido en visión");

      setVisionResult(data.content);
      toast.success("Análisis de Ojo de Halcón completado");
    } catch (err: any) {
      toast.error("Error en visión: " + err.message);
    } finally {
      setVisionTesting(false);
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
             <TabsTrigger value="simulador" className="data-[state=active]:bg-indigo-600">4. Simulador & Debug</TabsTrigger>
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
             <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-7">
                   <PromptCard title="INSTRUCCIONES DE VISIÓN" icon={Scan} value={prompts['prompt_vision_instrucciones']} onChange={(v:string) => setPrompts({...prompts, prompt_vision_instrucciones: v})} />
                </div>
                <div className="md:col-span-5 space-y-4">
                   <Card className="bg-slate-900 border-slate-800">
                      <CardHeader>
                         <CardTitle className="text-sm text-white flex items-center gap-2">
                            <Eye className="w-4 h-4 text-blue-400" /> Simulador de Visión
                         </CardTitle>
                         <CardDescription>Prueba cómo el Ojo de Halcón analiza un poster o comprobante.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                         <div className="space-y-2">
                            <Label className="text-xs text-slate-400">URL de Imagen</Label>
                            <Input 
                               value={visionUrl}
                               onChange={e => setVisionUrl(e.target.value)}
                               placeholder="https://.../poster-evento.jpg"
                               className="bg-slate-950 border-slate-800 text-xs"
                            />
                         </div>
                         <Button 
                            onClick={handleTestVision} 
                            disabled={visionTesting || !visionUrl} 
                            className="w-full bg-blue-600 hover:bg-blue-700"
                         >
                            {visionTesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                            Analizar Imagen con OpenAI
                         </Button>

                         {visionUrl && (
                            <div className="aspect-video rounded border border-slate-800 bg-black overflow-hidden relative">
                               <img src={visionUrl} alt="Preview" className="w-full h-full object-contain opacity-50" />
                               <div className="absolute inset-0 flex items-center justify-center">
                                  <ImageIcon className="w-8 h-8 text-slate-800" />
                               </div>
                            </div>
                         )}

                         {visionResult && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                               <Label className="text-[10px] text-blue-400 font-bold uppercase">Resultado OCR / Análisis:</Label>
                               <div className="bg-black border border-blue-500/20 p-3 rounded text-[10px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">
                                  {visionResult}
                               </div>
                            </div>
                         )}
                      </CardContent>
                   </Card>
                </div>
             </div>
          </TabsContent>

          <TabsContent value="simulador" className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <Card className="md:col-span-4 bg-slate-900 border-slate-800 h-fit">
                   <CardHeader><CardTitle className="text-sm text-white flex items-center gap-2"><FlaskConical className="w-4 h-4 text-indigo-400"/> Prueba de ADN</CardTitle></CardHeader>
                   <CardContent className="space-y-4">
                      <Input value={testInput} onChange={e => setTestInput(e.target.value)} placeholder="Mensaje del cliente..." className="bg-slate-950 border-slate-800" />
                      <Button onClick={handleRunSimulation} className="w-full bg-indigo-600" disabled={testing || !testInput}>
                         {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Probar Respuesta'}
                      </Button>
                      <Button variant="ghost" size="sm" className="w-full text-[10px] text-slate-500" onClick={() => setShowFullPrompt(!showFullPrompt)}>
                         <Terminal className="w-3 h-3 mr-2" /> {showFullPrompt ? 'Ocultar Debug' : 'Ver Kernel Prompt'}
                      </Button>
                   </CardContent>
                </Card>
                <Card className="md:col-span-8 bg-black border-slate-800 p-6 min-h-[400px] shadow-2xl">
                   {showFullPrompt ? (
                      <div className="font-mono text-[10px] text-green-500/80 space-y-4">
                         <div className="bg-green-500/5 p-3 rounded border border-green-500/20">
                            <p className="font-bold mb-1 uppercase tracking-tighter text-indigo-400">Ensamblado Final del Cerebro:</p>
                            <p className="whitespace-pre-wrap">{prompts['prompt_adn_core']}\n\n{prompts['prompt_protocolos']}\n\n{prompts['prompt_estrategia_cierre']}\n\n[CONTEXTO_WEB_INDEXADO]</p>
                         </div>
                      </div>
                   ) : testOutput ? (
                      <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2">
                         <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold shrink-0">侍</div>
                         <div className="bg-indigo-600/10 border border-indigo-600/20 p-4 rounded-2xl text-xs text-white leading-relaxed">{testOutput}</div>
                      </div>
                   ) : <p className="text-slate-700 italic text-center py-20">El simulador está listo para procesar ADN...</p>}
                </Card>
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