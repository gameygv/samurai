import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Save, Bot, Sparkles, AlertTriangle, Eye, ClipboardList, Hammer, ScrollText, ShieldAlert, Database, History, MessageSquare, Gift, RefreshCw, Server, CheckCircle2, ScanEye, FileText, CheckCheck, ListTodo, Zap } from 'lucide-react';
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

const DEFAULT_RELEARNING = `### CÓMO LA IA INCORPORA LA CORRECCIÓN

PASO 1: LECTURA PREVIA (Antes de generar respuesta)
--------
En Make.com, cuando IA está a punto de responder:

// Pseudo-código Make.com
QUERY Supabase:
SELECT *
FROM aprendizaje_errores
WHERE aplicada = FALSE
AND categoria_error IN ('TONE', 'INFO_FALTANTE', ...)
AND fecha_correccion > NOW() - INTERVAL 7 days
ORDER BY fecha_correccion DESC
LIMIT 10;

// Construir string de contexto
CORRECTION_CONTEXT = "
Correcciones recientes de Geoffrey/Tatiana/Anahí/Edith:
...
";

PASO 2: INYECCIÓN EN PROMPT
--------
// Antes de enviar a Gemini, inyectar:

SYSTEM_PROMPT_CON_CORRECCIONES = """
[ADN SAMURAI - visto arriba]

⚠️ CORRECCIONES RECIENTES (Aplicar SIEMPRE)
\${CORRECTION_CONTEXT}

Cuando respondas, ten estos errores en mente.
Si el cliente pregunta algo similar, EVITA hacer lo mismo.

[Resto del prompt]
"""

PASO 3: VALIDACIÓN DE APLICACIÓN
--------
// Después de que Gemini genera respuesta:

IF respuesta_nueva contiene palabras clave de error anterior
→ Log: "⚠️ Posible reincidencia detectada"
→ Flag para revisión manual

ELSE
→ Mark: aplicada = TRUE en Supabase
→ Log: "✅ Corrección aplicada exitosamente"
→ Update clientes tabla: última_respuesta_correcta = NOW()`;

const DEFAULT_VALIDATION_IMPROVEMENT = `### TRACKING DE IMPACTO

MÉTRICA 1: Aplicación de Correcciones (SQL)
--------
SELECT 
  categoria_error,
  COUNT(*) as total_errores,
  SUM(CASE WHEN aplicada = TRUE THEN 1 ELSE 0 END) as aplicadas,
  ROUND(100 * SUM(CASE WHEN aplicada = TRUE THEN 1 ELSE 0 END) / 
        COUNT(*), 2) as porcentaje_aplicacion
FROM aprendizaje_errores
WHERE fecha_correccion > NOW() - INTERVAL 7 days
GROUP BY categoria_error;

RESULTADO ESPERADO:
┌────────────────────────┬───────────────┬────────────┬──────────┐
│ categoria_error        │ total_errores │ aplicadas  │ %        │
├────────────────────────┼───────────────┼────────────┼──────────┤
│ TONE                   │ 5             │ 5          │ 100%     │
│ INFO_FALTANTE          │ 3             │ 3          │ 100%     │
│ CIERRE_FALLIDO         │ 2             │ 1          │ 50%      │
│ OTRO                   │ 1             │ 0          │ 0%       │
└────────────────────────┴───────────────┴────────────┴──────────┘

MÉTRICA 2: Reincidencia
--------
SELECT 
  cliente_id,
  COUNT(DISTINCT categoria_error) as tipos_errores,
  COUNT(*) as total_errores,
  COUNT(DISTINCT DATE(fecha_correccion)) as dias_con_errores
FROM aprendizaje_errores
GROUP BY cliente_id
HAVING COUNT(*) > 1
ORDER BY total_errores DESC;

META: Que reincidencia baje a 10% después 1 semana

MÉTRICA 3: Satisfacción Post-Corrección
--------
🔧 PENDIENTE: Implementar survey post-chat
  "¿Qué tal tu experiencia con el Samurái?" (1-5)
  Comparar: Respuestas sin corrección vs con corrección
  Objetivo: Correlacionar correcciones → mejor satisfacción`;

