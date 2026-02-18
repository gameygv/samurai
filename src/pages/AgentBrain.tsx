import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Save, Bot, Eye, Hammer, ScrollText, 
  ShieldAlert, Database, History, MessageSquare, Gift, RefreshCw, 
  CheckCheck, Zap, FlaskConical, 
  Play, Loader2, Terminal, Info, BrainCircuit, Target, ScanEye,
  AlertTriangle, Phone
} from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const DEFAULTS = {
  'prompt_core': `# ADN SAMURAI - THE ELEPHANT BOWL\nEres el cerrador estrella de The Elephant Bowl. Tu misión es vender los cursos y talleres de Sonoterapia y Cuencos. Tu producto estrella es el "Anticipo para apartar lugar" que vale $1500 MXN. Eres experto en la web https://theelephantbowl.com.`,
  'prompt_technical': `# FORMATO Y CONTROL\nResponde solo texto plano. Usa #STOP para pausar y #START para volver. Genera el link de pago usando el PRODUCT_ID configurado: https://theelephantbowl.com/finalizar-compra/?add-to-cart=[ID]`,
  'prompt_behavior': `# PROTOCOLO DE VENTA\nSaluda con energía. Informa sobre los beneficios de los talleres. Si el cliente duda, recalca que los lugares son limitados y debe "apartar su lugar" ahora mismo con el anticipo de $1500.`,
  'prompt_objections': `# CIERRE Y OBJECIONES\nSi dicen que es caro: "Es una inversión en tu bienestar y formación profesional".\nSi dicen "lo veo luego": "Los cupos se agotan rápido, te recomiendo apartar tu lugar con los $1500 hoy mismo".`,
  'prompt_data_injection': `# PERSONALIZACIÓN\nUsa siempre el nombre del cliente. "Hola {nombre}, qué gusto que te intereses en la Sonoterapia".`,
  'prompt_memory': `# MEMORIA ACTIVA\nRecuerda qué taller le interesó. No repitas información que ya leyó en la web.`,
  'prompt_tone': `# TONO ELEPHANT BOWL\nCálido, místico pero profesional y MUY orientado a resultados (ventas).`,
  'prompt_recommendations': `# UPSELLING\nUna vez que paguen el anticipo, menciona que pueden adquirir sus cuencos con descuento el día del curso.`,
  'prompt_learning_trigger': `# TRIGGER #CIA\nSi recibes #CIA, es una corrección de tu Maestro. Apréndela y aplícala inmediatamente.`,
  'prompt_relearning': `# LECCIONES VALIDADAS\nPrioriza estas reglas sobre todo lo demás.`,
  'prompt_vision_analysis': `# VALIDACIÓN DE PAGOS\nSi envían comprobante, busca: Monto ($1500), Concepto y Fecha.`,
  'prompt_match_validation': `# MATCHING\nConfirma que el depósito sea de $1500 para el apartado de lugar.`,
  'prompt_post_validation': `# POST-PAGO\n"¡Lugar asegurado! Gracias {nombre}. Nos vemos en el taller. Te enviaré los detalles de ubicación ahora."`,
  'prompt_psychology': `# PERFILADO\nIdentifica si es un profesional de salud (pragmático) o alguien buscando sanación (emocional) y adapta el pitch de venta.`,
  'prompt_closing_strategy': `# ESTRATEGIA DE CIERRE\nNo dejes que la charla muera. Si no responde en 24h, haz seguimiento. Tu meta es que haga clic en el link de pago de $1500.`
};

