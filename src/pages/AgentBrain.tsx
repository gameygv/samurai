import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Save, Bot, Sparkles, AlertTriangle, Eye, Hammer, ScrollText, 
  ShieldAlert, Database, History, MessageSquare, Gift, RefreshCw, Server, 
  CheckCircle2, ScanEye, CheckCheck, Zap, GitBranch, FlaskConical, 
  Play, RotateCcw, Loader2, Terminal, Info, BrainCircuit, Target
} from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

const DEFAULTS = {
  'prompt_core': `# ADN CORE\nEres Samurai, un asistente de ventas de elite. Tu misión es filtrar curiosos, calificar leads y cerrar ventas. Eres directo, eficiente pero educado.`,
  'prompt_technical': `# FÓRMULA TÉCNICA\nResponde SIEMPRE en formato JSON estricto para que el sistema pueda leer tu respuesta y actualizar el CRM.\nEstructura:\n{\n  "reply": "Tu respuesta al cliente aquí (usa emojis, párrafos cortos)",\n  "lead_analysis": {\n    "mood": "ENOJADO | NEUTRO | FELIZ | PRAGMATICO",\n    "buying_intent": "BAJO | MEDIO | ALTO",\n    "summary": "Resumen de 1 linea de lo que quiere"\n  }\n}`,
  'prompt_behavior': `# PROTOCOLOS\nSaluda brevemente. No seas redundante. Si el cliente pregunta precio, dalo y termina con una pregunta de cierre.`,
  'prompt_objections': `# MATRIZ DE OBJECIONES\nSi dice "caro" -> Resalta valor/durabilidad.\nSi dice "lo pienso" -> Pregunta qué le detiene.\nSi dice "competencia" -> No hables mal, resalta nuestra garantía.`,
  'prompt_data_injection': `# INYECCIÓN DE DATOS\nUsa los datos del contexto (Nombre, Ciudad) para personalizar. "Hola {nombre}" es mejor que "Hola".`,
  'prompt_memory': `# MEMORIA\nRevisa los últimos mensajes. Si ya te dijo su nombre, no lo preguntes. Si ya le diste el precio, no lo repitas a menos que lo pida.`,
  'prompt_tone': `# TONO ADAPTATIVO\nWhatsApp = Casual, emojis, audios (simulados con texto).\nCorreo = Formal, estructurado.`,
  'prompt_recommendations': `# UPSELLING\nSi compra X, ofrece Y con un 10% de descuento. Solo ofrece si la intención de compra es ALTA.`,
  'prompt_learning_trigger': `# TRIGGER APRENDIZAJE\nSi el humano interviene con #CORREGIRIA, analiza su feedback y ajusta tu comportamiento futuro.`,
  'prompt_error_storage': `# ERROR LOGGING\nNo aplica al prompt de sistema directo, uso interno.`,
  'prompt_relearning': `# RE-APRENDIZAJE (MANDATORIO)\nLee las "LECCIONES APRENDIDAS" al final de este prompt. Son correcciones de errores pasados. TIENEN PRIORIDAD sobre cualquier otra instrucción.`,
  'prompt_validation_improvement': `# VALIDACIÓN\nEl objetivo es reducir la fricción. Menos mensajes para llegar a la venta = Mejor desempeño.`,
  'prompt_vision_analysis': `# OJO DE HALCÓN\nBusca: Monto total, Fecha, CUIT/Razón Social. Si la imagen es borrosa, pide otra educadamente.`,
  'prompt_match_validation': `# MATCHING\nCompara el monto del comprobante con la deuda registrada. Margen de error aceptable: $5 pesos.`,
  'prompt_post_validation': `# POST-VALIDACIÓN\nSi coincide: "Pago recibido, gracias {nombre}. Tu pedido sale el {fecha}".`,
  'prompt_psychology': `# PERFILADO PSICOLÓGICO\nAnaliza el texto del cliente. \n- Usa muchas exclamaciones? -> EMOCIONAL.\n- Pregunta datos técnicos? -> PRAGMÁTICO.\n- Se queja del tiempo? -> IMPACIENTE.\nAdapta tu respuesta a su perfil. Al Pragmático dale datos, al Emocional dale experiencia.`,
  'prompt_closing_strategy': `# ESTRATEGIA DE CIERRE\nTu objetivo es mover al lead en el Funnel. \nEtapa Inicial -> Calificar.\nEtapa Interés -> Cotizar.\nEtapa Cierre -> Pedir pago.\nIdentifica en qué etapa está y empújalo a la siguiente.`
};

