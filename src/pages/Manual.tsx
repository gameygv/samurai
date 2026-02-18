import React from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BookOpen, Brain, Zap, ShieldAlert, Target, 
  Database, Image, Lightbulb, AlertTriangle, ScanEye, FlaskConical,
  Terminal, Play, Pause
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
            <TabsTrigger value="comandos" className="py-2 px-4 data-[state=active]:bg-indigo-600"><Terminal className="w-4 h-4 mr-2"/> Comandos de Control</TabsTrigger>
            <TabsTrigger value="cerebro" className="py-2 px-4 data-[state=active]:bg-indigo-600">🧠 El Cerebro Core</TabsTrigger>
            <TabsTrigger value="conocimiento" className="py-2 px-4 data-[state=active]:bg-indigo-600">📚 Base de Conocimiento</TabsTrigger>
            <TabsTrigger value="media" className="py-2 px-4 data-[state=active]:bg-indigo-600">📸 Media & Triggers</TabsTrigger>
            <TabsTrigger value="aprendizaje" className="py-2 px-4 data-[state=active]:bg-indigo-600">🔄 Auto-Aprendizaje</TabsTrigger>
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
                      </div>

                      <div className="bg-green-900/10 border border-green-900/50 p-4 rounded-xl">
                         <div className="flex items-center gap-2 mb-2">
                            <Play className="w-5 h-5 text-green-500" />
                            <h3 className="font-bold text-white">#START</h3>
                         </div>
                         <p className="text-xs text-slate-400 mb-3">Reactiva al Samurai. Analizará lo que hablaste tú con el cliente mientras estaba pausado y retomará el hilo.</p>
                      </div>

                      <div className="bg-yellow-900/10 border border-yellow-900/50 p-4 rounded-xl">
                         <div className="flex items-center gap-2 mb-2">
                            <ShieldAlert className="w-5 h-5 text-yellow-500" />
                            <h3 className="font-bold text-white">#CIA</h3>
                         </div>
                         <p className="text-xs text-slate-400 mb-3">Úsalo para corregir al bot cuando se equivoque. Esto crea una "Lección Aprendida" en la base de datos.</p>
                      </div>
                   </div>

                </CardContent>
             </Card>
          </TabsContent>

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
                  <AccordionItem value="item-1">
                    <AccordionTrigger className="text-indigo-400 hover:text-indigo-300 font-bold">1. SISTEMA (La Identidad)</AccordionTrigger>
                    <AccordionContent className="text-slate-300 pt-2">
                      Es la instrucción más importante. Define <strong>quién es</strong> y <strong>qué vende</strong>.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Manual;