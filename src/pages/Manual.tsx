import React from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, Brain, Zap, ShieldAlert, 
  Terminal, Play, Pause, ShoppingCart, LinkIcon,
  Layers, Eye, Database, ShieldCheck, Heart, RefreshCcw,
  MessageCircle, DollarSign, Clock, Fingerprint, Image, Target
} from 'lucide-react';

const Manual = () => {
  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white flex items-center gap-3">
            <BookOpen className="w-10 h-10 text-indigo-500" />
            Manual de Operaciones v1.6
          </h1>
          <p className="text-slate-400 text-lg">
            Guía táctica del Protocolo Samurai.
          </p>
        </div>

        <Tabs defaultValue="protocolo" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 w-full justify-start p-1 h-auto flex-wrap">
            <TabsTrigger value="protocolo" className="py-2 px-4"><Target className="w-4 h-4 mr-2"/> Protocolo de Venta</TabsTrigger>
            <TabsTrigger value="arquitectura" className="py-2 px-4"><Layers className="w-4 h-4 mr-2"/> Arquitectura</TabsTrigger>
            <TabsTrigger value="vision" className="py-2 px-4"><Eye className="w-4 h-4 mr-2"/> Ojo de Halcón</TabsTrigger>
            <TabsTrigger value="comandos" className="py-2 px-4"><Terminal className="w-4 h-4 mr-2"/> Comandos</TabsTrigger>
          </TabsList>

          <TabsContent value="protocolo" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800 border-t-4 border-t-emerald-500">
                <CardHeader>
                   <CardTitle className="text-white text-lg">La Coreografía de 3 Fases</CardTitle>
                   <CardDescription>Samurai no improvisa. Sigue este orden estricto para maximizar conversión y datos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <div className="flex gap-4 items-start">
                      <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 font-bold border border-indigo-500/20 shrink-0">1</div>
                      <div>
                         <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Fingerprint className="w-4 h-4"/> Fase 1: Data Hunting (CAPI)</h4>
                         <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            Sam no soltará precios ni fechas exactas hasta obtener <strong>NOMBRE y CIUDAD</strong>. 
                            <br/><em>¿Por qué?</em> Porque Meta necesita esos datos para optimizar tus anuncios. Si regalamos la info, perdemos el Lead.
                         </p>
                      </div>
                   </div>
                   <div className="flex gap-4 items-start">
                      <div className="p-3 bg-pink-500/10 rounded-xl text-pink-400 font-bold border border-pink-500/20 shrink-0">2</div>
                      <div>
                         <h4 className="text-sm font-bold text-pink-400 uppercase tracking-widest flex items-center gap-2"><Image className="w-4 h-4"/> Fase 2: Seducción Visual</h4>
                         <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            Una vez que tenemos la CIUDAD, Sam busca en el <strong>Media Manager</strong> si hay un Poster específico para esa zona.
                            <br/>Si existe, envía la imagen. Si no, usa la información genérica de la Verdad Maestra.
                         </p>
                      </div>
                   </div>
                   <div className="flex gap-4 items-start">
                      <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 font-bold border border-emerald-500/20 shrink-0">3</div>
                      <div>
                         <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2"><DollarSign className="w-4 h-4"/> Fase 3: Cierre Financiero</h4>
                         <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            El objetivo final es el anticipo de <strong>$1,500 MXN</strong>.
                            <br/>Sam ofrecerá dos caminos: Link de Tarjeta (WooCommerce) o Datos para Transferencia (BBVA/Santander).
                         </p>
                      </div>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="arquitectura" className="mt-6 space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="bg-slate-900 border-slate-800">
                   <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2"><Layers className="w-5 h-5 text-indigo-400" /> Jerarquía de Respuesta</CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      {[
                        { l: "Nivel 1: Bitácora #CIA", d: "Instrucciones correctivas aprendidas. Tienen prioridad absoluta sobre todo lo demás.", c: "text-red-500 font-bold" },
                        { l: "Nivel 2: Verdad Maestra", d: "Datos duros (precios, fechas) leídos del sitio web oficial.", c: "text-green-400 font-bold" },
                        { l: "Nivel 3: ADN Core", d: "Personalidad, tono y el Protocolo de 3 Fases.", c: "text-purple-400 font-bold" }
                      ].map((item, i) => (
                        <div key={i} className="bg-slate-950 p-3 rounded border border-slate-800">
                           <p className={`text-xs ${item.c}`}>{item.l}</p>
                           <p className="text-[10px] text-slate-500 mt-1">{item.d}</p>
                        </div>
                      ))}
                   </CardContent>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="vision" className="mt-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-red-600">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><Eye className="w-5 h-5 text-red-600" /> Ojo de Halcón (Visión Financiera)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <p className="text-sm text-slate-400">Si un cliente envía una foto, Sam activa su módulo de visión GPT-4o.</p>
                   <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
                      <h4 className="text-xs font-bold text-red-500 uppercase">Capacidades:</h4>
                      <ul className="text-xs text-slate-300 space-y-2 list-disc pl-4">
                         <li>Detecta si es un Comprobante de Pago o un Poster/Screenshot.</li>
                         <li>Si es Comprobante: Extrae Banco, Monto, Fecha y Referencia.</li>
                         <li>Si es Poster: Extrae Fechas y Ciudad para entender el contexto.</li>
                      </ul>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="comandos" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2">Comandos de Control</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="bg-red-900/10 border border-red-900/50 p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-2 text-red-500 font-bold">
                         <Pause className="w-5 h-5" /> #STOP
                      </div>
                      <p className="text-xs text-slate-400">Pausa total de la IA en ese chat. Úsalo si quieres tomar el control manual.</p>
                   </div>
                   <div className="bg-green-900/10 border border-green-900/50 p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-2 text-green-500 font-bold">
                         <Play className="w-5 h-5" /> #START
                      </div>
                      <p className="text-xs text-slate-400">Reactiva a Sam. Retomará el protocolo donde se quedó.</p>
                   </div>
                   <div className="bg-yellow-900/10 border border-yellow-900/50 p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-2 text-yellow-500 font-bold">
                         <ShieldAlert className="w-5 h-5" /> #CIA
                      </div>
                      <p className="text-xs text-slate-400">Reporte de error. Escribe "#CIA [instrucción]" en el chat para enseñar una lección nueva.</p>
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