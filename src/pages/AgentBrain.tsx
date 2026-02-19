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
  Target, Sparkles, ShieldAlert, FileText, Send, Scan, Upload
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

  // Vision Test State
  const [visionUrl, setVisionUrl] = useState("");
  const [visionFile, setVisionFile] = useState<File | null>(null);
  const [visionResult, setVisionResult] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

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
      toast.success('Configuración del Samurai guardada.');
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRunSimulation = async () => {
    if (!testInput) return toast.warning("Ingresa un mensaje.");
    setTesting(true);
    setTestOutput(null);
    try {
        // Ahora sí enviamos el ADN real a la simulación
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

  const handleTestVision = async () => {
     let finalUrl = visionUrl;
     setScanning(true);
     setVisionResult(null);

     try {
        if (visionFile) {
           const fileExt = visionFile.name.split('.').pop();
           const fileName = `temp-${Date.now()}.${fileExt}`;
           const { error: uploadError } = await supabase.storage.from('media').upload(`temp/${fileName}`, visionFile);
           if (uploadError) throw uploadError;
           const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(`temp/${fileName}`);
           finalUrl = publicUrl;
        }

        if (!finalUrl) throw new Error("Debes subir un archivo o pegar una URL.");

        const { data, error } = await supabase.functions.invoke('scrape-website', {
           body: { url: finalUrl, mode: 'VISION' }
        });
        if (error) throw error;
        setVisionResult(data.content);
        toast.success("Análisis de visión completado.");
     } catch (err: any) {
        toast.error('Error de visión: ' + err.message);
     } finally {
        setScanning(false);
     }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Cerebro del Samurai</h1>
          <Button onClick={handleSave} disabled={saving} className="bg-red-600 px-8">
             {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Cerebro
          </Button>
        </div>

        <Tabs value={initialTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1">
             <TabsTrigger value="identidad">1. Identidad</TabsTrigger>
             <TabsTrigger value="ventas">2. Ventas</TabsTrigger>
             <TabsTrigger value="ojodehalcon">3. Ojo de Halcón</TabsTrigger>
             <TabsTrigger value="simulador" className="data-[state=active]:bg-indigo-600">4. Simulador</TabsTrigger>
          </TabsList>

          <TabsContent value="identidad" className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
             <PromptCard title="ADN CORE" icon={Bot} value={prompts['prompt_adn_core']} onChange={(v:any) => setPrompts({...prompts, prompt_adn_core: v})} />
             <PromptCard title="PROTOCOLOS" icon={FileText} value={prompts['prompt_protocolos']} onChange={(v:any) => setPrompts({...prompts, prompt_protocolos: v})} />
          </TabsContent>

          <TabsContent value="ojodehalcon" className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6">
             <div className="md:col-span-8 space-y-6">
                <PromptCard title="VISIÓN" icon={Eye} value={prompts['prompt_ojo_halcon']} onChange={(v:any) => setPrompts({...prompts, prompt_ojo_halcon: v})} />
             </div>
             <div className="md:col-span-4 space-y-6">
                <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-indigo-500">
                   <CardHeader>
                      <CardTitle className="text-sm text-white flex items-center gap-2"><Eye className="w-4 h-4 text-indigo-400" /> Analizar Pago / Poster</CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <div className="space-y-2">
                         <Label className="text-xs text-slate-400">Opción 1: Subir Archivo</Label>
                         <Input type="file" onChange={e => setVisionFile(e.target.files?.[0] || null)} className="bg-slate-950 border-slate-800 text-xs" />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-xs text-slate-500">O URL de imagen</Label>
                         <Input value={visionUrl} onChange={e => setVisionUrl(e.target.value)} placeholder="https://..." className="bg-slate-950 border-slate-800 text-xs" />
                      </div>
                      <Button onClick={handleTestVision} className="w-full bg-indigo-600" disabled={scanning}>
                         {scanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Scan className="w-4 h-4 mr-2" />} Escanear Pago
                      </Button>
                      {visionResult && (
                         <div className="mt-4 p-3 bg-slate-950 border border-indigo-500/30 rounded font-mono text-[10px] text-indigo-300 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                            {visionResult}
                         </div>
                      )}
                   </CardContent>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="simulador" className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6">
             <Card className="md:col-span-4 bg-slate-900 border-slate-800">
                <CardContent className="pt-6 space-y-4">
                   <Label>Tu mensaje como cliente</Label>
                   <Input value={testInput} onChange={e => setTestInput(e.target.value)} placeholder="Ej: Hola Sam..." className="bg-slate-950 border-slate-800" />
                   <Button onClick={handleRunSimulation} className="w-full bg-indigo-600" disabled={testing}>Simular Respuesta</Button>
                </CardContent>
             </Card>
             <Card className="md:col-span-8 bg-black border-slate-800 p-6 min-h-[300px]">
                {testOutput ? (
                   <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-xs text-white font-bold">侍</div>
                      <div className="bg-red-600/10 border border-red-600/20 p-4 rounded-2xl text-xs text-white whitespace-pre-wrap flex-1">{testOutput}</div>
                   </div>
                ) : <p className="text-slate-600 italic text-center py-20 text-xs">Esperando simulación...</p>}
             </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

const PromptCard = ({ title, icon: Icon, value, onChange }: any) => (
  <Card className="bg-slate-900 border-slate-800 flex flex-col h-full">
    <CardHeader className="pb-3"><CardTitle className="text-sm text-white flex items-center gap-2"><Icon className="w-4 h-4 text-red-500"/> {title}</CardTitle></CardHeader>
    <CardContent className="flex-1"><Textarea value={value} onChange={e => onChange(e.target.value)} className="h-full min-h-[300px] bg-slate-950 border-slate-800 font-mono text-xs" /></CardContent>
  </Card>
);

export default AgentBrain;