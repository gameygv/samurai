' como '>' para asegurar la compilación correcta en Vercel.">
import React from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, Brain, Zap, ShieldAlert, Target, 
  Database, Image, Lightbulb, AlertTriangle, ScanEye, FlaskConical,
  Terminal, Play, Pause, MessageSquare, Users, Settings, ShoppingCart, LinkIcon
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
            <TabsTrigger value="ecommerce" className="py-2 px-4 data-[state=active]:bg-indigo-600"><ShoppingCart className="w-4 h-4 mr-2"/> E-commerce</TabsTrigger>
            <TabsTrigger value="conocimiento" className="py-2 px-4 data-[state=active]:bg-indigo-600"><Database className="w-4 h-4 mr-2"/> Conocimiento</TabsTrigger>
            <TabsTrigger value="media" className="py-2 px-4 data-[state=active]:bg-indigo-600"><Image className="w-4 h-4 mr-2"/> Media</TabsTrigger>
            <TabsTrigger value="aprendizaje" className="py-2 px-4 data-[state=active]:bg-indigo-600"><Zap className="w-4 h-4 mr-2"/> Aprendizaje</TabsTrigger>
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
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="ecommerce" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-orange-500" /> Venta de Cursos & Anticipos
                   </CardTitle>
                   <CardDescription>Cómo configurar al Samurai para cerrar ventas automáticamente con links de WooCommerce.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
                      <h4 className="text-sm font-bold text-indigo-400 mb-2 flex items-center gap-2">
                         <LinkIcon className="w-4 h-4" /> Generador de Links Dinámicos
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                         El Samurai inyecta automáticamente los datos configurados en <strong>Ajustes > E-commerce</strong>. Puedes usar estas etiquetas en tus prompts:
                      </p>
                      <ul className="mt-3 space-y-2 text-[11px] font-mono">
                         <li className="text-slate-400"><span className="text-indigo-400">{"{ecommerce_url}"}</span>: La URL base de tu tienda.</li>
                         <li className="text-slate-400"><span className="text-indigo-400">{"{main_product_id}"}</span>: ID del producto de anticipo (ej: 1483).</li>
                         <li className="text-slate-400"><span className="text-indigo-400">{"{main_product_price}"}</span>: El monto a pagar (ej: 1500).</li>
                      </ul>
                   </div>

                   <div className="space-y-3">
                      <h4 className="text-sm font-bold text-white">Estrategia de Cierre Recomendada</h4>
                      <p className="text-xs text-slate-400">
                         Cuando un cliente pregunte por precios o inscripción a un taller, el Samurai debe responder siguiendo esta lógica:
                      </p>
                      <div className="bg-slate-950 p-4 rounded border border-slate-800 italic text-xs text-slate-500 leading-relaxed">
                         "Para asegurar tu lugar en el taller, puedes realizar el pago del anticipo de $1500 directamente aquí: [Link Generado]"
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
                         Ejemplo: "Eres el cerrador estrella de The Elephant Bowl. Vendes cuencos tibetanos..."
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
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

        </Tabs>
      </div>
    </Layout>
  );
};

export default Manual;