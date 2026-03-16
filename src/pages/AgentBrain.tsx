"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bot, Eye as EyeIcon, Loader2, Terminal, BrainCircuit, Target, 
  GitBranch, Layers, Fingerprint, MessageSquare, FlaskConical, Save, BarChart3
} from 'lucide-react';
import { PromptEditor } from '@/components/brain/PromptEditor';
import { KernelStep } from '@/components/brain/KernelStep';
import { LabTab } from '@/components/brain/LabTab';
import { SimulatorTab } from '@/components/brain/SimulatorTab';
import { DebugTab } from '@/components/brain/DebugTab';
import { VersionsTab } from '@/components/brain/VersionsTab';
import { toast } from 'sonner';

const AgentBrain = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'alma';
  
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);

  useEffect(() => { fetchPrompts(); fetchVersions(); }, []);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
        const { data } = await supabase.from('app_config').select('key, value').eq('category', 'PROMPT');
        if (data) {
            const p: any = {};
            data.forEach(item => p[item.key] = item.value);
            
            // Si el analista está vacío, inyectar el prompt maestro inicial mejorado
            if (!p['prompt_analista_datos']) {
                p['prompt_analista_datos'] = `Eres el "Data Extractor" de The Elephant Bowl. Tu única misión es analizar la conversación y devolver un objeto JSON estricto con los datos del prospecto. No escribas texto adicional, solo el JSON.

REGLAS DE EXTRACCIÓN (ANTI-ALUCINACIÓN):
1. Identifica datos de contacto para Meta CAPI (Nombre, Apellido, Email, Ciudad, Estado, CP).
2. Si el cliente NO HA ESCRITO SU CORREO explícitamente, o dice "no tengo", debes devolver "email": "null". NUNCA inventes un correo.
3. Determina el 'intent' (Intención de Compra):
   - BAJO: Preguntas genéricas, saludo inicial.
   - MEDIO: Pide detalles de fechas, pregunta por el profesor, ha visto posters.
   - ALTO: Pide link de pago, pide cuenta bancaria, confirma que va a asistir.
4. 'main_pain': Identifica qué quiere sanar o aprender el cliente (ej: estrés, aprender técnica, sanación sonora).
5. 'lead_score': Del 1 al 100. Sube el score por cada dato obtenido (Email +20, Ciudad +20, Intención Alta +40).

ESTRUCTURA JSON OBLIGATORIA:
{
  "nombre": "string o null",
  "apellido": "string o null",
  "email": "string o null",
  "ciudad": "string o null",
  "estado": "string o null",
  "cp": "string o null",
  "pais": "mx",
  "intent": "BAJO | MEDIO | ALTO",
  "summary": "Resumen de 1 oración del estado actual",
  "origen_contacto": "WhatsApp",
  "servicio_interes": "Taller Cuencos / Certificación / etc",
  "tiempo_compra": "Urgencia detectada o null",
  "main_pain": "string o null",
  "lead_score": number
}`;
            }
            setPrompts(p);
        }
    } finally { setLoading(false); }
  };

  const fetchVersions = async () => {
    const { data } = await supabase.from('prompt_versions').select('*').order('created_at', { ascending: false });
    if (data) setVersions(data);
  };

  const handlePromptChange = (key: string, value: string) => {
    setPrompts(prev => ({ ...prev, [key]: value }));
  };

  const handleApplyPrompts = (newPrompts: Record<string, string>) => {
    setPrompts(newPrompts);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(prompts).map(([key, value]) => ({
        key,
        value,
        category: 'PROMPT',
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase.from('app_config').upsert(updates, { onConflict: 'key' });
      if (error) throw error;
      
      const { data: { session } } = await supabase.auth.getSession();
      const autoVersionName = `Auto-Save v${versions.length + 1}.0`;
      
      const { error: snapError } = await supabase.from('prompt_versions').insert({
         version_name: autoVersionName,
         prompts_snapshot: prompts,
         created_by: session?.user?.id || null,
         notes: 'Guardado automático por modificación de prompts'
      });

      if (snapError) {
          console.error("Error creando auto-snapshot:", snapError);
          toast.success("Cerebro actualizado, pero no se pudo generar el snapshot automático.");
      } else {
          toast.success("Cerebro actualizado y Snapshot automático creado.");
      }

      fetchVersions();
    } catch (err: any) {
      toast.error("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSnapshot = async () => {
     const name = prompt("Nombre del Snapshot:", `v${versions.length + 1}.0 - Manual`);
     if (!name) return;
     
     setSaving(true);
     try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const { error } = await supabase.from('prompt_versions').insert({
           version_name: name,
           prompts_snapshot: prompts,
           created_by: session?.user?.id || null
        });
        
        if (error) throw error;
        toast.success("Snapshot manual creado correctamente.");
        fetchVersions();
     } catch (err: any) {
        console.error("Error Snapshot:", err);
        toast.error("Error al guardar: " + err.message);
     } finally { 
        setSaving(false); 
     }
  };

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-amber-500 w-10 h-10" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto flex flex-col h-[calc(100vh-140px)] gap-6 overflow-hidden">
        
        {/* Header Superior */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-900/30 rounded-xl border border-indigo-900/50">
               <BrainCircuit className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-50 tracking-tight">Cerebro Core</h1>
              <p className="text-slate-400 text-sm">Configuración de la consciencia operativa.</p>
            </div>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" onClick={handleCreateSnapshot} className="border-slate-700 text-slate-300 hover:bg-slate-800 h-11 px-6 font-bold rounded-xl">
                <GitBranch className="w-4 h-4 mr-2 text-amber-500"/> SNAPSHOT
             </Button>
             <Button onClick={handleSaveAll} disabled={saving} className="bg-indigo-900 hover:bg-indigo-800 text-slate-50 h-11 px-8 font-bold shadow-lg transition-all active:scale-95 rounded-xl uppercase tracking-widest text-xs">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2 text-amber-500" />} APLICAR CAMBIOS
             </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })} className="flex-1 flex flex-col min-h-0">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-4 shrink-0 h-auto flex-wrap justify-start gap-1 rounded-xl">
             <TabsTrigger value="alma" className="gap-2 px-4 py-2 data-[state=active]:bg-indigo-900/50 data-[state=active]:text-amber-500"><Bot className="w-4 h-4"/> 1. Alma</TabsTrigger>
             <TabsTrigger value="identidad" className="gap-2 px-4 py-2 data-[state=active]:bg-indigo-900/50 data-[state=active]:text-amber-500"><Fingerprint className="w-4 h-4"/> 2. ADN & Venta</TabsTrigger>
             <TabsTrigger value="vision" className="gap-2 px-4 py-2 data-[state=active]:bg-indigo-900/50 data-[state=active]:text-amber-500"><EyeIcon className="w-4 h-4"/> 3. Ojo Halcón</TabsTrigger>
             <TabsTrigger value="analista" className="gap-2 px-4 py-2 data-[state=active]:bg-indigo-900/50 data-[state=active]:text-amber-500"><BarChart3 className="w-4 h-4"/> 4. Analista CAPI</TabsTrigger>
             <TabsTrigger value="debug" className="gap-2 px-4 py-2 data-[state=active]:bg-indigo-900/50 data-[state=active]:text-amber-500"><Terminal className="w-4 h-4"/> 5. Inspección</TabsTrigger>
             <TabsTrigger value="versiones" className="gap-2 px-4 py-2 data-[state=active]:bg-indigo-900/50 data-[state=active]:text-amber-500"><GitBranch className="w-4 h-4"/> Snapshots</TabsTrigger>
             <TabsTrigger value="simulador" className="gap-2 px-4 py-2 data-[state=active]:bg-indigo-900/50 data-[state=active]:text-amber-500"><MessageSquare className="w-4 h-4"/> Simulador</TabsTrigger>
             <TabsTrigger value="lab" className="gap-2 px-4 py-2 bg-indigo-900/20 text-slate-400 data-[state=active]:bg-amber-600 data-[state=active]:text-slate-950 ml-auto"><FlaskConical className="w-4 h-4"/> Laboratorio IA</TabsTrigger>
          </TabsList>

          <div className="flex-1 flex flex-col min-h-0 bg-transparent rounded-xl p-1">
            
            <TabsContent value="lab" className="m-0 h-full flex flex-col data-[state=inactive]:hidden">
                <LabTab currentPrompts={prompts} onApplyPrompts={handleApplyPrompts} />
            </TabsContent>

            <TabsContent value="alma" className="m-0 h-full flex flex-col data-[state=inactive]:hidden">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                  <div className="h-full min-h-0">
                     <PromptEditor title="Alma de The Elephant Bowl" icon={Bot} value={prompts['prompt_alma_samurai']} onChange={v => handlePromptChange('prompt_alma_samurai', v)} color="text-amber-500" />
                  </div>
                  <Card className="bg-slate-900 border-slate-800 flex flex-col h-full overflow-hidden shadow-2xl rounded-2xl">
                    <CardHeader className="shrink-0 py-4 border-b border-slate-800 bg-slate-950/30"><CardTitle className="text-slate-50 text-xs uppercase tracking-widest flex items-center gap-2"><Layers className="w-4 h-4 text-amber-500" /> Jerarquía Técnica</CardTitle></CardHeader>
                    <ScrollArea className="flex-1 p-6">
                      <div className="space-y-4">
                          <KernelStep num={1} title="Alma & ADN Core" desc="Personalidad y Tono." color="text-amber-500" icon={Bot}/>
                          <KernelStep num={2} title="Analista Silencioso" desc="Extracción de datos para CAPI." color="text-emerald-400" icon={BarChart3}/>
                          <KernelStep num={3} title="Estrategia de Cierre" desc="Protocolo táctico de ventas." color="text-indigo-300" icon={Target}/>
                          <KernelStep num={4} title="Ojo de Halcón" desc="Auditoría visual de pagos." color="text-slate-400" icon={EyeIcon}/>
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
            </TabsContent>

            <TabsContent value="identidad" className="m-0 h-full data-[state=inactive]:hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full min-h-0">
                   <div className="h-full min-h-0">
                      <PromptEditor title="ADN Core" icon={Fingerprint} value={prompts['prompt_adn_core']} onChange={v => handlePromptChange('prompt_adn_core', v)} color="text-amber-500" />
                   </div>
                   <div className="h-full min-h-0">
                      <PromptEditor title="Estrategia de Cierre" icon={Target} value={prompts['prompt_estrategia_cierre']} onChange={v => handlePromptChange('prompt_estrategia_cierre', v)} color="text-indigo-300" />
                   </div>
                </div>
            </TabsContent>
            
            <TabsContent value="vision" className="m-0 h-full data-[state=inactive]:hidden">
                <PromptEditor title="Ojo de Halcón" icon={EyeIcon} value={prompts['prompt_vision_instrucciones']} onChange={v => handlePromptChange('prompt_vision_instrucciones', v)} color="text-amber-500" />
            </TabsContent>

            <TabsContent value="analista" className="m-0 h-full data-[state=inactive]:hidden">
                <PromptEditor 
                  title="Analista Silencioso (CAPI Data)" 
                  icon={BarChart3} 
                  value={prompts['prompt_analista_datos']} 
                  onChange={v => handlePromptChange('prompt_analista_datos', v)} 
                  color="text-emerald-500" 
                  placeholder="Instrucciones de extracción JSON..."
                />
            </TabsContent>

            <TabsContent value="debug" className="m-0 h-full flex flex-col data-[state=inactive]:hidden">
                <DebugTab isActive={activeTab === 'debug'} />
            </TabsContent>

            <TabsContent value="versiones" className="m-0 h-full data-[state=inactive]:hidden flex flex-col">
               <VersionsTab 
                 versions={versions} 
                 onRefresh={fetchVersions} 
                 onRestore={(snapshot) => handleApplyPrompts(snapshot.prompts_snapshot)} 
               />
            </TabsContent>

            <TabsContent value="simulador" className="m-0 h-full flex flex-col data-[state=inactive]:hidden">
                <SimulatorTab currentPrompts={prompts} />
            </TabsContent>

          </div>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AgentBrain;