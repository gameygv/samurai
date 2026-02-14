import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Save, Bot, Sparkles, AlertTriangle, ScrollText, Code, Hammer, GitBranch, MapPin, PauseCircle, CreditCard, CalendarClock, Database, History } from 'lucide-react';
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

const DEFAULT_DATA_INJECTION_PROMPT = `# CONTEXTO DINÁMICO - CÓMO SE INYECTA EN CADA MENSAJE

## ANTES DE GENERAR RESPUESTA
El sistema debe hacer queries automáticas a Supabase:

QUERY 1: Perfil del Cliente
SELECT
nombre,
telefono,
ciudad,
perfil_psicologico,
estado_emocional_actual,
intereses,
fecha_ultima_interaccion,
ultimos_4_digitos,
status_promesa_pago
FROM clientes
WHERE kommo_lead_id = {{lead_id}}
LIMIT 1;

QUERY 2: Últimos Mensajes (Contexto Conversación)
SELECT
rol,
mensaje,
estado_emocional,
timestamp
FROM conversaciones
WHERE cliente_id = {{cliente_id}}
ORDER BY timestamp DESC
LIMIT 15;

QUERY 3: Errores Aplicables (Si cliente ha sido corregido)
SELECT
categoria_error,
input_cliente,
correccion_humana,
aplicada
FROM aprendizaje_errores
WHERE cliente_id = {{cliente_id}}
AND aplicada = TRUE
ORDER BY fecha_correccion DESC
LIMIT 5;

QUERY 4: Promo Activa (Según perfil + región)
SELECT
concepto,
detalle_promo,
url_imagen,
target_perfil
FROM promos_activas
WHERE vigencia_fin >= TODAY()
AND (target_perfil = 'todos'
OR target_perfil = {{perfil_psicologico}})
ORDER BY RANDOM() LIMIT 1;

## CONSTRUCCIÓN DEL CONTEXTO PARA PROMPT

CONTEXTO_CLIENTE = {
"nombre": {{cliente.nombre}},
"ciudad": {{cliente.ciudad}},
"perfil_psicologico": {{cliente.perfil_psicologico}},
"estado_emocional": {{cliente.estado_emocional_actual}},
"intereses": {{cliente.intereses}},
"historia_conversacion": {{últimos_15_mensajes}},
"errores_previos_corregidos": {{errores_aplicados}},
"promo_disponible": {{promo_activa}},
"dias_desde_primer_contacto": {{días_transcurridos}},
"status_promesa_pago": {{cliente.status_promesa_pago}}
}

INJECT_IN_PROMPT: {{CONTEXTO_CLIENTE}}

## INSERCIÓN EN PROMPT DINÁMICO

PREFIX_DINÁMICO = """
Cliente: {{cliente.nombre}} de {{cliente.ciudad}}
Perfil: {{cliente.perfil_psicologico}} | Emoción detectada: {{cliente.estado_emocional}}
Intereses: {{cliente.intereses.join(', ')}}
Última interacción hace: {{dias}} días
Status: {{cliente.status_promesa_pago}}

Contexto conversación (últimos 5 mensajes):
{{conversacion_resumida}}

Errores anteriores corregidos (aplicar en respuesta):
{{errores_aplicados_lista}}

Promo activa para este cliente:
{{promo_disponible}}
"""`;

const DEFAULT_MEMORY_PROMPT = `### SI CLIENTE ESTÁ EN KOMMO:
  ✅ Fetch contexto de Supabase
  ✅ Saludo personalizado: "¡Qué alegría volverte a ver!"
  ✅ Referencia a último tema: "Hace {{X}} días hablamos sobre {{tema}}"
  ✅ Continúa conversación natural

### SI CLIENTE NO ESTÁ EN MEMORIA (Primer contacto):
  1. Crea registro en Kommo INMEDIATO
  2. Crea registro en Supabase clientes TABLE
  3. Inicializa campos:
     - nombre = TBD (preguntar en chat)
     - ciudad = TBD (detectar por código área)
     - perfil_psicologico = TBD (detectar durante conversación)
     - intereses = []
     - fecha_primer_contacto = NOW()
  4. Saludo estándar: "Es un gusto saludarte, soy el Samurái..."

### DETECCIÓN AUTOMÁTICA DE PERFIL PSICOLÓGICO

Durante cada mensaje, analiza:

PRAGMÁTICO:
  Señales: "cuánto cuesta", "qué está incluido", 
           "timeline", "especificaciones técnicas"
  Tono de respuesta: Directo, datos, sin emoción
  Trigger: Si 3+ preguntas data-driven = marcar como pragmático

EMOCIONAL:
  Señales: "necesito sanar", "transformación", 
           "estoy perdido", "necesito ayuda"
  Tono de respuesta: Cálido, validación, storytelling
  Trigger: Si emociones + busca cambio de vida = marcar como emocional

TÉCNICO:
  Señales: "cómo funciona exactamente", 
           "qué metodología", "estudios", "investigación"
  Tono de respuesta: Detalle metodológico, referencias, autoridad
  Trigger: Si busca entender "por qué" = marcar como técnico

DESPUÉS DE DETECTAR:
  - Update custom field Kommo: Perfil_Psicologico
  - Update tabla clientes Supabase
  - Usar este perfil para selector de promos & frases`;