// --- CONSTANTES PARTE 4 ---
const DEFAULT_VISION_ANALYSIS = `# OJO DE HALCÓN - RECONOCIMIENTO DE COMPROBANTES

Este prompt se inyecta en Gemini Vision cuando cliente sube imagen.

---

SYSTEM PROMPT PARA VISIÓN:

"""
ERES UN EXPERTO EN ANÁLISIS DE COMPROBANTES BANCARIOS.

Tu tarea: Analizar imagen de transferencia bancaria 
y extraer datos críticos para validación.

## BÚSCALO EN LA IMAGEN:

1. **TIPO DE DOCUMENTO**
   ¿Es un comprobante bancario? (SPEI, transferencia, depósito)
   ¿O es algo más? (recibo de otro tipo, conversación, etc)
   
   Responde: TIPO_DOCUMENTO = [VÁLIDO / INVÁLIDO]
   Si INVÁLIDO, explica por qué

2. **MONTO EXACTO**
   Busca en rojo, grande, destacado
   Cifras que parecen "cantidad pagada"
   
   Responde: MONTO = $XXX.XX
   Si hay varios montos, listalos TODOS
   Confianza: XX%

3. **ÚLTIMOS 4 DÍGITOS DE CUENTA ORIGEN**
   Busca línea que diga "De:", "Cuenta:", "Origen:"
   Extrae los últimos 4 números VISIBLES
   
   Responde: ULTIMOS_4_DIGITOS = XXXX
   Si están borrosos/ilegibles:
   Confianza: XX%

4. **FECHA DE TRANSACCIÓN**
   Busca "Fecha:", "Hora:", "Timestamp"
   Formato: DD/MM/YYYY HH:MM
   
   Responde: FECHA = DD/MM/YYYY
   Confianza: XX%

5. **CONCEPTO / REFERENCIA**
   Busca "Concepto:", "Referencia:", "Asunto:"
   ¿Menciona "Curso"? ¿"Pago"? ¿"The Elephant"? ¿Cliente específico?
   
   Responde: CONCEPTO = [lo que dice]
   Si vacío: CONCEPTO = SIN_ESPECIFICAR

6. **CONFIANZA GENERAL**
   0-50%: Imagen muy borrosa, datos incompletos
   51-79%: Datos visibles pero con dudas
   80-100%: Comprobante claro y legible
   
   Responde: CONFIANZA_GENERAL = XX%

## RESPUESTA ESPERADA:

Formato JSON (SIN explicaciones):

{
  "tipo_documento": "SPEI_VALIDO",
  "monto": "4500.00",
  "montos_alternativos": [],
  "ultimos_4_digitos": "1234",
  "fecha": "14/02/2026",
  "concepto": "Pago Curso Nivel 1",
  "confianza_general": 95,
  "detalles": "Comprobante SPEI claro. Monto y fecha legibles."
}

## ESPECIAL: Si ves borroso/incompleto

{
  "tipo_documento": "INCIERTO",
  "razon_rechazo": "Imagen muy borrosa, imposible leer monto",
  "confianza_general": 20,
  "recomendacion": "Pedir cliente que envíe foto más clara"
}
"""`;

const DEFAULT_MATCH_VALIDATION = `# DESPUÉS QUE OJO DE HALCÓN ANALIZA

Make.com ejecuta validación:

STEP 1: Obtener datos de Kommo
GET cliente.monto_validado (lo que debería pagar)
GET cliente.ultimos_4_digitos (lo que registramos)

STEP 2: Comparar con comprobante
IF comprobante.monto == kommo.monto_validado
✅ MATCH_MONTO = TRUE
ELSE
❌ MATCH_MONTO = FALSE
Log: "Monto no coincide: Esperado \${{exp}}, Recibido \${{rec}}"

IF comprobante.ultimos_4_digitos == kommo.ultimos_4_digitos
✅ MATCH_DIGITOS = TRUE
ELSE
❌ MATCH_DIGITOS = FALSE
Log: "Dígitos no coinciden: Esperado {{exp}}, Recibido {{rec}}"

STEP 3: Validar fecha
TODAY = 2026-02-14
comprobante.fecha = 2026-02-14
IF comprobante.fecha BETWEEN (TODAY - 2 DAYS) AND TODAY
✅ MATCH_FECHA = TRUE
ELSE
❌ MATCH_FECHA = FALSE
Log: "Fecha fuera de rango: {{comprobante.fecha}}"

STEP 4: Score de validación
SCORE = (MATCH_MONTO + MATCH_DIGITOS + MATCH_FECHA) / 3
IF SCORE >= 0.80 AND comprobante.confianza_general >= 80
✅✅ VALIDACIÓN EXITOSA
confidence = comprobante.confianza_general
ELSE
⚠️ VALIDACIÓN PARCIAL - Revisar manualmente
confidence = SCORE * 100`;

