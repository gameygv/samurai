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
import { 
  Save, Bot, Eye, Hammer, ScrollText, 
  Database, History, MessageSquare, Gift, RefreshCw, 
  CheckCheck, Zap, FlaskConical, 
  Play, Loader2, Terminal, Info, BrainCircuit, Target, ScanEye,
  AlertTriangle, BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const DEFAULTS = {
  'prompt_core': '# ADN SAMURAI - THE ELEPHANT BOWL\nEres el cerrador estrella...',
  'prompt_technical': '# REGLAS TÉCNICAS\nNo uses emojis excesivos...',
  'prompt_context': '# CONTEXTO GENERAL\nSomos especialistas en Sonoterapia...',
  'prompt_psychology': '# ANÁLISIS PSICOLÓGICO\nIdentifica el tono del cliente...',
  'prompt_vision': '# ANÁLISIS DE IMÁGENES\nCuando recibas una foto, descríbela...',
  'prompt_relearning': '# LECCIONES APRENDIDAS (#CIA)\nAquí se inyectan las reglas de auto-aprendizaje...'
};

const AgentBrain = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'part1';
  
  const [prompts, setPrompts] = useState<Record<string, string>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Test State
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
      if (!error && data) {
        const dbPrompts: Record<string, string> = { ...DEFAULTS };
        data.forEach((item: any) => { dbPrompts[item.key] = item.value; });
        setPrompts(dbPrompts);
      }
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
      
      await logActivity({ action: 'UPDATE', resource: 'BRAIN', description: 'Cerebro Samurai actualizado', status: 'OK' });
      toast.success('Estrategia del Samurai guardada correctamente.');
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRunTest = async () => {
    if (!testInput) {
       toast.warning("Ingresa un mensaje para simular la entrada.");
       return;
    }
    setTesting(true);
    setTestOutput(null);
    try {
        const { data, error } = await supabase.functions.invoke('get-samurai-context', {
            body: { message: testInput, mode: "LABORATORY" }
        });
        if (error) throw error;
        setTestOutput(data.system_prompt || "Respuesta vacía del servidor.");
        toast.success("Simulación completada.");
    } catch (err: any) {
        console.error("Test Error:", err);
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
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
               <BrainCircuit className="w-8 h-8 text-red-600" />
               Cerebro Core del Samurai
            </h1>
            <p className="text-slate-400">Configura la identidad y capas de procesamiento de la IA.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20 px-8">
             {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
             Guardar Estrategia
          </Button>
        </div>

        <Tabs value={initialTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 w-full justify-start overflow-x-auto h-auto flex-nowrap">
             <TabsTrigger value="part1" className="py-2"><Bot className="w-4 h-4 mr-2" /> 1. Sistema</TabsTrigger>
             <TabsTrigger value="part2" className="py-2"><Database className="w-4 h-4 mr-2" /> 2. Contexto</TabsTrigger>
             <TabsTrigger value="part3" className="py-2"><ScanEye className="w-4 h-4 mr-2" /> 3. Psicología</TabsTrigger>
             <TabsTrigger value="part4" className="py-2"><Eye className="w-4 h-4 mr-2" /> 4. Visión</TabsTrigger>
             <TabsTrigger value="part5" className="py-2 data-[state=active]:bg-indigo-600"><FlaskConical className="w-4 h-4 mr-2" /> Laboratorio</TabsTrigger>
          </TabsList>

          <TabsContent value="part1" className="mt-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PromptCard 
                  title="Identidad Maestra (Core)" 
                  icon={Bot} 
                  description="Define quién es el Samurai y su tono de voz."
                  value={prompts['prompt_core']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_core: v})} 
                />
                <PromptCard 
                  title="Restricciones Técnicas" 
                  icon={Hammer} 
                  description="Reglas sobre formato, emojis y prohibiciones."
                  value={prompts['prompt_technical']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_technical: v})} 
                />
             </div>
          </TabsContent>

          <TabsContent value="part2" className="mt-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PromptCard 
                  title="Contexto del Negocio" 
                  icon={BookOpen} 
                  description="Información general sobre The Elephant Bowl."
                  value={prompts['prompt_context']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_context: v})} 
                />
                <PromptCard 
                  title="Lecciones Aprendidas (#CIA)" 
                  icon={History} 
                  description="Reglas generadas automáticamente por el auto-aprendizaje."
                  value={prompts['prompt_relearning']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_relearning: v})} 
                  readOnly={true}
                />
             </div>
          </TabsContent>

          <TabsContent value="part3" className="mt-6">
             <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                <PromptCard 
                  title="Instrucciones de Perfilado" 
                  icon={Target} 
                  description="Cómo debe el Samurai analizar emocionalmente al cliente."
                  value={prompts['prompt_psychology']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_psychology: v})} 
                />
             </div>
          </TabsContent>

          <TabsContent value="part4" className="mt-6">
             <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                <PromptCard 
                  title="Análisis de Multimedia" 
                  icon={Eye} 
                  description="Instrucciones para cuando el cliente envía fotos o videos."
                  value={prompts['prompt_vision']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_vision: v})} 
                />
             </div>
          </TabsContent>
          
          <TabsContent value="part5" className="mt-6">
             <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <Card className="md:col-span-4 bg-slate-900 border-slate-800">
                   <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                         <Terminal className="w-5 h-5 text-indigo-400" /> Simulator
                      </CardTitle>
                      <CardDescription>Prueba cómo se construye el prompt final.</CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-slate-400">Mensaje de Prueba</Label>
                        <Input 
                           value={testInput} 
                           onChange={e => setTestInput(e.target.value)} 
                           placeholder="Ej: Hola, ¿qué precio tienen los cuencos?"
                           className="bg-slate-950 border-slate-800 text-white" 
                        />
                      </div>
                      <Button onClick={handleRunTest} className="w-full bg-indigo-600" disabled={testing}>
                         {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Zap className="w-4 h-4 mr-2" />}
                         Ensamblar Prompt
                      </Button>
                      <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded text-[10px] text-indigo-300">
                         <Info className="w-3 h-3 inline mr-1" /> Esto simula la llamada que hace el bot de WhatsApp al servidor.
                      </div>
                   </CardContent>
                </Card>

                <Card className="md:col-span-8 bg-black border-slate-800 shadow-inner">
                   <div className="p-4 flex items-center justify-between border-b border-slate-800">
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Debug Output: final_system_prompt</span>
                      <div className="flex gap-1">
                         <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                         <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                         <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                      </div>
                   </div>
                   <CardContent className="p-0">
                      <div className="p-6 font-mono text-[11px] text-slate-400 overflow-y-auto max-h-[500px] leading-relaxed whitespace-pre-wrap">
                         {testOutput || "// Ingresa un mensaje y presiona 'Ensamblar Prompt' para ver el resultado de la fusión de todas las capas superiores."}
                      </div>
                   </CardContent>
                </Card>
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

const PromptCard = ({ title, icon: Icon, description, value, onChange, readOnly = false }: any) => (
  <Card className="bg-slate-900 border-slate-800 flex flex-col h-full shadow-lg hover:border-slate-700 transition-colors">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
         <CardTitle className="text-base text-white flex items-center gap-2">
            <Icon className="w-5 h-5 text-red-500"/> {title}
         </CardTitle>
         {readOnly && <Badge variant="secondary" className="text-[9px] bg-indigo-500/10 text-indigo-400">Sólo Lectura</Badge>}
      </div>
      <CardDescription className="text-slate-500 text-xs">{description}</CardDescription>
    </CardHeader>
    <CardContent className="flex-1">
      <Textarea 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        readOnly={readOnly}
        className={`h-full min-h-[300px] bg-slate-950/50 border-slate-800 font-mono text-xs text-slate-300 leading-relaxed focus-visible:ring-red-600/50 ${readOnly ? 'opacity-70 grayscale' : ''}`}
        placeholder="Ingresa las instrucciones aquí..."
      />
    </CardContent>
  </Card>
);

export default AgentBrain;