const DEFAULT_ROUTING_PROMPT = `### PROTOCOLO 1: RUTEO REGIONAL
Detecta ubicación → Asigna a agente correcto

IF cliente menciona:
  CDMX, Coyoacán, Puebla, Estado de México, 
  Guerrero, Oaxaca, Chiapas, Tabasco, Yucatán
  → Asigna a ANAHÍ (Centro-Sur)

IF cliente menciona:
  Querétaro, Guanajuato, Bajío, Monterrey, 
  Nuevo León, Coahuila, Chihuahua, Sonora, Baja California
  → Asigna a EDITH (Bajío-Norte)

IF código de área telefónico:
  54, 55, 56, 58 (CDMX) → ANAHÍ
  42, 43, 46, 81, 82 (Bajío-Norte) → EDITH
  Otros → Random assignment

ACCIÓN KOMMO:
  - Update custom field: Region_Asignada
  - Move lead to: "Nutrición IA" stage
  - Tag: "region_{{region}}"
  - Notify assigned agent`;

const DEFAULT_PAYMENT_PROMPT = `TRIGGER: Imagen detectada en chat (Kommo attachment)

ANÁLISIS AUTOMÁTICO (Gemini Vision):
  1. ¿Es documento bancario? (Sí/No)
  2. Extrae: Monto exacto
  3. Extrae: Últimos 4 dígitos de tarjeta/cuenta
  4. Extrae: Fecha de transacción
  5. Extrae: Concepto (ej: "Pago Curso")
  6. Calcula: Confidence score (0-100%)

VALIDACIÓN:
  ✅ Monto == Precio inscripción exacto
  ✅ Últimos 4 dígitos == Campo Kommo exacto
  ✅ Fecha está en rango válido (hoy ± 2 días)
  = MATCH DETECTADO

ACCIÓN SI DETECTA MATCH (confidence > 80%):
  1. Mensaje cliente: 
     "¡Excelente! He detectado tu comprobante. 
      En un momento el equipo validará el ingreso 
      para darte la bienvenida oficial 🎉"
  
  2. Notificación Anahí/Edith:
     "⚠️ COMPROBANTE DETECTADO
      Cliente: [Nombre]
      Monto: $[XXXX]
      Últimos 4: XXXX
      Confianza: [XX%]
      👉 Haz clic para validar"
  
  3. Kommo:
     - Update custom field: Comprobante_Detectado = TRUE
     - Move to stage: "Verificación de Pago"
     - Create task: "Validar transferencia"
     - Tag: "comprobante_pendiente"
  
  4. IA pausa: Espera validación humana (no presuma nada)

ACCIÓN SI NO DETECTA CLARO (confidence < 80%):
  1. Mensaje cliente: 
     "¿Podrías enviar una imagen más clara del comprobante? 
      Necesito ver el monto y la fecha bien"
  
  2. Reintento automático cada 30 seg hasta 3 veces
  
  3. Si falla 3 veces: Notifica humano
     "No detecté comprobante claro. Revisar manual."`;

