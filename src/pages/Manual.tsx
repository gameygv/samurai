import React from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, Brain, Zap, ShieldAlert, 
  Terminal, Play, Pause, ShoppingCart, LinkIcon
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

        <Tabs defaultValue="comandos" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 w-full justify-start p-1 h-auto flex-wrap">
            <TabsTrigger value="comandos" className="py-2 px-4"><Terminal className="w-4 h-4 mr-2"/> Comandos</TabsTrigger>
            <TabsTrigger value="ecommerce" className="py-2 px-4"><ShoppingCart className="w-4 h-4 mr-2"/> E-commerce</TabsTrigger>
            <TabsTrigger value="aprendizaje" className="py-2 px-4"><Zap className="w-4 h-4 mr-2"/> Aprendizaje</TabsTrigger>
          </TabsList>

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
                      <p className="text-xs text-slate-400">Detiene a la IA. El bot no contestará hasta reactivarlo.</p>
                   </div>
                   <div className="bg-green-900/10 border border-green-900/50 p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-2 text-green-500 font-bold">
                         <Play className="w-5 h-5" /> #START
                      </div>
                      <p className="text-xs text-slate-400">Reactiva al Samurai para que retome la conversación.</p>
                   </div>
                   <div className="bg-yellow-900/10 border border-yellow-900/50 p-4 rounded-xl">
                      <div className="flex items-center gap-2 mb-2 text-yellow-500 font-bold">
                         <ShieldAlert className="w-5 h-5" /> #CIA
                      </div>
                      <p className="text-xs text-slate-400">Corrige errores de la IA y genera aprendizaje.</p>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="ecommerce" className="mt-6">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2">Ventas y Anticipos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                   <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
                      <h4 className="text-sm font-bold text-indigo-400 mb-2 flex items-center gap-2">
                         <LinkIcon className="w-4 h-4" /> Links Dinámicos
                      </h4>
                      <p className="text-xs text-slate-300">Usa estas etiquetas en tus prompts:</p>
                      <ul className="mt-3 space-y-2 text-[11px] font-mono text-slate-400">
                         <li>{"{ecommerce_url}"} : URL de la tienda</li>
                         <li>{"{main_product_id}"} : ID del anticipo</li>
                         <li>{"{main_product_price}"} : Precio del curso</li>
                      </ul>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="aprendizaje" className="mt-6">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-white">Bucle de Aprendizaje</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                   <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                      <Badge className="mb-2">1. Reportar</Badge>
                      <p className="text-[10px] text-slate-500">Usa #CIA en el chat</p>
                   </div>
                   <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                      <Badge className="mb-2">2. Validar</Badge>
                      <p className="text-[10px] text-slate-500">Aprueba en Bitácora</p>
                   </div>
                   <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                      <Badge className="mb-2">3. Sincronizar</Badge>
                      <p className="text-[10px] text-slate-500">Actualiza el Cerebro</p>
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