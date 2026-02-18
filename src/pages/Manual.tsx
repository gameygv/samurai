import React from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, Brain, Zap, ShieldAlert, Target, 
  Database, Image, Lightbulb, AlertTriangle, ScanEye, FlaskConical,
  Terminal, Play, Pause, MessageSquare, Users, Settings
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

        <Tabs defaultValue="comandos" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 w-full justify-start p-1 h-auto flex-wrap">
            <TabsTrigger value="comandos" className="py-2 px-4 data-[state=active]:bg-indigo-600"><Terminal className="w-4 h-4 mr-2"/> Comandos</TabsTrigger>
            <TabsTrigger value="cerebro" className="py-2 px-4 data-[state=active]:bg-indigo-600"><Brain className="w-4 h-4 mr-2"/> Cerebro</TabsTrigger>
            <TabsTrigger value="conocimiento" className="py-2 px-4 data-[state=active]:bg-indigo-600"><Database className="w-4 h-4 mr-2"/> Conocimiento</TabsTrigger>
            <TabsTrigger value="media" className="py-2 px-4 data-[state=active]:bg-indigo-600"><Image className="w-4 h-4 mr-2"/> Media</TabsTrigger>
            <TabsTrigger value="aprendizaje" className="py-2 px-4 data-[state=active]:bg-indigo-600"><Zap className="w-4 h-4 mr-2"/> Aprendizaje</TabsTrigger>
            <TabsTrigger value="leads" className="py-2 px-4 data-[state=active]:bg-indigo-600"><Users className="w-4 h-4 mr-2"/> Leads</TabsTrigger>
          </TabsList>

          <TabsContent value="comandos" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><Terminal className="w-5 h-5 text-indigo-500"/> Comandos Maestros</CardTitle>
                   <CardDescription>Usa estos hashtags en el chat para controlar al Samurai instantáneamente.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-red-900/10 border border-red-900/50 p-4 rounded-xl">
                         <div className="flex items-center gap-2 mb-2">
                            <Pause className="w-5 h-5 text-red-500" />
                            <h3 className="font-bold text-white">#STOP</h3>
                         </div>
                         <p className="text-xs text-slate-400 mb-3">Detiene inmediatamente a la IA. El bot se despedirá educadamente y no volverá a contestar hasta que lo reactives.</p>
                         <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">Pausa Total</Badge>
                      </div>

                      <div className="bg-green-900/10 border border-green-900/50 p-4 rounded-xl">
                         <div className="flex items-center gap-2 mb-2">
                            <Play className="w-5 h-5 text-green-500" />
                            <h3 className="font-bold text-white">#START</h3>
                         </div>
                         <p className="text-xs text-slate-400 mb-3">Reactiva al Samurai. Analizará lo que hablaste tú con el cliente mientras estaba pausado y retomará el hilo.</p>
                         <Badge variant="outline" className="text-[9px] border-green-500/30 text-green-400">Reactivación</Badge>
                      </div>

                      <div className="bg-yellow-900/10 border border-yellow-900/50 p-4 rounded-xl">
                         <div className="flex items-center gap-2 mb-2">
                            <ShieldAlert className="w-5 h-5 text-yellow-500" />
                            <h3 className="font-bold text-white">#CIA</h3>
                         </div>
                         <p className="text-xs text-slate-400 mb-3">Úsalo para corregir al bot cuando se equivoque. Esto crea una "Lección Aprendida" en la base de datos.</p>
                         <Badge variant="outline" className="text-[9px] border-yellow-500/30 text-red-400">Corrección IA</Badge>
                      </div>
                   </div>

                   <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                      <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                         <Lightbulb className="w-4 h-4 text-yellow-500" /> Ejemplo de Uso
                      </h4>
                      <div className="space-y-2 text-xs text-slate-400 font-mono">
                         <p><span className="text-green-400">Usuario:</span> "El cliente está muy molesto, mejor lo atiendo yo"</p>
                         <p><span className="text-blue-400">Tú escribes:</span> #STOP</p>
                         <p><span className="text-indigo-400">Samurai:</span> "Entendido, me retiro. Avísame cuando pueda volver."</p>
                      </div>
                   </div>

                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="cerebro" className="mt-6 space-y-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                   <Brain className="w-5 h-5 text-red-500" /> Arquitectura de Prompts
                </CardTitle>
                <CardDescription>
                  Cada casilla en "Agent Brain" es una variable que se inyecta en el Prompt del Sistema.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger className="text-indigo-400 hover:text-indigo-300 font-bold">1. SISTEMA (La Identidad)</AccordionTrigger>
                    <AccordionContent className="text-slate-300 pt-2 space-y-2">
                      <p>Es la instrucción más importante. Define <strong>quién es</strong> y <strong>qué vende</strong>.</p>
                      <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs font-mono">
                         Ejemplo: "Eres el cerrador estrella de The Elephant Bowl. Vendes cuencos tibetanos y gongs de alta gama..."
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-2">
                    <AccordionTrigger className="text-indigo-400 hover:text-indigo-300 font-bold">2. TÉCNICO (Formato de Respuesta)</AccordionTrigger>
                    <AccordionContent className="text-slate-300 pt-2 space-y-2">
                      <p>Aquí defines cómo debe estructurar sus respuestas, incluyendo el bloque JSON de análisis.</p>
                      <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs font-mono">
                         {"[[ANALYSIS: { \"mood\": \"FELIZ\", \"intent\": \"ALTO\" }]]"}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-3">
                    <AccordionTrigger className="text-indigo-400 hover:text-indigo-300 font-bold">3. CONTEXTO (Información del Negocio)</AccordionTrigger>
                    <AccordionContent className="text-slate-300 pt-2">
                      <p>Datos sobre productos, precios, políticas de envío, etc.</p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-4">
                    <AccordionTrigger className="text-indigo-400 hover:text-indigo-300 font-bold">4. PSICOLOGÍA (Perfilado Emocional)</AccordionTrigger>
                    <AccordionContent className="text-slate-300 pt-2">
                      <p>Instrucciones para que el Samurai detecte el estado emocional y la intención de compra del cliente.</p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-5">
                    <AccordionTrigger className="text-indigo-400 hover:text-indigo-300 font-bold">5. VISIÓN (Análisis de Imágenes)</AccordionTrigger>
                    <AccordionContent className="text-slate-300 pt-2">
                      <p>Qué hacer cuando el cliente envía fotos de productos o espacios.</p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="item-6">
                    <AccordionTrigger className="text-indigo-400 hover:text-indigo-300 font-bold">6. LECCIONES APRENDIDAS (#CIA)</AccordionTrigger>
                    <AccordionContent className="text-slate-300 pt-2">
                      <p className="text-yellow-400 font-bold mb-2">⚠️ Esta sección es de SOLO LECTURA</p>
                      <p>Se actualiza automáticamente cuando validas correcciones en la Bitácora #CIA.</p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conocimiento" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2">
                      <Database className="w-5 h-5 text-emerald-500" /> Base de Conocimiento
                   </CardTitle>
                   <CardDescription>Cómo alimentar la memoria del Samurai con documentos y sitios web.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                      <h4 className="text-sm font-bold text-white mb-2">Tipos de Recursos</h4>
                      <ul className="space-y-2 text-xs text-slate-400">
                         <li className="flex items-start gap-2">
                            <span className="text-blue-400">•</span>
                            <span><strong>PDFs:</strong> Catálogos, listas de precios, manuales de productos</span>
                         </li>
                         <li className="flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            <span><strong>Sitios Web:</strong> Páginas de maestros, eventos, talleres</span>
                         </li>
                         <li className="flex items-start gap-2">
                            <span className="text-yellow-400">•</span>
                            <span><strong>Texto Plano:</strong> FAQs, políticas, scripts de ventas</span>
                         </li>
                      </ul>
                   </div>

                   <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
                      <h4 className="text-sm font-bold text-indigo-400 mb-2 flex items-center gap-2">
                         <Zap className="w-4 h-4" /> Auto-Sincronización
                      </h4>
                      <p className="text-xs text-slate-400">
                         Los sitios web se actualizan automáticamente cada 24 horas. También puedes forzar la sincronización manualmente.
                      </p>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="media" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2">
                      <Image className="w-5 h-5 text-purple-500" /> Media Manager & Triggers
                   </CardTitle>
                   <CardDescription>Cómo usar imágenes y videos con instrucciones de detonación automática.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   <p className="text-sm text-slate-300">
                      Cada archivo multimedia puede tener <strong>instrucciones de trigger</strong> que le dicen al Samurai cuándo enviarlo.
                   </p>

                   <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                      <h4 className="text-sm font-bold text-white mb-3">Ejemplo de Trigger</h4>
                      <div className="space-y-2">
                         <div className="flex items-center gap-2 text-xs">
                            <Badge className="bg-purple-600">Archivo</Badge>
                            <span className="text-slate-400">catalogo-cuencos-2026.pdf</span>
                         </div>
                         <div className="bg-slate-900 p-3 rounded border border-slate-700">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Instrucción IA:</p>
                            <p className="text-xs text-slate-300 italic">
                               "Envía este catálogo cuando el cliente pregunte por precios de mayoreo o quiera ver todos los modelos disponibles."
                            </p>
                         </div>
                      </div>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="aprendizaje" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-500" /> Sistema de Auto-Aprendizaje
                   </CardTitle>
                   <CardDescription>Cómo funciona el bucle de corrección y mejora continua.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-center">
                         <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-2">
                            <span className="text-red-500 font-bold">1</span>
                         </div>
                         <h4 className="text-xs font-bold text-white mb-1">Detectar Error</h4>
                         <p className="text-[10px] text-slate-400">Usa #CIA en el chat cuando la IA se equivoque</p>
                      </div>

                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-center">
                         <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-2">
                            <span className="text-yellow-500 font-bold">2</span>
                         </div>
                         <h4 className="text-xs font-bold text-white mb-1">Validar Lección</h4>
                         <p className="text-[10px] text-slate-400">Ve a Bitácora #CIA y aprueba la corrección</p>
                      </div>

                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-center">
                         <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-2">
                            <span className="text-green-500 font-bold">3</span>
                         </div>
                         <h4 className="text-xs font-bold text-white mb-1">Sincronizar</h4>
                         <p className="text-[10px] text-slate-400">Inyecta las reglas al Cerebro Core</p>
                      </div>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="leads" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-500" /> Gestión de Leads
                   </CardTitle>
                   <CardDescription>Cómo interpretar el análisis psicológico y la memoria del cliente.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                      <h4 className="text-sm font-bold text-white mb-3">Panel de Memoria Viva</h4>
                      <ul className="space-y-2 text-xs text-slate-400">
                         <li className="flex items-start gap-2">
                            <span className="text-green-400">•</span>
                            <span><strong>Estado Emocional:</strong> FELIZ, NEUTRO, ENOJADO, PRAGMÁTICO</span>
                         </li>
                         <li className="flex items-start gap-2">
                            <span className="text-yellow-400">•</span>
                            <span><strong>Intención de Compra:</strong> ALTO (90%), MEDIO (50%), BAJO (20%)</span>
                         </li>
                         <li className="flex items-start gap-2">
                            <span className="text-blue-400">•</span>
                            <span><strong>Resumen Contextual:</strong> Lo que el Samurai recuerda del cliente</span>
                         </li>
                      </ul>
                   </div>

                   <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                      <h4 className="text-sm font-bold text-yellow-400 mb-2 flex items-center gap-2">
                         <AlertTriangle className="w-4 h-4" /> Handoff Automático
                      </h4>
                      <p className="text-xs text-slate-400">
                         Si el Samurai detecta una situación delicada, pausará automáticamente y te notificará vía webhook.
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