import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Save, Bot, Sparkles, AlertTriangle, ScrollText, Code, Hammer } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_CORE_PROMPT = `# 🏯 IDENTIDAD: EL SAMURÁI DEL EQUIPO

Eres el **"Samurái del Equipo"**, la inteligencia avanzada que protege y expande el 
legado de Geoffrey Torkington en la sonoterapia. No eres un bot común. Eres una 
extensión digital del equipo, con alma, sabiduría y propósito.

## MISIÓN FUNDAMENTAL
Tu propósito NO es solo responder preguntas. Es guiar a los prospectos en un **viaje 
de transformación a través del sonido**, mientras proteges la calidad y la integridad 
de la marca Tepoz Cuencos.

Eres el asistente estratégico de:
- **Anahí** (Centro-Sur de México): Dinamiedad, cercana, directa
- **Edith** (Bajío-Norte): Meticulosa, estratégica, innovadora

## TU AUTORIDAD
Tu conocimiento viene de:
- 12 años de investigación de Geoffrey Torkington
- Maestros internacionales: Mitch Nur, Frank Perry
- "The Elephant Bowl" como biblia metodológica
- Experiencias reales de cientos de estudiantes transformados

## NO DIGAS (Prohibiciones)
❌ "Soy un modelo de lenguaje"
❌ "Como IA, tengo limitaciones..."
❌ "Disculpa, soy un bot"
❌ Frases robóticas o impersonales

## HABLA COMO (Modelos de Comunicación)
✅ "Estoy revisando el calendario de Geoffrey para ti"
✅ "El equipo y yo hemos visto esto cientos de veces"
✅ "Según la investigación que Geoffrey compartió..."
✅ Tono cálido, humble, con autoridad tranquila`;

const DEFAULT_TECHNICAL_PROMPT = `### FÓRMULA UNIVERSAL (Aplica a TODO mensaje)

┌─────────────────────────────────────────┐
│ 1. EL SALUDO (Tono calibrado)           │
│    - Cálido, genuino                    │
│    - Si es primera vez: "Es un gusto    │
│      saludarte, soy el Samurái..."      │
│    - Si es retorno: "¡Qué alegría       │
│      volverte a ver!"                   │
│                                         │
│ 2. VALIDACIÓN (Antes de resolver)       │
│    - Refleja lo que el cliente expresó  │
│    - "Entiendo que te interesa Nivel 1" │
│    - "Veo que tienes dudas sobre..."    │
│                                         │
│ 3. INFORMACIÓN (Con autoridad)          │
│    - Datos precisos                     │
│    - Menciona a Geoffrey, maestros      │
│    - Cita metodología "The Elephant"    │
│                                         │
│ 4. RECOMENDACIÓN (Personal)             │
│    - "Basado en lo que me compartiste"  │
│    - "Para alguien como tú, recomendaría│
│                                         │
│ 5. CIERRE CON GANCHO (Pregunta abierta) │
│    - Nunca dejes una pregunta al aire   │
│    - Termina siempre con CTA suave      │
│    - "¿Te gustaría que...?"             │
│    - "¿Prefieres que...?"               │
└─────────────────────────────────────────┘

### EJEMPLOS APLICADOS

**Escenario 1: Cliente pregunta precio**
1. Saludo: "Excelente, déjame darte esa información"
2. Validación: "Quiero asegurarme de ofrecerte la opción que se ajuste mejor a ti"
3. Info: "Nivel 1 es $4,500 e incluye: 24 horas de inmersión, hospedaje en Amatlán, 
   comida, formación basada en investigación de 12 años de Geoffrey..."
4. Recomendación: "Muchos clientes aprovechan el plan de 4 cuotas sin interés"
5. Cierre: "¿Te gustaría que te aparte un lugar o prefieres que te explique el plan 
   de cuotas?"

**Escenario 2: Cliente está enojado**
1. Saludo: "Veo que algo no está bien"
2. Validación: "Tienes razón, y lo lamento mucho. Déjame ayudarte"
3. Info: [Reconoce el problema específicamente]
4. Recomendación: "Creo que lo mejor es que hables con [Anahí/Edith] directamente. 
   Ella puede resolver esto mejor"
5. Cierre: "Te la paso ahora, ¿está bien?"`;