const AgentBrain = () => {
  const [prompts, setPrompts] = useState<Record<string, string>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyVersions, setHistoryVersions] = useState<any[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string>("live");
  const [editorContent, setEditorContent] = useState("");
  const [testing, setTesting] = useState(false);
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState<string | null>(null);

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
    const { data, error } = await supabase.from('app_config').select('key, value').eq('category', 'PROMPT');
    if (!error && data && data.length > 0) {
      const dbPrompts: Record<string, string> = {};
      data.forEach((item: any) => { dbPrompts[item.key] = item.value; });
      setPrompts(prev => ({ ...prev, ...dbPrompts }));
    }
    setLoading(false);
  };

  const fetchHistory = async () => {
    const { data } = await supabase.from('versiones_prompts_aprendidas').select('*').order('created_at', { ascending: false });
    if (data) {
        setHistoryVersions(data.map(v => ({
            id: v.version_id, version_numero: v.version_numero, created_at: v.created_at, content: v.contenido_nuevo
        })));
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
      await logActivity({ action: 'UPDATE', resource: 'BRAIN', description: 'Actualización de matriz de prompts', status: 'OK' });
      toast.success('Configuración guardada.');
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
    
    try {
        // Invocamos la Edge Function REAL
        const { data, error } = await supabase.functions.invoke('get-samurai-context', {
            body: {
                message: testInput,
                lead_name: "Usuario de Prueba (Lab)",
                platform: "TEST_RUNNER"
            }
        });

        if (error) throw error;

        // Mostramos el System Prompt generado para que el usuario verifique si se inyectaron las correcciones
        setTestOutput(data.system_prompt || "No se generó contexto.");
        toast.success("Contexto generado exitosamente. Verifica si incluye las lecciones aprendidas.");

    } catch (error: any) {
        setTestOutput(`Error: ${error.message}`);
        toast.error("Error al invocar Edge Function.");
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
            <h1 className="text-3xl font-bold text-white mb-2">Cerebro del Samurai</h1>
            <p className="text-slate-400">La inteligencia se divide en 4 pilares maestros. Configúralos con precisión.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700">
             {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
             Guardar Cambios
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

          {/* PARTE 1: SISTEMA */}
          <TabsContent value="part1" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PromptCard 
                title="1.1 ADN Core" 
                icon={Bot} 
                description="Aquí defines la esencia del bot. Su nombre, su rol como Samurai, y los valores innegociables de la marca. Es el pilar fundamental que guía todas las respuestas."
                value={prompts['prompt_core']} 
                onChange={(v: string) => handlePromptChange('prompt_core', v)} 
              />
              <PromptCard 
                title="1.2 Técnico (Estructura JSON)" 
                icon={Hammer} 
                description="CRÍTICO: Define que la respuesta debe ser un JSON para poder extraer datos del CRM. No cambies la estructura JSON a menos que sepas lo que haces."
                value={prompts['prompt_technical']} 
                onChange={(v: string) => handlePromptChange('prompt_technical', v)} 
              />
              <PromptCard 
                title="1.3 Protocolos" 
                icon={ScrollText} 
                description="Define cómo reacciona ante saludos, despedidas o situaciones estándar. Es el manual de 'buenas costumbres' del Samurai."
                value={prompts['prompt_behavior']} 
                onChange={(v: string) => handlePromptChange('prompt_behavior', v)} 
              />
              <PromptCard 
                title="1.4 Objeciones" 
                icon={ShieldAlert} 
                description="Matriz de combate. Instrucciones para dar la vuelta a dudas sobre precios, tiempos de entrega o competencia."
                value={prompts['prompt_objections']} 
                onChange={(v: string) => handlePromptChange('prompt_objections', v)} 
              />
            </div>
          </TabsContent>

          {/* PARTE 2: CONTEXTO */}
          <TabsContent value="part2" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PromptCard 
                title="2.1 Datos CRM" 
                icon={Database} 
                description="Cómo usar la información de Kommo. Cómo llamar al cliente por su nombre y cómo interpretar sus etiquetas de interés."
                value={prompts['prompt_data_injection']} 
                onChange={(v: string) => handlePromptChange('prompt_data_injection', v)} 
              />
              <PromptCard 
                title="2.2 Memoria" 
                icon={History} 
                description="Reglas para que la IA no olvide lo que se dijo hace 5 minutos. Evita que el Samurai pregunte cosas que el cliente ya respondió."
                value={prompts['prompt_memory']} 
                onChange={(v: string) => handlePromptChange('prompt_memory', v)} 
              />
              <PromptCard 
                title="2.3 Tono" 
                icon={MessageSquare} 
                description="Cómo sonar empático si el cliente está frustrado o profesional si el cliente es pragmático."
                value={prompts['prompt_tone']} 
                onChange={(v: string) => handlePromptChange('prompt_tone', v)} 
              />
              <PromptCard 
                title="2.4 Upselling" 
                icon={Gift} 
                description="Lógica comercial. ¿Cuándo debe intentar vender algo más? Define qué productos son complementarios."
                value={prompts['prompt_recommendations']} 
                onChange={(v: string) => handlePromptChange('prompt_recommendations', v)} 
              />
            </div>
          </TabsContent>

          {/* PARTE 3: PSICOLOGIA Y APRENDIZAJE */}
          <TabsContent value="part3" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                 <PromptCard 
                   title="3.1 Perfilado Psicológico" 
                   icon={BrainCircuit} 
                   description="Instrucciones para que la IA analice la personalidad del cliente basándose en su forma de escribir. Esto alimenta la base de datos de Leads para futuros análisis."
                   value={prompts['prompt_psychology']} 
                   onChange={(v: string) => handlePromptChange('prompt_psychology', v)} 
                   height="h-[120px]"
                 />
              </div>
              <PromptCard 
                title="3.2 Estrategia de Cierre" 
                icon={Target} 
                description="Cómo mover al lead a través del embudo. Identificar si está 'tibio' o 'caliente' y aplicar presión adecuada."
                value={prompts['prompt_closing_strategy']} 
                onChange={(v: string) => handlePromptChange('prompt_closing_strategy', v)} 
              />
              <PromptCard 
                title="3.3 Re-Aprendizaje (Correcciones)" 
                icon={RefreshCw} 
                description="Cómo integrar las nuevas reglas de oro que tú validas en el Learning Log. Esto es lo que hace que el sistema mejore solo."
                value={prompts['prompt_relearning']} 
                onChange={(v: string) => handlePromptChange('prompt_relearning', v)} 
              />
              <PromptCard 
                title="3.4 Trigger #CORREGIRIA" 
                icon={AlertTriangle} 
                description="Define qué situaciones activan el reporte de error manual."
                value={prompts['prompt_learning_trigger']} 
                onChange={(v: string) => handlePromptChange('prompt_learning_trigger', v)} 
              />
            </div>
          </TabsContent>

          {/* PARTE 4: VISIÓN */}
          <TabsContent value="part4" className="mt-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                 <PromptCard 
                   title="4.1 Ojo de Halcón (Análisis de Imagen)" 
                   icon={ScanEye} 
                   description="La joya de la corona. Define cómo la IA debe 'mirar' una foto. Debe buscar montos, CUITs, logos de bancos y fechas. Si falta algo, debe saber pedirlo educadamente."
                   value={prompts['prompt_vision_analysis']} 
                   onChange={(v: string) => handlePromptChange('prompt_vision_analysis', v)} 
                   height="h-[250px]" 
                 />
              </div>
              <PromptCard 
                title="4.2 Match" 
                icon={CheckCheck} 
                description="Cómo comparar el texto extraído de la imagen con la deuda real del cliente en el CRM."
                value={prompts['prompt_match_validation']} 
                onChange={(v: string) => handlePromptChange('prompt_match_validation', v)} 
              />
              <PromptCard 
                title="4.3 Acción Post" 
                icon={Zap} 
                description="Qué hacer inmediatamente después de validar un pago. Confirmar, enviar recibo o pasar a un humano."
                value={prompts['prompt_post_validation']} 
                onChange={(v: string) => handlePromptChange('prompt_post_validation', v)} 
              />
            </div>
          </TabsContent>

          {/* PARTE 5: LABORATORIO (Versiones & Test) */}
          <TabsContent value="part5" className="mt-6">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[700px]">
                <Card className="lg:col-span-3 bg-slate-900 border-slate-800 flex flex-col overflow-hidden">
                   <div className="p-4 bg-slate-950/50 border-b border-slate-800 font-bold text-xs uppercase tracking-widest text-slate-500">Historial de Versiones</div>
                   <div className="flex-1 overflow-y-auto">
                      <div 
                         className={`p-4 border-b border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors ${activeVersionId === 'live' ? 'bg-red-600/10 border-l-4 border-red-600' : ''}`}
                         onClick={() => { setActiveVersionId('live'); setEditorContent(prompts['prompt_core'] || ''); }}
                      >
                         <div className="text-white font-bold">VERSION LIVE</div>
                         <div className="text-[10px] text-green-500 flex items-center gap-1 mt-1"><CheckCheck className="w-3 h-3"/> En Producción</div>
                      </div>
                      {historyVersions.map(v => (
                         <div 
                            key={v.id} 
                            className={`p-4 border-b border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors ${activeVersionId === v.id ? 'bg-indigo-900/20 border-l-4 border-indigo-600' : ''}`}
                            onClick={() => { setActiveVersionId(v.id); setEditorContent(v.content); }}
                         >
                            <div className="text-slate-300 font-mono text-xs">{v.version_numero}</div>
                            <div className="text-[10px] text-slate-500 mt-1">{new Date(v.created_at).toLocaleDateString()}</div>
                         </div>
                      ))}
                   </div>
                </Card>

                <Card className="lg:col-span-6 bg-slate-900 border-slate-800 flex flex-col">
                   <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                      <h3 className="text-white font-bold flex items-center gap-2">
                         {activeVersionId === 'live' ? 'Editor Principal' : `Visor: ${historyVersions.find(v => v.id === activeVersionId)?.version_numero}`}
                      </h3>
                      {activeVersionId !== 'live' && (
                         <Button size="sm" onClick={() => { setPrompts(p => ({...p, 'prompt_core': editorContent})); setActiveVersionId('live'); toast.success('Cargado en Editor'); }} className="h-7 text-[10px] bg-indigo-600">Restaurar en Editor</Button>
                      )}
                   </div>
                   <Textarea 
                      className="flex-1 bg-transparent border-0 text-slate-300 font-mono text-xs p-6 resize-none focus-visible:ring-0 leading-relaxed"
                      value={editorContent}
                      onChange={e => { setEditorContent(e.target.value); if(activeVersionId === 'live') handlePromptChange('prompt_core', e.target.value); }}
                      readOnly={activeVersionId !== 'live'}
                   />
                </Card>

                <Card className="lg:col-span-3 bg-black border-slate-800 flex flex-col">
                   <div className="p-4 border-b border-slate-800 bg-slate-900/50"><h3 className="text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2"><Terminal className="w-3 h-3 text-green-500" /> Test Runner</h3></div>
                   <div className="flex-1 p-4 overflow-y-auto space-y-4">
                      {testOutput ? (
                         <div className="bg-slate-900 p-3 rounded border border-slate-700">
                            <p className="text-[10px] text-indigo-400 font-bold uppercase mb-2 flex items-center gap-1"><Bot className="w-3 h-3"/> System Prompt Generado:</p>
                            <p className="text-[10px] text-slate-300 font-mono leading-relaxed whitespace-pre-wrap h-64 overflow-y-auto custom-scrollbar">{testOutput}</p>
                         </div>
                      ) : (
                         <div className="h-32 border border-dashed border-slate-800 rounded flex items-center justify-center text-slate-600 text-[10px] italic">Resultado del test...</div>
                      )}
                   </div>
                   <div className="p-4 border-t border-slate-800 space-y-3">
                      <Input placeholder="Input de prueba..." value={testInput} onChange={e => setTestInput(e.target.value)} className="bg-slate-950 border-slate-800 text-xs" />
                      <Button onClick={handleRunTest} disabled={testing} className="w-full bg-green-600 hover:bg-green-700 h-9">
                         {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 mr-2" />} Probar Prompt
                      </Button>
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
        placeholder="Escribe aquí las instrucciones maestras..."
      />
    </CardContent>
  </Card>
);

export default AgentBrain;