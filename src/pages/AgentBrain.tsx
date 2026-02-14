import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Save, Bot, Sparkles, AlertTriangle } from 'lucide-react';
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

const AgentBrain = () => {
  const [corePrompt, setCorePrompt] = useState(DEFAULT_CORE_PROMPT);

  const handleSave = () => {
    // Aquí conectaremos con Supabase más adelante
    toast.success('Configuración del ADN Core actualizada correctamente');
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Cerebro del Agente</h1>
            <p className="text-slate-400">Gestiona las directrices, personalidad y base de conocimiento del Samurai.</p>
          </div>
          <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700 text-white">
            <Save className="w-4 h-4 mr-2" />
            Guardar Cambios
          </Button>
        </div>

        <Tabs defaultValue="identity" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 p-1">
            <TabsTrigger value="identity" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              <Bot className="w-4 h-4 mr-2" /> Identidad Core
            </TabsTrigger>
            <TabsTrigger value="context" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              <Sparkles className="w-4 h-4 mr-2" /> Contexto Dinámico
            </TabsTrigger>
            <TabsTrigger value="correction" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              <AlertTriangle className="w-4 h-4 mr-2" /> Corrección
            </TabsTrigger>
          </TabsList>

          <TabsContent value="identity" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Editor Principal */}
              <div className="lg:col-span-2 space-y-4">
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <span>1.1 ADN Core del Samurai</span>
                      <span className="px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-500 border border-red-500/20">SISTEMA PRINCIPAL</span>
                    </CardTitle>
                    <CardDescription>Definición fundamental de la personalidad y misión.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea 
                      value={corePrompt}
                      onChange={(e) => setCorePrompt(e.target.value)}
                      className="min-h-[500px] bg-slate-950 border-slate-800 font-mono text-sm text-slate-300 focus:border-red-500/50 focus:ring-red-500/20 resize-none p-6 leading-relaxed"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Panel Lateral de Ayuda/Variables */}
              <div className="space-y-4">
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-sm text-slate-300">Variables Disponibles</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-2 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400">
                      {`{{agent_name}}`}
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400">
                      {`{{user_context}}`}
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400">
                      {`{{knowledge_base}}`}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-sm text-slate-300">Estado de Sincronización</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-green-500">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      Sincronizado
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Última actualización: Hace unos instantes</p>
                  </CardContent>
                </Card>
              </div>

            </div>
          </TabsContent>

          <TabsContent value="context">
            <div className="flex items-center justify-center h-64 border-2 border-dashed border-slate-800 rounded-lg text-slate-500">
              Esperando configuración Parte 2...
            </div>
          </TabsContent>
          
          <TabsContent value="correction">
            <div className="flex items-center justify-center h-64 border-2 border-dashed border-slate-800 rounded-lg text-slate-500">
              Esperando configuración Parte 3...
            </div>
          </TabsContent>
        </Tabs>

      </div>
    </Layout>
  );
};

export default AgentBrain;