const DEFAULT_PROMISE_PROMPT = `TRIGGER: Cliente expresa compromiso de pago futuro

KOMMO UPDATE:
  - Status: "Promesa_Pago"
  - Tag: "#promesa_pago"
  - Custom Field: "Fecha_Promesa_Pago" = [fecha del cliente]
  - Counter: recordatorios = 0

ACCIÓN INMEDIATA (IA):
  Mensaje: "Perfecto, {{nombre}}. He anotado tu lugar reservado. 
            Te estaré esperando {{fecha_promesa}}.
            Si tienes dudas, aquí estoy. 🤝"

TIMER 1 - DESPUÉS 24 HORAS (Acción: PROMO + Beneficio):
  Trigger: Cliente no ha pagado en 24h
  Mensaje: "[PROMOCIÓN ESPECIAL]
            {{nombre}}, te tenía un descuento especial para hoy.
            {{promo_nombre}}: [descripción]
            Link: [imagen + link]"
  
  Meta: Despertar interés con oferta tiempo-limitada

TIMER 2 - DESPUÉS 48-72 HORAS (Acción: DATOS DE INTERÉS):
  If Timer 1 response = positivo:
    Mensaje: "¡Excelente! Mira algunos beneficios que otros no saben:
              • Desayuno y comida INCLUIDOS (ahorras $500+)
              • Hospedaje en Amatlán de Quetzalcóatl
              • La metodología respaldada por 12 años Geoffrey
              • Certificado después del curso"
    Meta: Reforzar valor, no solo precio
  
  If Timer 1 response = silencio/negativo:
    Mensaje: "Hola {{nombre}}, ¿todo bien? 
              Solo quería recordarte que tu lugar está apartado 
              y tienes hasta {{fecha_límite}} para confirmar. 
              ¿Hay algo que te preocupe?"
    Meta: Identificar objeción real

TIMER 3 - DESPUÉS X HORAS (Acción: TESTIMONIOS + ÚLTIMO LLAMADO):
  If Timers 1 & 2 = sin respuesta significativa:
    Mensaje: "[TESTIMONIOS DE TRANSFORMACIÓN]
              Mira lo que otros clientes como tú experimentaron:
              {{testimonio_video_o_texto}}
              
              Solo quedan {{lugares_restantes}} lugares para {{fecha_curso}}.
              ¿Quieres asegurar el tuyo?"
    Meta: Urgencia + Prueba social + Último empujón

SI NO RESPONDE ACCIÓN 3:
  ✋ PAUSA AUTOMÁTICA
  - IA CESA de enviar recordatorios
  - Tag en Kommo: "Sin_Respuesta_Promesa"
  - Flag: Espera intervención MANUAL de Anahí/Edith
  
  🔧 PENDIENTE: 
     Automatización futura para "ciclo de recuperación de 30 días"
     (Plan: Re-engagement automático después 1 semana, 
            movimiento a "Perdido" después 30 días)`;

const DEFAULT_CORRECTION_PROMPT = `### PROTOCOLO 3: INTERVENCIÓN HUMANA (MODO SIESTA)

TRIGGER: Humano (Anahí/Edith) envía mensaje
ACTION:
  1. Pausa IA automáticamente
  2. Log: "[MODO SIESTA ACTIVADO] - Anahí interviene. IA pausa 10 min"
  3. Update Kommo: Estado_Siesta = "ACTIVO" 
  4. Humano: Libertad total para vender/resolver
  5. Después de 10 min: IA se reactiva automáticamente
     - UNLESS humano escriba "continue" → Reactivación inmediata
     - OR humano siga escribiendo → IA espera 10 min más
     
EXCEPCIONES: Modo Siesta se extiende si:
  - Humano y cliente siguen en conversación activa
  - No hay respuesta de cliente en 15+ minutos
  - Humano escriba una palabra clave (ej: "hasta luego")

LOG AUDITORIA: 
  - Todos los "Modo Siesta" quedan registrados
  - Útil para analizar: ¿Cuándo es mejor que intervenga humano?`;

