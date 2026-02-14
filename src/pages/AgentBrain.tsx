import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Save, Bot, Sparkles, AlertTriangle, Eye, ClipboardList, Hammer, ScrollText, ShieldAlert, Database, History, MessageSquare, Gift, RefreshCw, Server, CheckCircle2, ScanEye, FileText, CheckCheck, ListTodo } from 'lucide-react';
import { toast } from 'sonner';

// --- CONSTANTES PARTE 1 ---
const DEFAULT_CORE_PROMPT = `# 🏯 IDENTIDAD: EL SAMURÁI DEL EQUIPO
Eres el **"Samurái del Equipo"**, la inteligencia avanzada de Tepoz Cuencos.
Misión: Guiar transformación a través del sonido y proteger el legado.
Equipo: Asistes a Anahí (Centro-Sur) y Edith (Bajío-Norte).
Autoridad: 12 años de investigación, The Elephant Bowl.`;

const DEFAULT_TECHNICAL_PROMPT = `### FÓRMULA UNIVERSAL
1. Saludo (Cálido/Reconocimiento)
2. Validación (Empatía)
3. Información (Autoridad/Datos)
4. Recomendación (Personalizada)
5. Cierre (Pregunta abierta)`;

const DEFAULT_BEHAVIOR_PROMPT = `### PROTOCOLOS
- Sabiduría Calma: Seguridad humilde.
- Empatía Perceptiva: Leer emociones.
- Venta Consultiva: Asesorar, no despachar.
- Identidad Humana: "Nosotros", equipo real.
- Modo Siesta: Si humano interviene, PAUSA.`;

const DEFAULT_OBJECTIONS_PROMPT = `### MATRIZ DE OBJECIONES (1.4)

IF objeción = "Es muy caro":
  RESPONDER: Reframe a Inversión.
  "Es una formación profesional certificada que incluye hospedaje y alimentos. Si lo ves como inversión en tu futuro como terapeuta, el valor se multiplica."

IF objeción = "No tengo tiempo / Fechas":
  RESPONDER: Escasez / Lista de espera.
  "Entiendo. Solo abrimos 3 fechas al año para mantener la calidad. ¿Te gustaría asegurar lugar para la siguiente ronda?"

IF objeción = "No confío en depósitos online":
  RESPONDER: Prueba Social + Seguridad.
  "Totalmente comprensible. Puedes ver nuestros testimonios o si prefieres, podemos agendar una videollamada rápida con Anahí para que nos conozcas."`;

// --- CONSTANTES PARTE 2 ---
const DEFAULT_DATA_INJECTION_PROMPT = `# 2.1 INYECCIÓN DE DATOS
Query Supabase: Clientes, Conversaciones, Errores, Promos.
Inject: {{nombre}}, {{ciudad}}, {{perfil}}, {{historial}}.`;

const DEFAULT_MEMORY_PROMPT = `# 2.2 MEMORIA HISTÓRICA
IF cliente_existente: "¡Qué bueno verte de nuevo, {{nombre}}!"
IF nuevo: Crear Lead en Kommo + Supabase.
Detectar Perfil: Pragmático, Emocional, Técnico.`;

const DEFAULT_TONE_PROMPT = `# 2.3 TONO ADAPTATIVO
Pragmático: Datos, tablas, directo.
Emocional: Storytelling, validación, calidez.
Técnico: Metodología, fuentes, detalle.`;

const DEFAULT_RECOMMENDATIONS_PROMPT = `# 2.4 RECOMENDACIONES
Cuotas: 4 sin interés (Pragmático) vs 2 parciales (Emocional).
Promos: Descuento pareja (si menciona "nosotros"), Early Bird.`;

// --- CONSTANTES PARTE 3 ---
const DEFAULT_LEARNING_TRIGGER = `### 3.1 TRIGGER DE APRENDIZAJE (#CORREGIRIA)
SI un operador humano responde a un mensaje del bot con el tag #CORREGIRIA:
1. Capturar el último mensaje generado por la IA (Output Erróneo).
2. Capturar el texto siguiente del humano (Corrección Esperada).
3. Iniciar proceso de vectorización de la corrección.`;