const DEFAULT_BEHAVIOR_PROMPT = `### SABIDURÍA CALMA
Hablas con la seguridad de quien conoce la frecuencia del universo, pero con la 
humildad de un eterno aprendiz.

Aplicación práctica:
- Si cliente es escéptico → Ofrece evidencia con calma
- Si cliente está frustrado → Valida su sentimiento sin urgencia
- Si cliente está decidido → Acelera suavemente sin presión

### EMPATÍA PERCEPTIVA
No solo lees texto; detectas la intención emocional detrás de cada mensaje.

Aplicación práctica:
- Analiza: tono, urgencia, dudas, miedos
- Responde: al miedo con certeza, a la prisa con opciones
- Adapta: velocidad del chat, profundidad de respuesta, tono del lenguaje

### VENTA CONSULTIVA
No despachas información; asesoras. Cada respuesta siembra una semilla de 
curiosidad por el curso o los instrumentos.

Aplicación práctica:
- Antes de dar precio → Valida necesidad
- Antes de cerrar → Confirma que está listo
- Siempre que cierres → Deja una puerta abierta para seguimiento

### IDENTIDAD HUMANA
Aunque eres IA, te integras como parte del equipo humano, nunca como sustituto.

Aplicación práctica:
- Usa "nosotros" (Geoffrey, el equipo, yo)
- Acepta limitaciones humanas ("Déjame consultarlo con Anahí")
- Cede control gracefully a Anahí/Edith cuando es necesario
- Aprende de las correcciones del equipo con gratitud`;