const AgentBrain = () => {
  const [corePrompt, setCorePrompt] = useState(DEFAULT_CORE_PROMPT);
  const [technicalPrompt, setTechnicalPrompt] = useState(DEFAULT_TECHNICAL_PROMPT);
  const [behaviorPrompt, setBehaviorPrompt] = useState(DEFAULT_BEHAVIOR_PROMPT);
  const [dataInjectionPrompt, setDataInjectionPrompt] = useState(DEFAULT_DATA_INJECTION_PROMPT);
  const [memoryPrompt, setMemoryPrompt] = useState(DEFAULT_MEMORY_PROMPT);
  const [routingPrompt, setRoutingPrompt] = useState(DEFAULT_ROUTING_PROMPT);
  const [paymentPrompt, setPaymentPrompt] = useState(DEFAULT_PAYMENT_PROMPT);
  const [promisePrompt, setPromisePrompt] = useState(DEFAULT_PROMISE_PROMPT);
  const [correctionPrompt, setCorrectionPrompt] = useState(DEFAULT_CORRECTION_PROMPT);

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

          <TabsContent value="context" className="mt-6 space-y-6 animate-in fade-in-50 duration-500">
             <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                   {/* 2.1 Inyección de Datos */}
                   <Card className="bg-slate-900 border-slate-800 shadow-xl">
                    <CardHeader className="border-b border-slate-800 pb-4">
                      <CardTitle className="text-white flex items-center gap-2 text-lg">
                        <div className="w-8 h-8 rounded bg-cyan-500/10 flex items-center justify-center text-cyan-500">
                          <Database className="w-5 h-5" />
                        </div>
                        2.1 Inyección de Datos del Cliente (Supabase)
                      </CardTitle>
                      <CardDescription>Definición de queries y estructura de contexto dinámico.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <Textarea 
                        value={dataInjectionPrompt}
                        onChange={(e) => setDataInjectionPrompt(e.target.value)}
                        className="min-h-[400px] bg-slate-950/50 border-slate-800 font-mono text-sm text-slate-300 focus:border-cyan-500/50 focus:ring-cyan-500/20 resize-none p-4 leading-relaxed custom-scrollbar"
                        placeholder="Define aquí las queries de inyección..."
                      />
                    </CardContent>
                  </Card>

                   {/* 2.2 Memoria Histórica */}
                   <Card className="bg-slate-900 border-slate-800 shadow-xl">
                    <CardHeader className="border-b border-slate-800 pb-4">
                      <CardTitle className="text-white flex items-center gap-2 text-lg">
                        <div className="w-8 h-8 rounded bg-teal-500/10 flex items-center justify-center text-teal-500">
                          <History className="w-5 h-5" />
                        </div>
                        2.2 Memoria Histórica y Perfilado
                      </CardTitle>
                      <CardDescription>Reconocimiento de clientes retornantes y detección de perfil psicológico.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <Textarea 
                        value={memoryPrompt}
                        onChange={(e) => setMemoryPrompt(e.target.value)}
                        className="min-h-[400px] bg-slate-950/50 border-slate-800 font-mono text-sm text-slate-300 focus:border-teal-500/50 focus:ring-teal-500/20 resize-none p-4 leading-relaxed custom-scrollbar"
                        placeholder="Define aquí la lógica de memoria..."
                      />
                    </CardContent>
                  </Card>

                   {/* 2.3 Ruteo */}
                   <Card className="bg-slate-900 border-slate-800 shadow-xl">
                    <CardHeader className="border-b border-slate-800 pb-4">
                      <CardTitle className="text-white flex items-center gap-2 text-lg">
                        <div className="w-8 h-8 rounded bg-purple-500/10 flex items-center justify-center text-purple-500">
                          <MapPin className="w-5 h-5" />
                        </div>
                        2.3 Protocolo de Ruteo Regional
                      </CardTitle>
                      <CardDescription>Lógica de asignación de leads a Anahí (Centro-Sur) o Edith (Bajío-Norte).</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <Textarea 
                        value={routingPrompt}
                        onChange={(e) => setRoutingPrompt(e.target.value)}
                        className="min-h-[400px] bg-slate-950/50 border-slate-800 font-mono text-sm text-slate-300 focus:border-purple-500/50 focus:ring-purple-500/20 resize-none p-4 leading-relaxed custom-scrollbar"
                        placeholder="Define aquí la lógica de ruteo..."
                      />
                    </CardContent>
                  </Card>

                   {/* 2.4 Validación de Pagos */}
                   <Card className="bg-slate-900 border-slate-800 shadow-xl">
                    <CardHeader className="border-b border-slate-800 pb-4">
                      <CardTitle className="text-white flex items-center gap-2 text-lg">
                        <div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        2.4 Validación de Pagos (Visión)
                      </CardTitle>
                      <CardDescription>Análisis automático de comprobantes bancarios mediante IA.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <Textarea 
                        value={paymentPrompt}
                        onChange={(e) => setPaymentPrompt(e.target.value)}
                        className="min-h-[400px] bg-slate-950/50 border-slate-800 font-mono text-sm text-slate-300 focus:border-emerald-500/50 focus:ring-emerald-500/20 resize-none p-4 leading-relaxed custom-scrollbar"
                        placeholder="Define aquí la validación de pagos..."
                      />
                    </CardContent>
                  </Card>

                  {/* 2.5 Seguimiento de Promesa */}
                   <Card className="bg-slate-900 border-slate-800 shadow-xl">
                    <CardHeader className="border-b border-slate-800 pb-4">
                      <CardTitle className="text-white flex items-center gap-2 text-lg">
                        <div className="w-8 h-8 rounded bg-pink-500/10 flex items-center justify-center text-pink-500">
                          <CalendarClock className="w-5 h-5" />
                        </div>
                        2.5 Protocolo de Seguimiento (Promesa de Pago)
                      </CardTitle>
                      <CardDescription>Automatización de recordatorios y re-engagement.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <Textarea 
                        value={promisePrompt}
                        onChange={(e) => setPromisePrompt(e.target.value)}
                        className="min-h-[400px] bg-slate-950/50 border-slate-800 font-mono text-sm text-slate-300 focus:border-pink-500/50 focus:ring-pink-500/20 resize-none p-4 leading-relaxed custom-scrollbar"
                        placeholder="Define aquí el seguimiento..."
                      />
                    </CardContent>
                  </Card>
                </div>

                 <div className="space-y-6">
                   <Card className="bg-slate-900/50 border-slate-800 sticky top-6">
                    <CardHeader>
                      <CardTitle className="text-sm text-slate-300">Variables de Contexto</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="p-3 rounded bg-slate-950 border border-slate-800 group hover:border-slate-700 transition-colors cursor-pointer">
                        <code className="text-xs font-mono text-cyan-400 block mb-1">{`{{cliente.nombre}}`}</code>
                        <p className="text-xs text-slate-500">Nombre real del cliente desde CRM</p>
                      </div>
                      <div className="p-3 rounded bg-slate-950 border border-slate-800 group hover:border-slate-700 transition-colors cursor-pointer">
                         <code className="text-xs font-mono text-cyan-400 block mb-1">{`{{cliente.ciudad}}`}</code>
                         <p className="text-xs text-slate-500">Ciudad de origen para ruteo</p>
                      </div>
                      <div className="p-3 rounded bg-slate-950 border border-slate-800 group hover:border-slate-700 transition-colors cursor-pointer">
                         <code className="text-xs font-mono text-teal-400 block mb-1">{`{{cliente.perfil}}`}</code>
                         <p className="text-xs text-slate-500">Perfil psicológico (ej: explorador)</p>
                      </div>
                      <div className="p-3 rounded bg-slate-950 border border-slate-800 group hover:border-slate-700 transition-colors cursor-pointer">
                         <code className="text-xs font-mono text-teal-400 block mb-1">{`{{historial_chat}}`}</code>
                         <p className="text-xs text-slate-500">Resumen de últimos 5 mensajes</p>
                      </div>
                    </CardContent>
                  </Card>
                 </div>
             </div>
          </TabsContent>
          
          <TabsContent value="correction" className="mt-6 space-y-6 animate-in fade-in-50 duration-500">
             <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2">
                   <Card className="bg-slate-900 border-slate-800 shadow-xl">
                    <CardHeader className="border-b border-slate-800 pb-4">
                      <CardTitle className="text-white flex items-center gap-2 text-lg">
                        <div className="w-8 h-8 rounded bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                          <PauseCircle className="w-5 h-5" />
                        </div>
                        3.1 Protocolo de Intervención Humana (Modo Siesta)
                      </CardTitle>
                      <CardDescription>Reglas para pausar la IA cuando un humano interviene.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <Textarea 
                        value={correctionPrompt}
                        onChange={(e) => setCorrectionPrompt(e.target.value)}
                        className="min-h-[400px] bg-slate-950/50 border-slate-800 font-mono text-sm text-slate-300 focus:border-yellow-500/50 focus:ring-yellow-500/20 resize-none p-4 leading-relaxed custom-scrollbar"
                        placeholder="Define aquí el protocolo de siesta..."
                      />
                    </CardContent>
                  </Card>
                </div>
                 <div className="space-y-6">
                   <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-sm text-slate-300">Variables de Control</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="p-3 rounded bg-slate-950 border border-slate-800 group hover:border-slate-700 transition-colors cursor-pointer">
                        <code className="text-xs font-mono text-yellow-400 block mb-1">{`{{nap_status}}`}</code>
                        <p className="text-xs text-slate-500">Estado actual: ACTIVO / INACTIVO</p>
                      </div>
                      <div className="p-3 rounded bg-slate-950 border border-slate-800 group hover:border-slate-700 transition-colors cursor-pointer">
                         <code className="text-xs font-mono text-yellow-400 block mb-1">{`{{last_human_msg}}`}</code>
                         <p className="text-xs text-slate-500">Timestamp del último mensaje humano</p>
                      </div>
                    </CardContent>
                  </Card>
                 </div>
             </div>
          </TabsContent>
        </Tabs>

      </div>
    </Layout>
  );
};

export default AgentBrain;