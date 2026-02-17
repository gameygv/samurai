import React from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BookOpen, Brain, Zap, ShieldAlert, Target, 
  Database, Image, Lightbulb, AlertTriangle, ScanEye 
} from 'lucide-react';

const Manual = () => {
  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white flex items-center gap-3">
            <BookOpen className="w-10 h-10 text-indigo-500" />
            Manual de Operaciones Samurai
          </h1>
          <p className="text-slate-400 text-lg">
            Guía maestra para configurar, entrenar y potenciar tu Inteligencia Artificial.
          </p>
        </div>

        <Tabs defaultValue="cerebro" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 w-full justify-start p-1 h-auto flex-wrap">
            <TabsTrigger value="cerebro" className="py-2 px-4 data-[state=active]:bg-indigo-600">🧠 El Cerebro Core (1.1-4.3)</TabsTrigger>
            <TabsTrigger value="conocimiento" className="py-2 px-4 data-[state=active]:bg-indigo-600">📚 Base de Conocimiento (RAG)</TabsTrigger>
            <TabsTrigger value="media" className="py-2 px-4 data-[state=active]:bg-indigo-600">📸 Media & Triggers</TabsTrigger>
            <TabsTrigger value="aprendizaje" className="py-2 px-4 data-[state=active]:bg-indigo-600">🔄 Auto-Aprendizaje</TabsTrigger>
          </TabsList>

          {/* SECCIÓN 1: EL CEREBRO */}
          <TabsContent value="cerebro" className="mt-6 space-y-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Arquitectura de Prompts</CardTitle>
                <CardDescription>
                  Cada casilla en "Agent Brain" es una variable que se inyecta en el Prompt del Sistema.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  
                  {/* 1. SISTEMA */}
                  <AccordionItem value="item-1">
                    <AccordionTrigger className="text-indigo-400 hover:text-indigo-300 font-bold">1. SISTEMA (La Identidad)</AccordionTrigger>
                    <AccordionContent className="text-slate-300 space-y-4 pt-2">
                      <div className="space-y-2">
                        <h4 className="font-bold text-white flex items-center gap-2"><Target className="w-4 h-4"/> 1.1 ADN Core</h4>
                        <p className="text-sm">Es la instrucción más importante. Define <strong>quién es</strong> y <strong>qué vende</strong>.</p>
                        <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs font-mono text-green-400">
                          Ejemplo: "Eres Samurai, un vendedor senior de [TU_EMPRESA]. Tu tono es seguro, directo y experto. Nunca ruegas por una venta. Tu objetivo es calificar al cliente y cerrar la venta hoy."
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-bold text-white flex items-center gap-2"><Target className="w-4 h-4"/> 1.2 Técnico</h4>
                        <p className="text-sm">Controla el formato de salida. <strong>NO LO CAMBIES</strong> a menos que sepas lo que haces. Garantiza que el mensaje llegue limpio a WhatsApp.</p>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-bold text-white flex items-center gap-2"><Target className="w-4 h-4"/> 1.3 Protocolos</h4>
                        <p className="text-sm">Reglas de etiqueta. ¿Cómo saluda? ¿Usa emojis? ¿Tutea o habla de usted?</p>
                        <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs font-mono text-green-400">
                           Ejemplo: "Usa emojis con moderación. Si el cliente es informal, tú también. Si el cliente es serio, sé formal. Nunca envíes textos de más de 3 líneas."
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-bold text-white flex items-center gap-2"><Target className="w-4 h-4"/> 1.4 Objeciones</h4>
                        <p className="text-sm">La "Matriz de Defensa". Lista las quejas comunes y cómo resolverlas.</p>
                        <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs font-mono text-green-400">
                           Ejemplo: <br/>
                           - "Está caro": Responde "La calidad se paga sola. ¿Prefieres gastar menos hoy o que te dure 5 años?"<br/>
                           - "Lo voy a pensar": Responde "¿Qué es exactamente lo que te detiene? ¿El precio o el envío?"
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* 2. CONTEXTO */}
                  <AccordionItem value="item-2">
                    <AccordionTrigger className="text-indigo-400 hover:text-indigo-300 font-bold">2. CONTEXTO (Datos y Memoria)</AccordionTrigger>
                    <AccordionContent className="text-slate-300 space-y-4 pt-2">
                      <p className="text-sm">Instrucciones sobre cómo usar los datos que el sistema inyecta automáticamente (Nombre, Historial).</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="bg-slate-950 p-3 rounded border border-slate-800">
                            <h5 className="font-bold text-white mb-1">2.1 Datos CRM</h5>
                            <p className="text-xs">Dile que use el nombre del cliente. "Siempre inicia saludando por el nombre si está disponible."</p>
                         </div>
                         <div className="bg-slate-950 p-3 rounded border border-slate-800">
                            <h5 className="font-bold text-white mb-1">2.2 Memoria</h5>
                            <p className="text-xs">Reglas para no ser repetitivo. "Revisa los últimos 5 mensajes. Si ya te dijo su presupuesto, no lo vuelvas a preguntar."</p>
                         </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* 3. PSICOLOGÍA */}
                  <AccordionItem value="item-3">
                    <AccordionTrigger className="text-indigo-400 hover:text-indigo-300 font-bold">3. PSICOLOGÍA (Ventas Avanzadas)</AccordionTrigger>
                    <AccordionContent className="text-slate-300 space-y-4 pt-2">
                      <div className="bg-blue-900/20 p-4 rounded border border-blue-800 mb-4">
                         <p className="text-sm text-blue-200 flex items-center gap-2">
                            <Brain className="w-4 h-4" />
                            <strong>Nota Importante:</strong> Esta sección alimenta el sistema de Auto-Aprendizaje. Samurai usa estas reglas para decidir si marca al cliente como "ALTA INTENCIÓN" o "MOLESTO".
                         </p>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-bold text-white">3.1 Perfilado Psicológico</h4>
                        <p className="text-sm">Enseña a la IA a leer entre líneas.</p>
                        <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs font-mono text-green-400">
                           Ejemplo: "Si el cliente escribe en mayúsculas o usa muchos signos '!!!', está EMOCIONAL o ENOJADO. Actúa con calma. Si pregunta especificaciones técnicas, es PRAGMÁTICO. Dale datos duros."
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-bold text-white">3.2 Estrategia de Cierre</h4>
                        <p className="text-sm">El "Funnel" mental del bot. Define cuándo dejar de informar y empezar a pedir el dinero.</p>
                        <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs font-mono text-green-400">
                           Ejemplo: "Si el cliente pregunta por métodos de pago, asume la venta. No preguntes '¿quieres pagar?', di 'Aquí tienes el CBU, ¿te queda cómodo transferir ahora?'"
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* 4. VISIÓN & VALIDACIÓN */}
                  <AccordionItem value="item-4">
                    <AccordionTrigger className="text-indigo-400 hover:text-indigo-300 font-bold">4. VISIÓN & VALIDACIÓN (Pagos)</AccordionTrigger>
                    <AccordionContent className="text-slate-300 space-y-4 pt-2">
                      <p className="text-sm mb-4">
                         Esta sección se activa <strong>SOLO</strong> cuando el cliente envía una imagen. Es crítica para automatizar la cobranza.
                      </p>
                      
                      <div className="grid grid-cols-1 gap-6">
                         {/* 4.1 Ojo de Halcón */}
                         <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/30">
                            <h4 className="font-bold text-white flex items-center gap-2 mb-2"><ScanEye className="w-4 h-4 text-purple-500"/> 4.1 Ojo de Halcón (Análisis)</h4>
                            <p className="text-sm text-slate-400 mb-2">Instrucciones sobre QUÉ buscar en la imagen.</p>
                            <div className="bg-slate-950 p-2 rounded border border-slate-800 text-xs font-mono text-green-400 italic">
                               "Analiza la imagen. Busca: Fecha de transferencia, Monto total, Banco emisor y Nombre del destinatario. Si falta alguno, la imagen es inválida."
                            </div>
                         </div>

                         {/* 4.2 Match Validation */}
                         <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/30">
                            <h4 className="font-bold text-white flex items-center gap-2 mb-2"><ShieldAlert className="w-4 h-4 text-purple-500"/> 4.2 Match (Validación)</h4>
                            <p className="text-sm text-slate-400 mb-2">Instrucciones para COMPARAR lo que vio en la imagen vs. lo que esperaba recibir.</p>
                            <div className="bg-slate-950 p-2 rounded border border-slate-800 text-xs font-mono text-green-400 italic">
                               "Compara el monto de la imagen con la deuda del cliente. Acepta una diferencia de hasta $5 pesos. Si el monto es menor, rechaza el pago amablemente. Si la fecha no es de hoy, alerta fraude."
                            </div>
                         </div>

                         {/* 4.3 Post Validation */}
                         <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/30">
                            <h4 className="font-bold text-white flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-purple-500"/> 4.3 Acción Post-Validación</h4>
                            <p className="text-sm text-slate-400 mb-2">Qué hacer después de confirmar que el pago es real.</p>
                            <div className="bg-slate-950 p-2 rounded border border-slate-800 text-xs font-mono text-green-400 italic">
                               "Si el pago es válido: Agradece con entusiasmo, confirma que el pedido se procesará hoy y pregunta si necesita factura A o B. NO pidas el comprobante de nuevo."
                            </div>
                         </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SECCIÓN 2: RAG / CONOCIMIENTO */}
          <TabsContent value="conocimiento" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><Database className="w-5 h-5 text-emerald-500"/> RAG Nativo (Búsqueda Inteligente)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 text-slate-300">
                   <div className="bg-slate-800/50 p-4 rounded-lg">
                      <h3 className="font-bold text-white mb-2">¿Cómo funciona realmente?</h3>
                      <p className="text-sm mb-2">
                         No necesitas configurar nada en Make. El sistema funciona así:
                      </p>
                      <ol className="list-decimal list-inside text-sm space-y-2 ml-2">
                         <li>Cliente pregunta: <em>"¿Tienen garantía de devolución?"</em></li>
                         <li>Samurai detecta la palabra clave y busca en tu <strong>Base de Conocimiento</strong>.</li>
                         <li>Encuentra el documento "Políticas de Garantía 2025.pdf".</li>
                         <li>Lee el contenido del PDF y lo "inyecta" temporalmente en la mente del Samurai.</li>
                         <li>Samurai responde: <em>"Sí, según nuestra política, tienes 30 días..."</em></li>
                      </ol>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                         <h4 className="font-bold text-white mb-2">¿Cómo subir buenos documentos?</h4>
                         <ul className="list-disc list-inside text-sm space-y-1 text-slate-400">
                            <li><strong>Formatos:</strong> PDF, DOCX, TXT. (Texto seleccionable, no escaneos).</li>
                            <li><strong>Títulos Claros:</strong> Usa "Precios Mayorista 2024" en vez de "lista_final_v2.pdf".</li>
                            <li><strong>Contenido Limpio:</strong> Si subes un Excel sucio, la IA se confundirá. Sube tablas limpias o resúmenes en texto.</li>
                         </ul>
                      </div>
                      <div>
                         <h4 className="font-bold text-white mb-2 text-yellow-500">Lo que NO hace</h4>
                         <ul className="list-disc list-inside text-sm space-y-1 text-slate-400">
                            <li>No lee imágenes dentro de PDFs.</li>
                            <li>No adivina precios que no estén escritos.</li>
                            <li>Si el documento es muy largo (100+ páginas), puede perder precisión. Mejor divide en temas.</li>
                         </ul>
                      </div>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          {/* SECCIÓN 3: MEDIA TRIGGERS */}
          <TabsContent value="media" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><Image className="w-5 h-5 text-purple-500"/> Media & Reglas de Disparo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 text-slate-300">
                   <p className="text-sm">
                      En la sección <strong>Media Manager</strong>, puedes subir archivos. Pero lo mágico es el campo <strong>"Instrucciones IA"</strong> (Trigger).
                   </p>

                   <div className="border-l-4 border-purple-500 pl-4 py-2 bg-slate-950/50">
                      <h4 className="font-bold text-white text-sm">El campo "Editar Reglas"</h4>
                      <p className="text-xs mt-1">
                         Es una instrucción condicional (IF/THEN) para el cerebro del Samurai.
                      </p>
                   </div>

                   <div className="space-y-4">
                      <h4 className="font-bold text-white text-sm">Ejemplos de Reglas Efectivas:</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="bg-slate-950 p-3 rounded border border-slate-800">
                            <span className="text-[10px] text-purple-400 font-bold uppercase">Caso: Catálogo PDF</span>
                            <p className="text-xs italic mt-1 text-green-300">
                               "Envía este archivo SOLO si el cliente pide ver 'todos los modelos' o pregunta por el 'catálogo completo'. No lo envíes si solo pregunta por un precio específico."
                            </p>
                         </div>
                         <div className="bg-slate-950 p-3 rounded border border-slate-800">
                            <span className="text-[10px] text-purple-400 font-bold uppercase">Caso: QR de Pago</span>
                            <p className="text-xs italic mt-1 text-green-300">
                               "Usa esta imagen cuando el cliente confirme que quiere pagar por transferencia o QR. Acompáñalo del texto: 'Aquí tienes el QR, avísame al transferir'."
                            </p>
                         </div>
                      </div>
                   </div>

                   <div className="flex items-start gap-2 text-xs text-yellow-500 bg-yellow-500/10 p-3 rounded">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <p>
                         <strong>Advertencia:</strong> Si dejas el campo de reglas vacío, la IA sabrá que el archivo existe, pero probablemente nunca lo envíe por iniciativa propia. ¡Dale la orden!
                      </p>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          {/* SECCIÓN 4: AUTO-APRENDIZAJE */}
          <TabsContent value="aprendizaje" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-400"/> Ciclo de Auto-Aprendizaje</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 text-slate-300">
                   <p className="text-sm">
                      Samurai v0.8+ tiene un sistema de "Lazo Cerrado". Esto significa que aprende en tiempo real mientras chatea.
                   </p>

                   <div className="relative pl-8 space-y-6 border-l border-slate-700 ml-4">
                      <div className="relative">
                         <div className="absolute -left-[39px] bg-slate-900 border border-slate-700 rounded-full w-6 h-6 flex items-center justify-center text-[10px] text-white font-bold">1</div>
                         <h4 className="font-bold text-white text-sm">Entrada (Input)</h4>
                         <p className="text-xs text-slate-400">El cliente envía un mensaje. Samurai analiza el tono (¿Enojado? ¿Feliz?) basándose en tus reglas de <em>Psicología</em>.</p>
                      </div>
                      <div className="relative">
                         <div className="absolute -left-[39px] bg-slate-900 border border-slate-700 rounded-full w-6 h-6 flex items-center justify-center text-[10px] text-white font-bold">2</div>
                         <h4 className="font-bold text-white text-sm">Análisis Oculto</h4>
                         <p className="text-xs text-slate-400">Antes de responder, Samurai genera un pensamiento interno: <em>"Este cliente está impaciente, debo ser breve."</em></p>
                      </div>
                      <div className="relative">
                         <div className="absolute -left-[39px] bg-slate-900 border border-slate-700 rounded-full w-6 h-6 flex items-center justify-center text-[10px] text-white font-bold">3</div>
                         <h4 className="font-bold text-white text-sm">Actualización de BD</h4>
                         <p className="text-xs text-slate-400">El sistema actualiza la ficha del Lead en la base de datos con el nuevo "Mood" y "Probabilidad de Compra".</p>
                      </div>
                      <div className="relative">
                         <div className="absolute -left-[39px] bg-indigo-600 rounded-full w-6 h-6 flex items-center justify-center text-[10px] text-white font-bold">4</div>
                         <h4 className="font-bold text-white text-sm">Próximo Mensaje</h4>
                         <p className="text-xs text-slate-400">Cuando el cliente vuelva a escribir, Samurai leerá el estado actualizado y adaptará su estrategia automáticamente.</p>
                      </div>
                   </div>

                   <div className="mt-4 p-4 bg-slate-800 rounded-lg">
                      <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-yellow-400"/> Cómo mejorarlo</h4>
                      <p className="text-xs text-slate-400">
                         Si notas que Samurai clasifica mal a los clientes, ve a <strong>Agent Brain {" > "} Psicología</strong> y refina las instrucciones. Sé más específico sobre qué constituye un cliente "Enojado" o "Listo para comprar".
                      </p>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

        </Tabs>
      </div>
    </Layout>
  );
};

export default Manual;