const AgentBrain = () => {
  const [prompts, setPrompts] = useState<Record<string, string>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyVersions, setHistoryVersions] = useState<any[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string>("live");
  const [editorContent, setEditorContent] = useState("");
  
  // Test State
  const [testing, setTesting] = useState(false);
  const [testInput, setTestInput] = useState("");
  const [testPhone, setTestPhone] = useState("5550001234");
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testDebug, setTestDebug] = useState<any>(null);

  useEffect(() => {
    fetchPrompts();
    fetchHistory();
  }, []);

  useEffect(() => {
    if (activeVersionId === 'live') {
        setEditorContent(prompts['prompt_core'] || '');
    }
  }, [prompts, activeVersionId]);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('app_config').select('key, value').eq('category', 'PROMPT');
      if (!error && data && data.length > 0) {
        const dbPrompts: Record<string, string> = {};
        data.forEach((item: any) => { dbPrompts[item.key] = item.value; });
        setPrompts(prev => ({ ...prev, ...dbPrompts }));
      }
    } catch (err) {
      console.error("Error fetching prompts:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data } = await supabase.from('versiones_prompts_aprendidas').select('*').order('created_at', { ascending: false });
      if (data && Array.isArray(data)) {
          setHistoryVersions(data.map(v => ({
              id: v.version_id, version_numero: v.version_numero, created_at: v.created_at, content: v.contenido_nuevo
          })));
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  const handlePromptChange = (key: string, value: string) => {
    setPrompts(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(prompts).map(([key, value]) => ({
        key, value, category: 'PROMPT', updated_at: new Date().toISOString()
      }));
      const { error } = await supabase.from('app_config').upsert(updates);
      if (error) throw error;
      await logActivity({ action: 'UPDATE', resource: 'BRAIN', description: 'Actualización de matriz de prompts para The Elephant Bowl', status: 'OK' });
      toast.success('Cerebro actualizado para ventas.');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRunTest = async () => {
    if (!testInput) return;
    setTesting(true);
    setTestOutput("Generando contexto de prueba...");
    setTestDebug(null);
    
    try {
        const { data, error } = await supabase.functions.invoke('get-samurai-context', {
            body: {
                message: testInput,
                lead_name: "Usuario de Prueba",
                lead_phone: testPhone, 
                platform: "LAB"
            }
        });

        if (error) throw error;
        setTestOutput(data.system_prompt || "No se generó contexto.");
        setTestDebug(data.debug);
        toast.success("Prueba completada.");
    } catch (error: any) {
        setTestOutput(`Error: ${error.message}`);
        toast.error("Error en simulación.");
    } finally {
        setTesting(false);
    }
  };

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-red-600" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Cerebro Samurai: The Elephant Bowl</h1>
            <p className="text-slate-400">Configuración maestra para venta de anticipos ($1500).</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700">
             {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
             Guardar Estrategia
          </Button>
        </div>

        <Tabs defaultValue="part1" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 w-full justify-start overflow-x-auto">
             <TabsTrigger value="part1"><Bot className="w-4 h-4 mr-2" /> 1. Sistema</TabsTrigger>
             <TabsTrigger value="part2"><Database className="w-4 h-4 mr-2" /> 2. Contexto</TabsTrigger>
             <TabsTrigger value="part3"><BrainCircuit className="w-4 h-4 mr-2" /> 3. Psicología</TabsTrigger>
             <TabsTrigger value="part4"><Eye className="w-4 h-4 mr-2" /> 4. Visión</TabsTrigger>
             <TabsTrigger value="part5" className="data-[state=active]:bg-indigo-600"><FlaskConical className="w-4 h-4 mr-2" /> Laboratorio</TabsTrigger>
          </TabsList>

          <TabsContent value="part1" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PromptCard 
                title="1.1 ADN Elephant Bowl" 
                icon={Bot} 
                description="Esencia de la marca y objetivo de venta ($1500)."
                value={prompts['prompt_core']} 
                onChange={(v: string) => handlePromptChange('prompt_core', v)} 
              />
              <PromptCard 
                title="1.2 Generador de Links" 
                icon={Hammer} 
                description="Lógica para crear links de compra directa de WooCommerce."
                value={prompts['prompt_technical']} 
                onChange={(v: string) => handlePromptChange('prompt_technical', v)} 
              />
              <PromptCard 
                title="1.3 Protocolos" 
                icon={ScrollText} 
                description="Saludos y manejo de la urgencia."
                value={prompts['prompt_behavior']} 
                onChange={(v: string) => handlePromptChange('prompt_behavior', v)} 
              />
              <PromptCard 
                title="1.4 Rebatir Objeciones" 
                icon={ShieldAlert} 
                description="Cómo insistir para cerrar el apartado de lugar."
                value={prompts['prompt_objections']} 
                onChange={(v: string) => handlePromptChange('prompt_objections', v)} 
              />
            </div>
          </TabsContent>

          <TabsContent value="part2" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PromptCard 
                title="2.1 Datos Cliente" 
                icon={Database} 
                description="Personalización basada en CRM."
                value={prompts['prompt_data_injection']} 
                onChange={(v: string) => handlePromptChange('prompt_data_injection', v)} 
              />
              <PromptCard 
                title="2.2 Memoria" 
                icon={History} 
                description="Recordar qué talleres visitó en la web."
                value={prompts['prompt_memory']} 
                onChange={(v: string) => handlePromptChange('prompt_memory', v)} 
              />
              <PromptCard 
                title="2.3 Tono" 
                icon={MessageSquare} 
                description="Tono místico pero comercial."
                value={prompts['prompt_tone']} 
                onChange={(v: string) => handlePromptChange('prompt_tone', v)} 
              />
              <PromptCard 
                title="2.4 Upselling" 
                icon={Gift} 
                description="Venta de cuencos post-apartado."
                value={prompts['prompt_recommendations']} 
                onChange={(v: string) => handlePromptChange('prompt_recommendations', v)} 
              />
            </div>
          </TabsContent>

          <TabsContent value="part3" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                 <PromptCard 
                   title="3.1 Perfilado Emocional" 
                   icon={BrainCircuit} 
                   description="Analizar la necesidad de sanación del cliente."
                   value={prompts['prompt_psychology']} 
                   onChange={(v: string) => handlePromptChange('prompt_psychology', v)} 
                   height="h-[120px]"
                 />
              </div>
              <PromptCard 
                title="3.2 Estrategia de Cierre" 
                icon={Target} 
                description="Empujar al link de pago de $1500."
                value={prompts['prompt_closing_strategy']} 
                onChange={(v: string) => handlePromptChange('prompt_closing_strategy', v)} 
              />
              <PromptCard 
                title="3.3 Re-Aprendizaje (#CIA)" 
                icon={RefreshCw} 
                description="Lecciones del Maestro sobre cómo vender mejor."
                value={prompts['prompt_relearning']} 
                onChange={(v: string) => handlePromptChange('prompt_relearning', v)} 
              />
              <PromptCard 
                title="3.4 Trigger #CIA" 
                icon={AlertTriangle} 
                description="Orden de corrección en tiempo real."
                value={prompts['prompt_learning_trigger']} 
                onChange={(v: string) => handlePromptChange('prompt_learning_trigger', v)} 
              />
            </div>
          </TabsContent>

          <TabsContent value="part4" className="mt-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                 <PromptCard 
                   title="4.1 Validación de Comprobantes" 
                   icon={ScanEye} 
                   description="Verificar transferencias de $1500."
                   value={prompts['prompt_vision_analysis']} 
                   onChange={(v: string) => handlePromptChange('prompt_vision_analysis', v)} 
                   height="h-[250px]" 
                 />
              </div>
              <PromptCard 
                title="4.2 Match de Pago" 
                icon={CheckCheck} 
                description="Validar que el monto coincida con el apartado."
                value={prompts['prompt_match_validation']} 
                onChange={(v: string) => handlePromptChange('prompt_match_validation', v)} 
              />
              <PromptCard 
                title="4.3 Confirmación" 
                icon={Zap} 
                description="Mensaje post-pago exitoso."
                value={prompts['prompt_post_validation']} 
                onChange={(v: string) => handlePromptChange('prompt_post_validation', v)} 
              />
            </div>
          </TabsContent>

          <TabsContent value="part5" className="mt-6">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[700px]">
                {/* Historial y Editor (Simplificado para el demo) */}
                <Card className="lg:col-span-12 bg-slate-900 border-slate-800 flex flex-col p-6">
                   <div className="flex justify-between items-center mb-4">
                      <h3 className="text-white font-bold flex items-center gap-2"><FlaskConical className="w-5 h-5 text-indigo-500" /> Laboratorio de Pruebas</h3>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                      <div className="space-y-4">
                         <div className="space-y-2">
                            <Label>Mensaje del Cliente</Label>
                            <Input 
                               placeholder="Ej: Hola, me interesa el taller de cuencos en CDMX..." 
                               value={testInput} 
                               onChange={e => setTestInput(e.target.value)}
                               className="bg-slate-950 border-slate-800"
                            />
                         </div>
                         <Button onClick={handleRunTest} disabled={testing} className="w-full bg-indigo-600">
                            {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Play className="w-4 h-4 mr-2"/>} Simular Respuesta Samurai
                         </Button>
                      </div>
                      <div className="bg-black rounded-lg p-4 font-mono text-xs overflow-y-auto max-h-[400px]">
                         <p className="text-indigo-400 mb-2">// RESULTADO DEL PROMPT MAESTRO:</p>
                         <div className="text-slate-300 whitespace-pre-wrap">{testOutput || "Esperando ejecución..."}</div>
                      </div>
                   </div>
                </Card>
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

const PromptCard = ({ title, icon: Icon, description, value, onChange, height = "h-[180px]" }: any) => (
  <Card className="bg-slate-900 border-slate-800 shadow-xl flex flex-col hover:border-slate-700 transition-all">
    <CardHeader className="pb-3 space-y-1">
      <CardTitle className="text-white flex items-center gap-2 text-sm uppercase tracking-wider">
        <Icon className="w-4 h-4 text-red-500" />
        {title}
      </CardTitle>
      <CardDescription className="text-[11px] leading-relaxed text-slate-500 flex gap-2 italic">
         <Info className="w-3 h-3 shrink-0 mt-0.5 text-indigo-500" />
         {description}
      </CardDescription>
    </CardHeader>
    <CardContent className="pt-0">
      <Textarea 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${height} w-full bg-slate-950/50 border-slate-800 font-mono text-xs text-slate-300 resize-none p-4 custom-scrollbar focus:border-red-600/50`}
        placeholder="Escribe aquí las instrucciones..."
      />
    </CardContent>
  </Card>
);

export default AgentBrain;