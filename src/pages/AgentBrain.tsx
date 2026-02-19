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
  CheckCheck, Zap, Loader2, FileText, Send, ShoppingCart, Scan
} from 'lucide-react';
import { toast } from 'sonner';

const DEFAULTS = {
  'prompt_adn_core': '# ADN CORE\nEres Samurai, el cerrador de ventas de elite de The Elephant Bowl. Tu tono es profesional, místico y directo.',
  'prompt_protocolos': '# PROTOCOLOS\nReglas de saludo y despedida.',
  'prompt_estrategia_cierre': '# ESTRATEGIA DE CIERRE\nReglas para enviar links de pago y cerrar la venta.',
  'prompt_vision_instrucciones': '# OJO DE HALCÓN (VISIÓN)\nInstrucciones para analizar imágenes y comprobantes.',
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(prompts).map(([key, value]) => ({
        key, value, category: 'PROMPT', updated_at: new Date().toISOString()
      }));
      const { error } = await supabase.from('app_config').upsert(updates);
      if (error) throw error;
      toast.success('Configuración del Samurai guardada correctamente.');
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRunSimulation = async () => {
    if (!testInput) return toast.warning("Ingresa un mensaje para probar.");
    setTesting(true);
    setTestOutput(null);
    try {
        const { data, error } = await supabase.functions.invoke('get-samurai-context', {
            body: { message: testInput, simulate_reply: true, custom_adn: prompts['prompt_adn_core'] }
        });
        if (error) throw error;
        setTestOutput(data.reply);
    } catch (err: any) {
        toast.error('Error en simulación: ' + err.message);
    } finally {
        setTesting(false);
    }
  };

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Cerebro del Samurai</h1>
            <p className="text-slate-400">Configura el ADN y las estrategias de respuesta de la IA.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 px-8 shadow-lg shadow-red-900/20">
             {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Cambios
          </Button>
        </div>

        <Tabs value={initialTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-6 flex-wrap h-auto">
             <TabsTrigger value="identidad" className="data-[state=active]:bg-red-600">1. Identidad</TabsTrigger>
             <TabsTrigger value="ventas" className="data-[state=active]:bg-indigo-600">2. Ventas</TabsTrigger>
             <TabsTrigger value="ojo-de-halcon" className="data-[state=active]:bg-indigo-600">3. Ojo de Halcón</TabsTrigger>
             <TabsTrigger value="simulador" className="data-[state=active]:bg-indigo-600">4. Simulador</TabsTrigger>
          </TabsList>

          <TabsContent value="identidad" className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PromptCard title="ADN CORE (Identidad)" icon={Bot} value={prompts['prompt_adn_core']} onChange={(v:string) => setPrompts({...prompts, prompt_adn_core: v})} />
                <PromptCard title="PROTOCOLOS (Conducta)" icon={FileText} value={prompts['prompt_protocolos']} onChange={(v:string) => setPrompts({...prompts, prompt_protocolos: v})} />
             </div>
          </TabsContent>

          <TabsContent value="ventas" className="space-y-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-green-500">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-green-500"/> Estrategia de Cierre</CardTitle>
                   <CardDescription>Define cómo la IA debe manejar las objeciones y pedir el pago.</CardDescription>
                </CardHeader>
                <CardContent>
                   <Textarea 
                      value={prompts['prompt_estrategia_cierre']} 
                      onChange={e => setPrompts({...prompts, prompt_estrategia_cierre: e.target.value})}
                      className="min-h-[400px] bg-slate-950 border-slate-800 font-mono text-xs leading-relaxed"
                   />
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="ojo-de-halcon" className="space-y-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-blue-500">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><Scan className="w-5 h-5 text-blue-500"/> Visión de Comprobantes</CardTitle>
                   <CardDescription>Instrucciones específicas para el análisis de imágenes y posters.</CardDescription>
                </CardHeader>
                <CardContent>
                   <Textarea 
                      value={prompts['prompt_vision_instrucciones']} 
                      onChange={e => setPrompts({...prompts, prompt_vision_instrucciones: e.target.value})}
                      className="min-h-[400px] bg-slate-950 border-slate-800 font-mono text-xs leading-relaxed"
                   />
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="simulador" className="grid grid-cols-1 md:grid-cols-12 gap-8">
             <Card className="md:col-span-4 bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-sm text-white flex items-center gap-2"><FlaskConical className="w-4 h-4 text-indigo-400"/> Probar ADN</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="space-y-2">
                      <Label className="text-slate-400">Mensaje del Cliente</Label>
                      <Input 
                         value={testInput} 
                         onChange={e => setTestInput(e.target.value)} 
                         placeholder="Ej: Hola, quiero inscribirme..." 
                         className="bg-slate-950 border-slate-800" 
                      />
                   </div>
                   <Button onClick={handleRunSimulation} className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={testing || !testInput}>
                      {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Simular Respuesta
                   </Button>
                </CardContent>
             </Card>
             <Card className="md:col-span-8 bg-black border-slate-800 p-6 min-h-[400px] shadow-inner">
                {testOutput ? (
                   <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2">
                      <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold shrink-0">侍</div>
                      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl rounded-tl-none text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                         {testOutput}
                      </div>
                   </div>
                ) : (
                   <div className="flex flex-col items-center justify-center h-full text-slate-700 space-y-2">
                      <Bot className="w-12 h-12 opacity-20" />
                      <p className="text-xs italic">Ingresa un mensaje para ver cómo respondería el Samurai.</p>
                   </div>
                )}
             </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

const PromptCard = ({ title, icon: Icon, value, onChange }: any) => (
  <Card className="bg-slate-900 border-slate-800 flex flex-col h-full hover:border-slate-700 transition-colors">
    <CardHeader className="pb-3 border-b border-slate-800/50">
       <CardTitle className="text-sm text-white flex items-center gap-2">
          <Icon className="w-4 h-4 text-red-500"/> {title}
       </CardTitle>
    </CardHeader>
    <CardContent className="flex-1 pt-4">
       <Textarea 
          value={value} 
          onChange={e => onChange(e.target.value)} 
          className="h-full min-h-[350px] bg-slate-950 border-slate-800 font-mono text-xs leading-relaxed focus:border-red-500/50" 
       />
    </CardContent>
  </Card>
);

export default AgentBrain;