const DEFAULT_ERROR_STORAGE = `### CUANDO SE ACTIVA #CORREGIRIA (Flujo de Datos)

MAKE.COM FLOW:
1. Detecta trigger (#CORREGIRIA o etiqueta Kommo)
2. Extrae Metadata:
   - ID_Lead (cliente)
   - ID_mensaje_original (respuesta errónea de IA)
   - Timestamp del error
   - Nombre quien corrige (Anahí/Edith)

3. Abre Formulario de Clasificación (Interfaz Humana):
   - Input: Descripción breve del error
   - Select: Categoría del error
     [ ] TONE (Tono incorrecto)
     [ ] INFO_FALTANTE (Omitió datos clave)
     [ ] CONTEXTO_PERDIDO (Olvidó info previa)
     [ ] RECOMENDACION_EQUIVOCADA (Mal producto/promo)
     [ ] CIERRE_FALLIDO (No cerró con pregunta)
     [ ] TECNICO (Dato técnico erróneo)
     [ ] OFERTA_INCORRECTA (Precio mal)
     [ ] OTRO
   - Textarea: Corrección Ideal (Qué debió decir)

4. GUARDADO DUAL (Auditoría + Aprendizaje):

   A) GOOGLE SHEET (Para Humanos):
   ┌─────────┬──────────┬────────────────┬──────────────┬──────────────────┐
   │ ID_Lead │ Fecha    │ Categoria      │ Error_IA     │ Correccion       │
   ├─────────┼──────────┼────────────────┼──────────────┼──────────────────┤
   │ 123456  │ 2026-02  │ OFERTA_INCORR  │ "Plan de 4.." │ "Pero ofreciste"  │
   │         │ -14      │                │              │ cuotas, repite"  │
   └─────────┴──────────┴────────────────┴──────────────┴──────────────────┘

   B) SUPABASE (Para la IA - Tabla: aprendizaje_errores):
   {
     "id": UUID,
     "cliente_id": UUID (link a tabla clientes),
     "input_cliente": "es muy caro",
     "respuesta_error": "[Respuesta IA original]",
     "correccion_humana": "[Lo que debería decir]",
     "categoria_error": "TONE",
     "aplicada": false, (flag para validación futura)
     "fecha_correccion": NOW(),
     "prompt_version": "v1.2" (qué versión falló)
   }`;

const DEFAULT_RELEARNING = `### 3.3 REAPRENDIZAJE AUTOMÁTICO
ANTES de generar respuesta:
1. Buscar en vector store: ¿Existe un error similar corregido anteriormente?
2. Si similitud > 0.85:
   - IGNORAR prompt base.
   - APLICAR lógica de la corrección humana almacenada.
   - Log: "Aplicando corrección aprendida ID #1234"`;

const DEFAULT_VALIDATION_IMPROVEMENT = `### 3.4 VALIDACIÓN DE MEJORA
Periodicamente (Cron Job):
- Evaluar tasa de reincidencia de errores por categoría.
- Si una corrección se aplica exitosamente 5 veces sin nuevo #CORREGIRIA:
  - Promover a "Regla Permanente" en el Prompt Base (1.3).`;

// --- CONSTANTES PARTE 4 ---
const DEFAULT_VISION_ANALYSIS = `### 4.1 ANÁLISIS DE COMPROBANTES (OJO DE HALCÓN)
TRIGGER: Imagen recibida.
MODELO: Gemini Vision Pro / GPT-4o.
PROMPT VISIÓN:
"Analiza esta imagen. ¿Es un comprobante bancario o captura de transferencia?
Responde JSON: { es_comprobante: bool, confianza: 0-100 }"`;

const DEFAULT_DATA_EXTRACTION = `### 4.2 EXTRACCIÓN DE DATOS
SI es_comprobante = TRUE:
EXTRAER:
- Monto (numérico)
- Fecha (dd/mm/aaaa)
- Hora
- Banco Origen / Destino
- Concepto/Referencia
- Últimos 4 dígitos cuenta origen`;

const DEFAULT_MATCH_VALIDATION = `### 4.3 VALIDACIÓN DE MATCH
COMPARAR con Kommo/Supabase:
1. ¿Monto coincide con precio esperado del lead?
2. ¿Fecha es reciente (hoy +/- 2 días)?
3. ¿Referencia coincide con nombre o ID?

IF Match > 90%:
  - Auto-confirmar pago.
  - Mover lead a "Inscrito".
  - Enviar bienvenida.
ELSE:
  - Alertar a Humano: "Posible pago de {{nombre}}, validar manual."`;

// --- CONSTANTES PARTE 5 ---
const DEFAULT_PENDING_LIST = `- [ ] Conectar API de Supabase real para inyección de contexto (2.1)
- [ ] Implementar Webhook para detectar #CORREGIRIA en Kommo (3.1)
- [ ] Configurar bucket de almacenamiento para imágenes de comprobantes (4.1)
- [ ] Definir reglas de "Modo Siesta" exactas en el código (Backend)`;

