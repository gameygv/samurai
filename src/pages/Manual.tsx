import React from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, Brain, Zap, ShieldAlert, 
  Terminal, Play, Pause, ShoppingCart, LinkIcon,
  Layers, Eye, Database, ShieldCheck, Heart
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
            Guía maestra para configurar y potenciar tu Inteligencia Artificial.
          </p>
        </div>

        <Tabs defaultValue="arquitectura" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 w-full justify-start p-1 h-auto flex-wrap">
            <TabsTrigger value="arquitectura" className="py-2 px-4"><Layers className="w-4 h-4 mr-2"/> Arquitectura</TabsTrigger>
            <TabsTrigger value="comandos" className="py-2 px-4"><Terminal className="w-4 h-4 mr-2"/> Comandos</TabsTrigger>
            <TabsTrigger value="vision" className="py-2 px-4"><Eye className="w-4 h-4 mr-2"/> Ojo de Halcón</TabsTrigger>
            <TabsTrigger value="aprendizaje" className="py-2 px-4"><Zap className="w-4 h-4 mr-2"/> Aprendizaje</TabsTrigger>
          </TabsList>

          <TabsContent value="arquitectura" className="mt-6 space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-indigo-600">
                   <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2"><Layers className="w-5 h-5 text-indigo-400" /> Las 5 Capas del Cerebro</CardTitle>
                      <CardDescription>Samurai piensa en orden jerárquico.</CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      {[
                        { l: "Layer 1: #CIA", d: "Reglas de aprendizaje. Lo que se corrige en la Bitácora manda sobre todo lo demás.", c: "text-red-500 font-bold" },
                        { l: "Layer 2: ADN Core", d: "Identidad, tono y protocolos de venta del Samurai.", c: "text-indigo-400 font-bold" },
                        { l: "Layer 3: Verdad Maestra", d: "Datos indexados del sitio web oficial (theelephantbowl.com).", c: "text-green-400 font-bold" },
                        { l: "Layer 4: Media Catalog", d: "Posters y promociones disponibles para enviar.", c: "text-blue-400 font-bold" },
                        { l: "Layer 5: Ojo de Halcón", d: "Instrucciones de visión financiera y validación de pagos.", c: "text-red-600 font-bold" }
                      ].map((item, i) => (
                        <div key={i} className="bg-slate-950 p-3 rounded border border-slate-800">
                           <p className={`text-xs ${item.c}`}>{item.l}</p>
                           <p className="text-[10px] text-slate-500 mt-1">{item.d}</p>
                        </div>
                      ))}
                   </CardContent>
                </Card>

                <div className="space-y-6">
                   <Card className="bg-slate-900 border-slate-800">
                      <CardHeader>
                         <CardTitle className="text-white text-sm">Prioridad de Respuesta</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs text-slate-400 leading-relaxed space-y-3">
                         <p>Samurai siempre consultará primero si hay una regla **#CIA** que aplique al contexto actual.</p>
                         <p>Si un dato (como un precio) está en la **Verdad Maestra**, ese dato es ley. Nunca inventará información que no esté en la Layer 3.</p>
                         <p>El bot solo enviará imágenes si detecta que el **Trigger** configurado en el Media Manager coincide con la necesidad del cliente.</p>
                      </CardContent>
                   </Card>
                </div>
             </div>
          </TabsContent>

          <TabsContent value="comandos" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2">Comandos Maestros</CardTitle>
                   <CardDescription>Hashtags para control instantáneo en el chat.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="bg-red-900/10 border border-red-900/50 p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-2 text-red-500 font-bold">
                         <Pause className="w-5 h-5" /> #STOP
                      </div>
                      <p className="text-xs text-slate-400">Detiene a la IA. El bot no contestará hasta reactivarlo. Úsalo si quieres tomar el control manual total.</p>
                   </div>
                   <div className="bg-green-900/10 border border-green-900/50 p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-2 text-green-500 font-bold">
                         <Play className="w-5 h-5" /> #START
                      </div>
                      <p className="text-xs text-slate-400">Reactiva al Samurai para que retome la conversación desde donde se quedó.</p>
                   </div>
                   <div className="bg-yellow-900/10 border border-yellow-900/50 p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-2 text-yellow-500 font-bold">
                         <ShieldAlert className="w-5 h-5" /> #CIA
                      </div>
                      <p className="text-xs text-slate-400">Cuando la IA cometa un error, escribe #CIA seguido de la instrucción correcta para que aprenda.</p>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="vision" className="mt-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-red-600">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><Eye className="w-5 h-5 text-red-600" /> Ojo de Halcón (Visión Financiera)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <p className="text-sm text-slate-400">El Ojo de Halcón es el módulo de visión avanzada para validación de transacciones.</p>
                   <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
                      <h4 className="text-xs font-bold text-red-500 uppercase">Capacidades:</h4>
                      <ul className="text-xs text-slate-300 space-y-2 list-disc pl-4">
                         <li>Extracción de Referencia y Monto en recibos bancarios.</li>
                         <li>Identificación de Banco emisor.</li>
                         <li>Validación de autenticidad (en desarrollo).</li>
                         <li>Match automático con el ID de cliente para marcar ventas.</li>
                      </ul>
                   </div>
                   <p className="text-xs text-slate-500 italic">Configura las reglas de validación en la pestaña "Ojo de Halcón" dentro del Cerebro Core.</p>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="aprendizaje" className="mt-6">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-500" /> El Bucle de Aprendizaje</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                   <div className="flex flex-col md:flex-row justify-between gap-4">
                      {[
                        { n: "1", t: "REPORTAR", d: "Detecta un error y usa el comando #CIA en el chat.", i: ShieldAlert },
                        { n: "2", t: "VALIDAR", d: "Ve a la Bitácora #CIA y aprueba la nueva regla.", i: ShieldCheck },
                        { n: "3", t: "SINCRONIZAR", d: "Pulsa 'Sincronizar Cerebro' para inyectar la lección.", i: RefreshCcw }
                      ].map((step, i) => (
                        <div key={i} className="flex-1 text-center space-y-2">
                           <div className="w-12 h-12 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-indigo-500 font-bold">
                              {step.n}
                           </div>
                           <h4 className="text-xs font-bold text-white">{step.t}</h4>
                           <p className="text-[10px] text-slate-500">{step.d}</p>
                        </div>
                      ))}
                   </div>
                   <div className="bg-indigo-600/10 border border-indigo-500/20 p-4 rounded-xl flex items-start gap-4">
                      <Heart className="w-6 h-6 text-indigo-500 shrink-0" />
                      <p className="text-xs text-slate-300">Este proceso garantiza que Samurai nunca cometa el mismo error dos veces, volviéndose un vendedor más letal cada día.</p>
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