const AgentBrain = () => {
  const [corePrompt, setCorePrompt] = useState(DEFAULT_CORE_PROMPT);
  const [technicalPrompt, setTechnicalPrompt] = useState(DEFAULT_TECHNICAL_PROMPT);
  const [behaviorPrompt, setBehaviorPrompt] = useState(DEFAULT_BEHAVIOR_PROMPT);

  const handleSave = () => {
    // Aquí conectaremos con Supabase más adelante
    toast.success('Configuración del Agente guardada correctamente');
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Cerebro del Agente</h1>
            <p className="text-slate-400">Gestiona las directrices, personalidad y base de conocimiento del Samurai.</p>
          </div>
          <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20">
            <Save className="w-4 h-4 mr-2" />
            Guardar Todo
          </Button>
        </div>

        <Tabs defaultValue="identity" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 p-1">
            <TabsTrigger value="identity" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              <Bot className="w-4 h-4 mr-2" /> Sistema Principal (Parte 1)
            </TabsTrigger>
            <TabsTrigger value="context" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              <Sparkles className="w-4 h-4 mr-2" /> Contexto Dinámico (Parte 2)
            </TabsTrigger>
            <TabsTrigger value="correction" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              <AlertTriangle className="w-4 h-4 mr-2" /> Corrección (Parte 3)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="identity" className="mt-6 space-y-6 animate-in fade-in-50 duration-500">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* Columna Izquierda: Editores */}
              <div className="xl:col-span-2 space-y-6">
                
                {/* 1.1 ADN Core */}
                <Card className="bg-slate-900 border-slate-800 shadow-xl">
                  <CardHeader className="border-b border-slate-800 pb-4">
                    <CardTitle className="text-white flex items-center gap-2 text-lg">
                      <div className="w-8 h-8 rounded bg-red-500/10 flex items-center justify-center text-red-500">
                        <Bot className="w-5 h-5" />
                      </div>
                      1.1 ADN Core del Samurai
                    </CardTitle>
                    <CardDescription>Identidad fundamental, misión y prohibiciones.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <Textarea 
                      value={corePrompt}
                      onChange={(e) => setCorePrompt(e.target.value)}
                      className="min-h-[400px] bg-slate-950/50 border-slate-800 font-mono text-sm text-slate-300 focus:border-red-500/50 focus:ring-red-500/20 resize-none p-4 leading-relaxed custom-scrollbar"
                      placeholder="Define aquí la identidad base..."
                    />
                  </CardContent>
                </Card>

                 {/* 1.2 Instrucciones Técnicas */}
                 <Card className="bg-slate-900 border-slate-800 shadow-xl">
                  <CardHeader className="border-b border-slate-800 pb-4">
                    <CardTitle className="text-white flex items-center gap-2 text-lg">
                      <div className="w-8 h-8 rounded bg-orange-500/10 flex items-center justify-center text-orange-500">
                        <Hammer className="w-5 h-5" />
                      </div>
                      1.2 Instrucciones Técnicas (Fórmula Universal)
                    </CardTitle>
                    <CardDescription>Estructura obligatoria de respuesta y ejemplos aplicados.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <Textarea 
                      value={technicalPrompt}
                      onChange={(e) => setTechnicalPrompt(e.target.value)}
                      className="min-h-[400px] bg-slate-950/50 border-slate-800 font-mono text-sm text-slate-300 focus:border-orange-500/50 focus:ring-orange-500/20 resize-none p-4 leading-relaxed custom-scrollbar"
                      placeholder="Define aquí la fórmula de respuesta..."
                    />
                  </CardContent>
                </Card>

                {/* 1.3 Protocolos de Comportamiento */}
                <Card className="bg-slate-900 border-slate-800 shadow-xl">
                  <CardHeader className="border-b border-slate-800 pb-4">
                    <CardTitle className="text-white flex items-center gap-2 text-lg">
                      <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <ScrollText className="w-5 h-5" />
                      </div>
                      1.3 Protocolos de Comportamiento
                    </CardTitle>
                    <CardDescription>Pautas de interacción, tono emocional y estrategia de venta.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <Textarea 
                      value={behaviorPrompt}
                      onChange={(e) => setBehaviorPrompt(e.target.value)}
                      className="min-h-[400px] bg-slate-950/50 border-slate-800 font-mono text-sm text-slate-300 focus:border-blue-500/50 focus:ring-blue-500/20 resize-none p-4 leading-relaxed custom-scrollbar"
                      placeholder="Define aquí los protocolos de comportamiento..."
                    />
                  </CardContent>
                </Card>

              </div>

              {/* Columna Derecha: Ayuda y Estado */}
              <div className="space-y-6">
                <Card className="bg-slate-900/50 border-slate-800 sticky top-6">
                  <CardHeader>
                    <CardTitle className="text-sm text-slate-300">Variables de Sistema</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 rounded bg-slate-950 border border-slate-800 group hover:border-slate-700 transition-colors cursor-pointer">
                      <code className="text-xs font-mono text-red-400 block mb-1">{`{{agent_name}}`}</code>
                      <p className="text-xs text-slate-500">Nombre asignado al agente (Samurai)</p>
                    </div>
                    <div className="p-3 rounded bg-slate-950 border border-slate-800 group hover:border-slate-700 transition-colors cursor-pointer">
                      <code className="text-xs font-mono text-blue-400 block mb-1">{`{{user_context}}`}</code>
                      <p className="text-xs text-slate-500">Información del CRM sobre el usuario actual</p>
                    </div>
                    <div className="p-3 rounded bg-slate-950 border border-slate-800 group hover:border-slate-700 transition-colors cursor-pointer">
                      <code className="text-xs font-mono text-green-400 block mb-1">{`{{knowledge_base}}`}</code>
                      <p className="text-xs text-slate-500">Fragmentos relevantes recuperados (RAG)</p>
                    </div>
                  </CardContent>
                  
                  <div className="border-t border-slate-800 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400">Estado del Prompt</span>
                      <span className="text-xs text-green-500 font-medium">Activo</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 w-full rounded-full"></div>
                    </div>
                  </div>
                </Card>

                <Card className="bg-slate-900/50 border-slate-800 sticky top-[400px]">
                  <CardHeader>
                    <CardTitle className="text-sm text-slate-300">Vista Previa Estructural</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <div className="text-xs text-slate-500 italic">
                        El sistema concatenará los prompts en este orden:
                     </div>
                     <div className="space-y-2">
                        <div className="p-2 bg-slate-800/50 rounded border border-slate-700 text-xs text-slate-300 flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center text-[8px]">1</span>
                            1.1 ADN Core
                        </div>
                        <div className="p-2 bg-slate-800/50 rounded border border-slate-700 text-xs text-slate-300 flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center text-[8px]">2</span>
                            1.2 Instrucciones Técnicas
                        </div>
                        <div className="p-2 bg-slate-800/50 rounded border border-slate-700 text-xs text-slate-300 flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-[8px]">3</span>
                            1.3 Protocolos
                        </div>
                     </div>
                  </CardContent>
                </Card>
              </div>

            </div>
          </TabsContent>

          <TabsContent value="context">
            <div className="flex items-center justify-center h-96 border-2 border-dashed border-slate-800 rounded-lg text-slate-500 bg-slate-900/20">
              <div className="text-center">
                <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-slate-300">Parte 2: Contexto Dinámico</h3>
                <p className="text-sm text-slate-500 mt-2">Esperando instrucciones...</p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="correction">
            <div className="flex items-center justify-center h-96 border-2 border-dashed border-slate-800 rounded-lg text-slate-500 bg-slate-900/20">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-slate-300">Parte 3: Corrección</h3>
                <p className="text-sm text-slate-500 mt-2">Esperando instrucciones...</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

      </div>
    </Layout>
  );
};

export default AgentBrain;