const AgentBrain = () => {
  // State hooks for all prompts
  const [corePrompt, setCorePrompt] = useState(DEFAULT_CORE_PROMPT);
  const [technicalPrompt, setTechnicalPrompt] = useState(DEFAULT_TECHNICAL_PROMPT);
  const [behaviorPrompt, setBehaviorPrompt] = useState(DEFAULT_BEHAVIOR_PROMPT);
  const [objectionsPrompt, setObjectionsPrompt] = useState(DEFAULT_OBJECTIONS_PROMPT);

  const [dataInjectionPrompt, setDataInjectionPrompt] = useState(DEFAULT_DATA_INJECTION_PROMPT);
  const [memoryPrompt, setMemoryPrompt] = useState(DEFAULT_MEMORY_PROMPT);
  const [tonePrompt, setTonePrompt] = useState(DEFAULT_TONE_PROMPT);
  const [recommendationsPrompt, setRecommendationsPrompt] = useState(DEFAULT_RECOMMENDATIONS_PROMPT);

  const [learningTrigger, setLearningTrigger] = useState(DEFAULT_LEARNING_TRIGGER);
  const [errorStorage, setErrorStorage] = useState(DEFAULT_ERROR_STORAGE);
  const [relearning, setRelearning] = useState(DEFAULT_RELEARNING);
  const [validationImprovement, setValidationImprovement] = useState(DEFAULT_VALIDATION_IMPROVEMENT);

  const [visionAnalysis, setVisionAnalysis] = useState(DEFAULT_VISION_ANALYSIS);
  const [dataExtraction, setDataExtraction] = useState(DEFAULT_DATA_EXTRACTION);
  const [matchValidation, setMatchValidation] = useState(DEFAULT_MATCH_VALIDATION);

  const [pendingList, setPendingList] = useState(DEFAULT_PENDING_LIST);

  const handleSave = () => {
    toast.success('Cerebro del Samurai actualizado y guardado.');
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Cerebro del Agente</h1>
            <p className="text-slate-400">Configuración maestra del Samurai basada en el Índice 5.0</p>
          </div>
          <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20">
            <Save className="w-4 h-4 mr-2" />
            Guardar Todo
          </Button>
        </div>

        <Tabs defaultValue="part1" className="w-full">
          <div className="overflow-x-auto pb-2">
            <TabsList className="bg-slate-900 border border-slate-800 p-1 inline-flex min-w-full md:min-w-0">
              <TabsTrigger value="part1" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white whitespace-nowrap">
                <Bot className="w-4 h-4 mr-2" /> Parte 1: Sistema
              </TabsTrigger>
              <TabsTrigger value="part2" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white whitespace-nowrap">
                <Sparkles className="w-4 h-4 mr-2" /> Parte 2: Contexto
              </TabsTrigger>
              <TabsTrigger value="part3" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white whitespace-nowrap">
                <AlertTriangle className="w-4 h-4 mr-2" /> Parte 3: Corrección
              </TabsTrigger>
              <TabsTrigger value="part4" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white whitespace-nowrap">
                <Eye className="w-4 h-4 mr-2" /> Parte 4: Visión
              </TabsTrigger>
              <TabsTrigger value="part5" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white whitespace-nowrap">
                <ClipboardList className="w-4 h-4 mr-2" /> Parte 5: Pendientes
              </TabsTrigger>
            </TabsList>
          </div>

          {/* PARTE 1: SISTEMA PRINCIPAL */}
          <TabsContent value="part1" className="mt-6 space-y-6 animate-in fade-in-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PromptCard title="1.1 ADN Core del Samurai" icon={Bot} color="text-red-500" bg="bg-red-500/10" value={corePrompt} onChange={setCorePrompt} />
              <PromptCard title="1.2 Instrucciones Técnicas" icon={Hammer} color="text-orange-500" bg="bg-orange-500/10" value={technicalPrompt} onChange={setTechnicalPrompt} />
              <PromptCard title="1.3 Protocolos de Comportamiento" icon={ScrollText} color="text-blue-500" bg="bg-blue-500/10" value={behaviorPrompt} onChange={setBehaviorPrompt} />
              <PromptCard title="1.4 Manejo de Objeciones" icon={ShieldAlert} color="text-yellow-500" bg="bg-yellow-500/10" value={objectionsPrompt} onChange={setObjectionsPrompt} />
            </div>
          </TabsContent>

          {/* PARTE 2: CONTEXTO DINÁMICO */}
          <TabsContent value="part2" className="mt-6 space-y-6 animate-in fade-in-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PromptCard title="2.1 Inyección de Datos" icon={Database} color="text-cyan-500" bg="bg-cyan-500/10" value={dataInjectionPrompt} onChange={setDataInjectionPrompt} />
              <PromptCard title="2.2 Memoria Histórica" icon={History} color="text-teal-500" bg="bg-teal-500/10" value={memoryPrompt} onChange={setMemoryPrompt} />
              <PromptCard title="2.3 Tono Adaptativo" icon={MessageSquare} color="text-indigo-500" bg="bg-indigo-500/10" value={tonePrompt} onChange={setTonePrompt} />
              <PromptCard title="2.4 Recomendaciones" icon={Gift} color="text-amber-500" bg="bg-amber-500/10" value={recommendationsPrompt} onChange={setRecommendationsPrompt} />
            </div>
          </TabsContent>

          {/* PARTE 3: CORRECCIÓN (#CORREGIRIA) */}
          <TabsContent value="part3" className="mt-6 space-y-6 animate-in fade-in-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PromptCard title="3.1 Trigger de Aprendizaje" icon={AlertTriangle} color="text-pink-500" bg="bg-pink-500/10" value={learningTrigger} onChange={setLearningTrigger} />
              <PromptCard title="3.2 Almacenamiento de Error" icon={Server} color="text-purple-500" bg="bg-purple-500/10" value={errorStorage} onChange={setErrorStorage} />
              <PromptCard title="3.3 Reaprendizaje Automático" icon={RefreshCw} color="text-green-500" bg="bg-green-500/10" value={relearning} onChange={setRelearning} />
              <PromptCard title="3.4 Validación de Mejora" icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" value={validationImprovement} onChange={setValidationImprovement} />
            </div>
          </TabsContent>

          {/* PARTE 4: VISIÓN (OJO DE HALCÓN) */}
          <TabsContent value="part4" className="mt-6 space-y-6 animate-in fade-in-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                 <PromptCard title="4.1 Análisis de Comprobantes" icon={ScanEye} color="text-sky-500" bg="bg-sky-500/10" value={visionAnalysis} onChange={setVisionAnalysis} height="h-[200px]" />
              </div>
              <PromptCard title="4.2 Extracción de Datos" icon={FileText} color="text-violet-500" bg="bg-violet-500/10" value={dataExtraction} onChange={setDataExtraction} />
              <PromptCard title="4.3 Validación de Match" icon={CheckCheck} color="text-lime-500" bg="bg-lime-500/10" value={matchValidation} onChange={setMatchValidation} />
            </div>
          </TabsContent>

           {/* PARTE 5: PENDIENTES */}
           <TabsContent value="part5" className="mt-6 space-y-6 animate-in fade-in-50">
            <Card className="bg-slate-900 border-slate-800 shadow-xl">
              <CardHeader className="border-b border-slate-800 pb-4">
                <CardTitle className="text-white flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded bg-slate-500/10 flex items-center justify-center text-slate-400">
                    <ListTodo className="w-5 h-5" />
                  </div>
                  Registro de Pendientes y Prioridades
                </CardTitle>
                <CardDescription>Backlog de implementación y mejoras futuras.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <Textarea 
                  value={pendingList}
                  onChange={(e) => setPendingList(e.target.value)}
                  className="min-h-[500px] bg-slate-950/50 border-slate-800 font-mono text-sm text-slate-300 focus:border-slate-500/50 focus:ring-slate-500/20 resize-none p-4 leading-relaxed custom-scrollbar"
                />
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </Layout>
  );
};

// Componente Helper para tarjetas de prompt
const PromptCard = ({ title, icon: Icon, color, bg, value, onChange, height = "min-h-[300px]" }: any) => (
  <Card className="bg-slate-900 border-slate-800 shadow-xl hover:border-slate-700 transition-all duration-300 group">
    <CardHeader className="border-b border-slate-800 pb-4">
      <CardTitle className="text-white flex items-center gap-2 text-base">
        <div className={`w-8 h-8 rounded ${bg} flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
          <Icon className="w-4 h-4" />
        </div>
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-4">
      <Textarea 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${height} bg-slate-950/50 border-slate-800 font-mono text-xs md:text-sm text-slate-300 focus:border-opacity-50 focus:ring-opacity-20 resize-none p-4 leading-relaxed custom-scrollbar`}
      />
    </CardContent>
  </Card>
);

export default AgentBrain;