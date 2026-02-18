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
  Save, Bot, Eye, Hammer, ScrollText, 
  Database, History, MessageSquare, Gift, RefreshCw, 
  CheckCheck, Zap, FlaskConical, 
  Play, Loader2, Terminal, Info, BrainCircuit, Target, ScanEye,
  AlertTriangle, BookOpen, Sparkles, ShieldAlert, TrendingUp, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const DEFAULTS = {
  'prompt_adn_core': '# ADN CORE\nEres Samurai, un asistente de ventas de elite para The Elephant Bowl. Tu tono es profesional, místico y altamente persuasivo.',
  'prompt_tecnico': '# FÓRMULA TÉCNICA (EXTRACCIÓN DE DATOS)\nResponde siempre en texto plano. Al final de tu respuesta, añade SIEMPRE el bloque de análisis oculto:\n\n[[ANALYSIS: {\n  "mood": "ENOJADO | FELIZ | NEUTRO | PRAGMATICO",\n  "intent": "ALTO | MEDIO | BAJO",\n  "summary": "Breve resumen de la necesidad actual",\n  "detected_name": "Nombre del cliente si lo menciona",\n  "detected_city": "Ubicación si la menciona",\n  "handoff_required": false\n}]]',
  'prompt_protocolos': '# PROTOCOLOS\nSaluda brevemente. No seas redundante. Si el cliente pregunta algo que ya respondiste, sé más directo.',
  'prompt_objeciones': '# MATRIZ DE OBJECIONES\nSi dice "caro" -> Resalta que son piezas únicas hechas a mano por maestros en el Tíbet.',
  'prompt_datos_crm': '# INYECCIÓN DE DATOS\nUsa el nombre del cliente en el saludo si lo tienes disponible en el contexto.',
  'prompt_memoria': '# MEMORIA\nRevisa los últimos 10 mensajes para no repetirte y mantener la coherencia del hilo.',
  'prompt_tono': '# TONO ADAPTATIVO\nUsa emojis de forma moderada. Si el cliente es serio, sé serio. Si es cálido, sé cálido.',
  'prompt_upselling': '# UPSELLING\nSi el cliente pregunta por un cuenco, sugiere siempre un mazo profesional o una funda de transporte.',
  'prompt_perfilado': '# PERFILADO PSICOLÓGICO\nAnaliza si el cliente busca sanación, colección o decoración para adaptar tu discurso.',
  'prompt_estrategia_cierre': '# ESTRATEGIA DE CIERRE Y PRODUCTO ESTRELLA\nTu objetivo principal es que el cliente realice la inscripción a un curso mediante el ANTICIPO.\nSi el cliente muestra interés en cualquier curso, ofrece el link de inscripción directa.\n\nEstructura del Link: {ecommerce_url}/checkout/?add-to-cart={main_product_id}\nMonto: {main_product_price}\n\nInstrucción: Convéncelo de que asegurar su lugar con el anticipo es el primer paso para su transformación.',
  'prompt_reaprendizaje': '# RE-APRENDIZAJE (MANDATORIO)\nLee siempre las instrucciones en #CIA para evitar errores cometidos en el pasado.',
  'prompt_trigger_corregiria': '# TRIGGER APRENDIZAJE\nSi el humano usa el comando #CIA, detente y guarda la nueva instrucción.',
  'prompt_ojo_halcon': '# OJO DE HALCÓN\nAnaliza las fotos de comprobantes buscando el monto, la fecha y el banco emisor.',
  'prompt_match': '# MATCHING\nVerifica que el monto del comprobante coincida con el total de la orden del cliente.',
  'prompt_accion_post': '# POST-VALIDACIÓN\nUna vez validado el pago, agradece y dile que el equipo de logística se contactará pronto.'
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
      if (!error && data && data.length > 0) {
        const dbPrompts: Record<string, string> = { ...DEFAULTS };
        data.forEach((item: any) => { dbPrompts[item.key] = item.value; });
        setPrompts(dbPrompts);
      } else {
        setPrompts(DEFAULTS);
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
      
      await logActivity({ action: 'UPDATE', resource: 'BRAIN', description: 'Cerebro Samurai actualizado (Prompts)', status: 'OK' });
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
            <h1 className="text-3xl font-bold text-white">Cerebro del Samurai</h1>
            <p className="text-slate-400">Configura los pilares de inteligencia para una atención perfecta.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20 px-8">
             {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
             Guardar Cambios
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
                  title="1.1 ADN CORE" 
                  icon={Sparkles} 
                  description="Esencia, nombre y valores del bot."
                  value={prompts['prompt_adn_core']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_adn_core: v})} 
                />
                <PromptCard 
                  title="1.2 TÉCNICO (ANALISIS)" 
                  icon={Terminal} 
                  description="Define cómo la IA debe extraer el nombre, ciudad y estado emocional del cliente en un bloque JSON oculto."
                  value={prompts['prompt_tecnico']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_tecnico: v})} 
                />
                <PromptCard 
                  title="1.3 PROTOCOLOS" 
                  icon={FileText} 
                  description="Comportamiento ante saludos y despedidas."
                  value={prompts['prompt_protocolos']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_protocolos: v})} 
                />
                <PromptCard 
                  title="1.4 OBJECIONES" 
                  icon={ShieldAlert} 
                  description="Estrategias ante dudas o quejas."
                  value={prompts['prompt_objeciones']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_objeciones: v})} 
                />
             </div>
          </TabsContent>

          <TabsContent value="part2" className="mt-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PromptCard 
                  title="2.1 DATOS CRM" 
                  icon={Database} 
                  description="Uso de variables de cliente (Nombre, ID)."
                  value={prompts['prompt_datos_crm']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_datos_crm: v})} 
                />
                <PromptCard 
                  title="2.2 MEMORIA" 
                  icon={History} 
                  description="Reglas de persistencia del hilo de chat."
                  value={prompts['prompt_memoria']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_memoria: v})} 
                />
                <PromptCard 
                  title="2.3 TONO" 
                  icon={MessageSquare} 
                  description="Empatía y estilo de comunicación."
                  value={prompts['prompt_tono']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_tono: v})} 
                />
                <PromptCard 
                  title="2.4 UPSELLING" 
                  icon={TrendingUp} 
                  description="Lógica para ofrecer productos adicionales."
                  value={prompts['prompt_upselling']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_upselling: v})} 
                />
             </div>
          </TabsContent>

          <TabsContent value="part3" className="mt-6 space-y-6">
             <div className="grid grid-cols-1 gap-6">
                <PromptCard 
                  title="3.1 PERFILADO PSICOLÓGICO" 
                  icon={Target} 
                  description="Análisis profundo de la intención del lead."
                  value={prompts['prompt_perfilado']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_perfilado: v})} 
                />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <PromptCard 
                  title="3.2 CIERRE" 
                  icon={Zap} 
                  description="Estrategias de conversión."
                  value={prompts['prompt_estrategia_cierre']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_estrategia_cierre: v})} 
                />
                <PromptCard 
                  title="3.3 RE-APRENDIZAJE" 
                  icon={RefreshCw} 
                  description="Inyección de reglas desde la Bitácora."
                  value={prompts['prompt_reaprendizaje']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_reaprendizaje: v})} 
                />
                <PromptCard 
                  title="3.4 TRIGGER #CIA" 
                  icon={AlertTriangle} 
                  description="Situaciones que requieren corrección humana."
                  value={prompts['prompt_trigger_corregiria']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_trigger_corregiria: v})} 
                />
             </div>
          </TabsContent>

          <TabsContent value="part4" className="mt-6">
             <div className="grid grid-cols-1 gap-6 mb-6">
                <PromptCard 
                  title="4.1 ANÁLISIS DE IMAGEN" 
                  icon={Eye} 
                  description="Cómo interpretar fotos enviadas por el cliente."
                  value={prompts['prompt_ojo_halcon']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_ojo_halcon: v})} 
                />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PromptCard 
                  title="4.2 MATCH PAGOS" 
                  icon={CheckCheck} 
                  description="Validación de comprobantes bancarios."
                  value={prompts['prompt_match']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_match: v})} 
                />
                <PromptCard 
                  title="4.3 CONFIRMACIÓN" 
                  icon={Gift} 
                  description="Respuesta post-validación de pago."
                  value={prompts['prompt_accion_post']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_accion_post: v})} 
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
                      <CardDescription>Visualiza el ensamble final del cerebro.</CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-slate-400">Mensaje de Prueba</Label>
                        <Input 
                           value={testInput} 
                           onChange={e => setTestInput(e.target.value)} 
                           placeholder="Ej: Hola, me llamo Juan y estoy en Madrid..."
                           className="bg-slate-950 border-slate-800 text-white" 
                        />
                      </div>
                      <Button onClick={handleRunTest} className="w-full bg-indigo-600" disabled={testing}>
                         {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Zap className="w-4 h-4 mr-2" />}
                         Ensamblar Prompt
                      </Button>
                   </CardContent>
                </Card>

                <Card className="md:col-span-8 bg-black border-slate-800 shadow-inner">
                   <div className="p-4 flex items-center justify-between border-b border-slate-800">
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Debug: final_system_prompt</span>
                   </div>
                   <CardContent className="p-0">
                      <div className="p-6 font-mono text-[11px] text-slate-400 overflow-y-auto max-h-[500px] leading-relaxed whitespace-pre-wrap">
                         {testOutput || "// Los datos del cliente y los prompts se fusionan aquí para enviarse a la IA."}
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
      </div>
      <CardDescription className="text-slate-500 text-xs">{description}</CardDescription>
    </CardHeader>
    <CardContent className="flex-1">
      <Textarea 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        readOnly={readOnly}
        className={`h-full min-h-[200px] bg-slate-950/50 border-slate-800 font-mono text-xs text-slate-300 leading-relaxed focus-visible:ring-red-600/50 ${readOnly ? 'opacity-70 grayscale' : ''}`}
        placeholder="Instrucciones del Samurai..."
      />
    </CardContent>
  </Card>
);

export default AgentBrain;