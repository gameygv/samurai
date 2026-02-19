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
  CheckCheck, Zap, Loader2, FileText, Send, ShoppingCart, Scan, Terminal, FlaskConical, Image as ImageIcon, Search, ArrowRight, BrainCircuit, ShieldAlert, Info
} from 'lucide-react';
import { toast } from 'sonner';

const DEFAULTS = {
  'prompt_adn_core': '# ADN CORE\nEres Samurai, el cerrador de ventas de elite de The Elephant Bowl.\n\nTU MISIÓN:\nConvertir cada consulta en una venta de formación o instrumentos.',
  'prompt_protocolos': '# PROTOCOLOS\nReglas de conducta y comunicación.',
  'prompt_estrategia_cierre': '# ESTRATEGIA DE CIERRE\nReglas para manejar objeciones.',
  'prompt_vision_instrucciones': '# OJO DE HALCÓN\nAnaliza posters y pagos.',
};

const AgentBrain = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'identidad';
  
  const [prompts, setPrompts] = useState<Record<string, string>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [masterPromptPreview, setMasterPromptPreview] = useState("");

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
      
      // Fetch Master Prompt Preview
      const { data: brainData } = await supabase.functions.invoke('get-samurai-brain');
      if (brainData) setMasterPromptPreview(brainData.system_prompt);
      
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
      fetchPrompts(); // Refresh preview
    } catch (err: any) {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        
        {/* ALERTA DE ALUCINACIÓN (NUEVA) */}
        <Card className="bg-red-900/10 border-red-500/30 border-l-4 border-l-red-600">
           <div className="p-4 flex items-center gap-4">
              <ShieldAlert className="w-8 h-8 text-red-500 shrink-0" />
              <div>
                 <h3 className="text-white font-bold text-sm">Protección Anti-Alucinaciones Activa</h3>
                 <p className="text-xs text-slate-400">Si el Samurai niega la existencia de talleres, asegúrate de haber sincronizado la "Verdad Maestra" y que tu integración externa (Make/Kommo) esté usando el endpoint del Brain API.</p>
              </div>
           </div>
        </Card>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Cerebro del Samurai</h1>
            <p className="text-slate-400">Control maestro de la lógica y visión de la IA.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 px-8">
             {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
             Guardar Todo
          </Button>
        </div>

        <Tabs value={initialTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-6">
             <TabsTrigger value="identidad">1. Identidad</TabsTrigger>
             <TabsTrigger value="ojo-de-halcon">2. Ojo de Halcón</TabsTrigger>
             <TabsTrigger value="debug">3. Ver Prompt Maestro</TabsTrigger>
          </TabsList>

          <TabsContent value="identidad" className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PromptCard title="ADN CORE" icon={Bot} value={prompts['prompt_adn_core']} onChange={(v:string) => setPrompts({...prompts, prompt_adn_core: v})} />
                <PromptCard title="PROTOCOLOS" icon={FileText} value={prompts['prompt_protocolos']} onChange={(v:string) => setPrompts({...prompts, prompt_protocolos: v})} />
             </div>
          </TabsContent>

          <TabsContent value="debug">
             <Card className="bg-slate-950 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-sm text-indigo-400 flex items-center gap-2">
                      <Terminal className="w-4 h-4" /> Prompt Generado para la IA
                   </CardTitle>
                   <CardDescription>Esto es lo que el Samurai "ve" en cada mensaje. El conocimiento de la web se inyecta aquí automáticamente.</CardDescription>
                </CardHeader>
                <CardContent>
                   <ScrollArea className="h-[500px] rounded border border-slate-800 p-4 bg-black">
                      <pre className="text-[10px] text-slate-500 font-mono whitespace-pre-wrap leading-relaxed">
                         {masterPromptPreview}
                      </pre>
                   </ScrollArea>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="ojo-de-halcon">
             <PromptCard title="INSTRUCCIONES DE VISIÓN" icon={Scan} value={prompts['prompt_vision_instrucciones']} onChange={(v:string) => setPrompts({...prompts, prompt_vision_instrucciones: v})} />
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
    <CardContent className="pt-4"><Textarea value={value} onChange={e => onChange(e.target.value)} className="min-h-[450px] bg-slate-950 border-slate-800 font-mono text-xs" /></CardContent>
  </Card>
);

export default AgentBrain;