const DEFAULT_POST_VALIDATION_ACTION = `### 4.3 ACCIÓN POST-VALIDACIÓN

SI VALIDACIÓN EXITOSA
---------------------
KOMMO:
- Move lead to stage: "Inscrito / Cerrado"
- Update custom field: Comprobante_Validado = TRUE
- Update custom field: Pago_Confirmado_Por = "IA"
- Update custom field: Fecha_Confirmacion = NOW()
- Tag: "pago_verificado"
- Create task: "Enviar bienvenida al curso"

SUPABASE:
- Insert en tabla: registro_pagos
  {
    cliente_id: UUID,
    monto: {{monto}},
    fecha_comprobante: {{fecha}},
    confianza: {{confidence}},
    validado_por: "ojo_halcon",
    timestamp: NOW()
  }

MENSAJE IA A CLIENTE:
"🎉 ¡Excelente! Hemos confirmado tu pago de \${{monto}}.

Tu lugar está 100% asegurado para {{fecha_curso}} en {{ubicacion}}.

El equipo te enviará:
✅ Instrucciones de llegada
✅ Horario del taller
✅ Qué llevar

¡Nos vemos pronto, {{nombre}}! Este es el inicio
de tu transformación a través del sonido. 🎵"

NOTIFICACIÓN ANAHÍ/EDITH:
"✅ PAGO CONFIRMADO
Cliente: {{nombre}}
Monto: \${{monto}}
Fecha: {{fecha_comprobante}}
Confianza: {{confidence}}%

Lead automáticamente movido a 'Inscrito'.
Bienvenida enviada."

SI VALIDACIÓN FALLA
-------------------
KOMMO:
- Tag: "comprobante_rechazado"
- Create task: "Revisar comprobante con cliente"
- Assign to: Anahí/Edith

SUPABASE:
- Insert error en tabla: validacion_fallida
  {
    cliente_id: UUID,
    razon_fallo: "Monto no coincide",
    comprobante_analisis: {{json_ojo_halcon}},
    timestamp: NOW()
  }

MENSAJE IA A CLIENTE:
"Hola {{nombre}}, he revisado tu comprobante pero
veo que no coincide exactamente con lo esperado:

❌ {{razon_fallo}}

¿Podrías verificar y enviar de nuevo?
O bien, {{nombre_agente}} te ayudará directamente.

Gracias por tu paciencia 🙏"

NOTIFICACIÓN ANAHÍ/EDITH:
"⚠️ COMPROBANTE RECHAZADO
Cliente: {{nombre}}
Razon: {{razon_fallo}}

Acción requerida: Contactar manualmente"`;

// --- CONSTANTES PARTE 5 ---
const DEFAULT_PENDING_LIST = `# 📋 ÍNDICE PARTE 5 v2.0

SECCIÓN 1: NUEVA ESTRUCTURA (Josué como supervisor)
SECCIÓN 2: TIMELINE DIARIO ACELERADO (15-22 Feb)
SECCIÓN 3: PANEL SAMURAI - CONFIGURACIÓN COMPLETA
  └─ 3.1 Estados Emocionales (CRUD)
  └─ 3.2 API Keys & Webhooks (Configurable)
  └─ 3.3 Frases Geoffrey (Dynamic)
  └─ 3.4 Prompts (Versionado)
  └─ 3.5 Promos & Ofertas (Editable)
SECCIÓN 4: ESCENARIOS MAKE.COM (Ready to Test)
SECCIÓN 5: REGISTRO MASTER (Tracking en tiempo real)`;

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
  const [matchValidation, setMatchValidation] = useState(DEFAULT_MATCH_VALIDATION);
  const [postValidationAction, setPostValidationAction] = useState(DEFAULT_POST_VALIDATION_ACTION);

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
                <ClipboardList className="w-4 h-4 mr-2" /> Parte 5: Índice v2.0
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
              <PromptCard title="4.2 Validación de Match (Lógica)" icon={CheckCheck} color="text-lime-500" bg="bg-lime-500/10" value={matchValidation} onChange={setMatchValidation} />
              <PromptCard title="4.3 Acción Post-Validación" icon={Zap} color="text-yellow-500" bg="bg-yellow-500/10" value={postValidationAction} onChange={setPostValidationAction} />
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