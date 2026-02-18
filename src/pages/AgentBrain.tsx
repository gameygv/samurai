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
  'prompt_adn_core': '# ADN CORE\nEres Samurai, un asistente de ventas de elite...',
  'prompt_tecnico': '# FÓRMULA TÉCNICA (JSON STRICTO)\nResponde SIEMPRE en este formato JSON exacto...',
  'prompt_protocolos': '# PROTOCOLOS\nSaluda brevemente. No seas redundante...',
  'prompt_objeciones': '# MATRIZ DE OBJECIONES\nSi dice "caro" -> Resalta valor/durabilidad...',
  'prompt_datos_crm': '# INYECCIÓN DE DATOS\nUsa los datos del contexto (Nombre, Ciudad)...',
  'prompt_memoria': '# MEMORIA\nRevisa los últimos mensajes...',
  'prompt_tono': '# TONO ADAPTATIVO\nWhatsApp = Casual, emojis...',
  'prompt_upselling': '# UPSELLING\nSi compra X, ofrece Y con 10% descuento...',
  'prompt_perfilado': '# PERFILADO PSICOLÓGICO\nAnaliza el texto del cliente...',
  'prompt_estrategia_cierre': '# ESTRATEGIA DE CIERRE\nTu objetivo es mover al lead en el Funnel...',
  'prompt_reaprendizaje': '# RE-APRENDIZAJE (MANDATORIO)\nLee las "LECCIONES APRENDIDAS"...',
  'prompt_trigger_corregiria': '# TRIGGER APRENDIZAJE\nSi el humano interviene con #CORREGIRIA...',
  'prompt_ojo_halcon': '# OJO DE HALCÓN\nBusca: Monto total, Fecha, CUIT/Razón Social...',
  'prompt_match': '# MATCHING\nCompara el monto del comprobante con la deuda registrada...',
  'prompt_accion_post': '# POST-VALIDACIÓN\nSi coincide: "Pago recibido, gracias {nombre}..."'
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
            <h1 className="text-3xl font-bold text-white">Cerebro del Samurai</h1>
            <p className="text-slate-400">La inteligencia se divide en 4 pilares maestros. Configúralos con precisión.</p>
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

          {/* PARTE 1: SISTEMA (4 tarjetas en grid 2x2) */}
          <TabsContent value="part1" className="mt-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PromptCard 
                  title="1.1 ADN CORE" 
                  icon={Sparkles} 
                  description="Aquí defines la esencia del bot. Su nombre, su rol como Samurai, y los valores innegociables de la marca."
                  value={prompts['prompt_adn_core']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_adn_core: v})} 
                />
                <PromptCard 
                  title="1.2 TÉCNICO (TEXTO PLANO)" 
                  icon={Terminal} 
                  description="Formato de respuesta: TEXTO PLANO obligatorio. Sin JSON. La IA sabe que debe enviar una imagen, pone el título al final."
                  value={prompts['prompt_tecnico']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_tecnico: v})} 
                />
                <PromptCard 
                  title="1.3 PROTOCOLOS" 
                  icon={FileText} 
                  description="Define cómo reacciona ante saludos, despedidas o situaciones estándar."
                  value={prompts['prompt_protocolos']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_protocolos: v})} 
                />
                <PromptCard 
                  title="1.4 OBJECIONES" 
                  icon={ShieldAlert} 
                  description="Matriz de combate. Instrucciones para la vuelta a dudas sobre precios, tiempos de entrega o competencia."
                  value={prompts['prompt_objeciones']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_objeciones: v})} 
                />
             </div>
          </TabsContent>

          {/* PARTE 2: CONTEXTO (4 tarjetas en grid 2x2) */}
          <TabsContent value="part2" className="mt-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PromptCard 
                  title="2.1 DATOS CRM" 
                  icon={Database} 
                  description="Cómo usar la información de Kommo. Cómo llamar al cliente por su nombre."
                  value={prompts['prompt_datos_crm']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_datos_crm: v})} 
                />
                <PromptCard 
                  title="2.2 MEMORIA" 
                  icon={History} 
                  description="Reglas para que la IA no olvide lo que se dijo hace 5 minutos."
                  value={prompts['prompt_memoria']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_memoria: v})} 
                />
                <PromptCard 
                  title="2.3 TONO" 
                  icon={MessageSquare} 
                  description="Cómo sonar empático si el cliente está frustrado o profesional si el cliente es pragmático."
                  value={prompts['prompt_tono']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_tono: v})} 
                />
                <PromptCard 
                  title="2.4 UPSELLING" 
                  icon={TrendingUp} 
                  description="Lógica comercial. ¿Cuándo debe intentar vender algo más?"
                  value={prompts['prompt_upselling']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_upselling: v})} 
                />
             </div>
          </TabsContent>

          {/* PARTE 3: PSICOLOGÍA (4 tarjetas, 1 ancha arriba + 3 abajo) */}
          <TabsContent value="part3" className="mt-6 space-y-6">
             <div className="grid grid-cols-1 gap-6">
                <PromptCard 
                  title="3.1 PERFILADO PSICOLÓGICO" 
                  icon={Target} 
                  description="Instrucciones para que la IA analice la personalidad del cliente basándose en su forma de escribir."
                  value={prompts['prompt_perfilado']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_perfilado: v})} 
                />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <PromptCard 
                  title="3.2 ESTRATEGIA DE CIERRE" 
                  icon={Zap} 
                  description="Cómo mover al lead a través del embudo. Identificar en qué etapa está y empujarlo a la siguiente."
                  value={prompts['prompt_estrategia_cierre']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_estrategia_cierre: v})} 
                />
                <PromptCard 
                  title="3.3 RE-APRENDIZAJE (CORRECCIONES)" 
                  icon={RefreshCw} 
                  description="Cómo integrar las nuevas reglas de oro que tú validas en el Learning Log."
                  value={prompts['prompt_reaprendizaje']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_reaprendizaje: v})} 
                />
                <PromptCard 
                  title="3.4 TRIGGER #CORREGIRIA" 
                  icon={AlertTriangle} 
                  description="Define qué situaciones activan el reporte de error manual."
                  value={prompts['prompt_trigger_corregiria']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_trigger_corregiria: v})} 
                />
             </div>
          </TabsContent>

          {/* PARTE 4: VISIÓN (3 tarjetas) */}
          <TabsContent value="part4" className="mt-6">
             <div className="grid grid-cols-1 gap-6 mb-6">
                <PromptCard 
                  title="4.1 OJO DE HALCÓN (ANÁLISIS DE IMAGEN)" 
                  icon={Eye} 
                  description="La joya de la corona. Define cómo la IA debe 'mirar' una foto."
                  value={prompts['prompt_ojo_halcon']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_ojo_halcon: v})} 
                />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PromptCard 
                  title="4.2 MATCH" 
                  icon={CheckCheck} 
                  description="Cómo comparar el texto extraído de la imagen con la deuda real del cliente."
                  value={prompts['prompt_match']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_match: v})} 
                />
                <PromptCard 
                  title="4.3 ACCIÓN POST" 
                  icon={Gift} 
                  description="Qué hacer inmediatamente después de validar un pago. Confirmar o pedir a un humano."
                  value={prompts['prompt_accion_post']} 
                  onChange={(v:any) => setPrompts({...prompts, prompt_accion_post: v})} 
                />
             </div>
          </TabsContent>
          
          {/* PARTE 5: LABORATORIO */}
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
        className={`h-full min-h-[200px] bg-slate-950/50 border-slate-800 font-mono text-xs text-slate-300 leading-relaxed focus-visible:ring-red-600/50 ${readOnly ? 'opacity-70 grayscale' : ''}`}
        placeholder="Ingresa las instrucciones aquí..."
      />
    </CardContent>
  </Card>
);

export default AgentBrain;