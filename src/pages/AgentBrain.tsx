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
  CheckCheck, Zap, Loader2, FileText, Send, ShoppingCart, Scan, Terminal
} from 'lucide-react';
import { toast } from 'sonner';

const DEFAULTS = {
  'prompt_adn_core': '# ADN CORE\nEres Samurai, el cerrador de ventas de elite de The Elephant Bowl.',
  'prompt_protocolos': '# PROTOCOLOS\nReglas de conducta.',
  'prompt_estrategia_cierre': '# ESTRATEGIA DE CIERRE\nReglas de venta.',
  'prompt_vision_instrucciones': '# OJO DE HALCÓN\nInstrucciones visuales.',
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
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('app_config').select('key, value').eq('category', 'PROMPT');
      if (data && data.length > 0) {
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
      await supabase.from('app_config').upsert(updates);
      toast.success('Cerebro actualizado.');
    } finally {
      setSaving(false);
    }
  };

  const handleRunSimulation = async () => {
    setTesting(true);
    try {
        const { data } = await supabase.functions.invoke('get-samurai-context', {
            body: { message: testInput, simulate_reply: true, custom_adn: prompts['prompt_adn_core'] }
        });
        setTestOutput(data.reply);
    } finally {
        setTesting(false);
    }
  };

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-indigo-500" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Cerebro del Samurai</h1>
          <Button onClick={handleSave} disabled={saving} className="bg-red-600 px-8">Guardar Cambios</Button>
        </div>

        <Tabs value={initialTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-6">
             <TabsTrigger value="identidad">Identidad</TabsTrigger>
             <TabsTrigger value="ventas">Ventas</TabsTrigger>
             <TabsTrigger value="simulador" className="data-[state=active]:bg-indigo-600">Simulador & Debug</TabsTrigger>
          </TabsList>

          <TabsContent value="identidad" className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <PromptCard title="ADN CORE" icon={Bot} value={prompts['prompt_adn_core']} onChange={(v:string) => setPrompts({...prompts, prompt_adn_core: v})} />
             <PromptCard title="PROTOCOLOS" icon={FileText} value={prompts['prompt_protocolos']} onChange={(v:string) => setPrompts({...prompts, prompt_protocolos: v})} />
          </TabsContent>

          <TabsContent value="ventas">
             <PromptCard title="Estrategia de Cierre" icon={ShoppingCart} value={prompts['prompt_estrategia_cierre']} onChange={(v:string) => setPrompts({...prompts, prompt_estrategia_cierre: v})} />
          </TabsContent>

          <TabsContent value="simulador" className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <Card className="md:col-span-4 bg-slate-900 border-slate-800 h-fit">
                   <CardHeader><CardTitle className="text-sm text-white">Prueba de ADN</CardTitle></CardHeader>
                   <CardContent className="space-y-4">
                      <Input value={testInput} onChange={e => setTestInput(e.target.value)} placeholder="Mensaje del cliente..." className="bg-slate-950 border-slate-800" />
                      <Button onClick={handleRunSimulation} className="w-full bg-indigo-600" disabled={testing}>
                         {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Probar Respuesta'}
                      </Button>
                      <Button variant="ghost" size="sm" className="w-full text-[10px] text-slate-500" onClick={() => setShowFullPrompt(!showFullPrompt)}>
                         <Terminal className="w-3 h-3 mr-2" /> {showFullPrompt ? 'Ocultar Debug' : 'Ver Prompt Completo'}
                      </Button>
                   </CardContent>
                </Card>
                <Card className="md:col-span-8 bg-black border-slate-800 p-6 min-h-[400px]">
                   {showFullPrompt ? (
                      <div className="font-mono text-[10px] text-green-500/80 space-y-4">
                         <div className="bg-green-500/5 p-3 rounded border border-green-500/20">
                            <p className="font-bold mb-1">PROMPT ENSAMBLADO (PREVIEW):</p>
                            <p className="whitespace-pre-wrap">{prompts['prompt_adn_core']}\n\n{prompts['prompt_protocolos']}\n\n[KNOWLEDGE_BASE]: theelephantbowl.com/formacion...</p>
                         </div>
                         <p className="italic text-slate-500">// Este es el bloque final que recibe el motor de la IA.</p>
                      </div>
                   ) : testOutput ? (
                      <div className="flex gap-4">
                         <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold shrink-0">侍</div>
                         <div className="bg-indigo-600/10 border border-indigo-600/20 p-4 rounded-2xl text-xs text-white leading-relaxed">{testOutput}</div>
                      </div>
                   ) : <p className="text-slate-600 italic text-center py-20">Simulador de ADN Samurai Ready...</p>}
                </Card>
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

const PromptCard = ({ title, icon: Icon, value, onChange }: any) => (
  <Card className="bg-slate-900 border-slate-800 h-full">
    <CardHeader className="pb-3 border-b border-slate-800/50">
       <CardTitle className="text-sm text-white flex items-center gap-2"><Icon className="w-4 h-4 text-red-500"/> {title}</CardTitle>
    </CardHeader>
    <CardContent className="pt-4"><Textarea value={value} onChange={e => onChange(e.target.value)} className="min-h-[400px] bg-slate-950 border-slate-800 font-mono text-xs leading-relaxed" /></CardContent>
  </Card>
);

export default AgentBrain;