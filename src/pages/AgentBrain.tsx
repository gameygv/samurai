"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bot, Eye as EyeIcon, Loader2, Terminal, BrainCircuit, Target, 
  GitBranch, Layers, Fingerprint, MessageSquare, FlaskConical, Save, BarChart3, ShieldAlert
} from 'lucide-react';
import { PromptEditor } from '@/components/brain/PromptEditor';
import { KernelStep } from '@/components/brain/KernelStep';
import { LabTab } from '@/components/brain/LabTab';
import { SimulatorTab } from '@/components/brain/SimulatorTab';
import { DebugTab } from '@/components/brain/DebugTab';
import { VersionsTab } from '@/components/brain/VersionsTab';
import { toast } from 'sonner';

const AgentBrain = () => {
  const { isDev } = useAuth();
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

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(prompts).map(([key, value]) => ({
        key, value, category: 'PROMPT', updated_at: new Date().toISOString()
      }));

      const { error } = await supabase.from('app_config').upsert(updates, { onConflict: 'key' });
      if (error) throw error;
      
      toast.success("Cerebro sincronizado correctamente.");
      fetchVersions();
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-amber-500 w-10 h-10" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto flex flex-col h-[calc(100vh-140px)] gap-6 overflow-hidden">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-tactical">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-900/30 rounded-xl border border-indigo-900/50 shadow-glow">
               <BrainCircuit className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-50 tracking-tight">Neural Core Control</h1>
              <p className="text-slate-400 text-sm">Ajuste fino de la consciencia y protocolos operativos.</p>
            </div>
          </div>
          <Button onClick={handleSaveAll} disabled={saving} className="bg-indigo-900 hover:bg-indigo-800 text-slate-50 h-11 px-8 font-bold shadow-glow transition-all active:scale-95 rounded-xl uppercase tracking-widest text-xs">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2 text-amber-500" />} GUARDAR CONFIGURACIÓN
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })} className="flex-1 flex flex-col min-h-0">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-4 shrink-0 h-auto flex-wrap justify-start gap-1 rounded-xl">
             <TabsTrigger value="alma" className="gap-2 px-4 py-2 data-[state=active]:bg-indigo-900/50 data-[state=active]:text-amber-500"><Bot className="w-4 h-4"/> 1. Personalidad</TabsTrigger>
             <TabsTrigger value="identidad" className="gap-2 px-4 py-2 data-[state=active]:bg-indigo-900/50 data-[state=active]:text-amber-500"><Fingerprint className="w-4 h-4"/> 2. ADN Táctico</TabsTrigger>
             <TabsTrigger value="vision" className="gap-2 px-4 py-2 data-[state=active]:bg-indigo-900/50 data-[state=active]:text-amber-500"><EyeIcon className="w-4 h-4"/> 3. Ojo de Halcón</TabsTrigger>
             <TabsTrigger value="analista" className="gap-2 px-4 py-2 data-[state=active]:bg-indigo-900/50 data-[state=active]:text-amber-500"><BarChart3 className="w-4 h-4"/> 4. Analista CAPI</TabsTrigger>
             <TabsTrigger value="versiones" className="gap-2 px-4 py-2 data-[state=active]:bg-indigo-900/50 data-[state=active]:text-amber-500"><GitBranch className="w-4 h-4"/> Snapshots</TabsTrigger>
             <TabsTrigger value="lab" className="gap-2 px-4 py-2 bg-amber-500/10 text-amber-500 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 ml-auto"><FlaskConical className="w-4 h-4"/> Laboratorio IA</TabsTrigger>
          </TabsList>

          <div className="flex-1 flex flex-col min-h-0">
            <TabsContent value="alma" className="m-0 h-full">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                  <PromptEditor title="Alma Samurai (Tono y Estilo)" icon={Bot} value={prompts['prompt_alma_samurai']} onChange={v => handlePromptChange('prompt_alma_samurai', v)} color="text-amber-500" />
                  <Card className="bg-slate-900 border-slate-800 flex flex-col shadow-tactical rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-slate-800 bg-slate-950/30"><CardTitle className="text-slate-50 text-[10px] uppercase tracking-widest flex items-center gap-2"><Layers className="w-4 h-4 text-indigo-400" /> Jerarquía de Procesamiento</CardTitle></CardHeader>
                    <ScrollArea className="flex-1 p-6">
                      <div className="space-y-4">
                          <KernelStep num={1} title="Alma Core" desc="Define el 'quién soy'. El filtro de personalidad inicial." color="text-amber-500" icon={Bot}/>
                          <KernelStep num={2} title="Analista Silencioso" desc="Extracción continua de metadatos (Emails, CRM)." color="text-emerald-400" icon={BarChart3}/>
                          <KernelStep num={3} title="Protocolo de Cierre" desc="Lógica de ventas y manejo de objeciones." color="text-indigo-400" icon={Target}/>
                          <KernelStep num={4} title="Visión Ojo de Halcón" desc="Análisis forense de imágenes y comprobantes." color="text-slate-400" icon={EyeIcon}/>
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
            </TabsContent>

            <TabsContent value="lab" className="m-0 h-full flex flex-col">
                <LabTab currentPrompts={prompts} onApplyPrompts={p => setPrompts(p)} />
            </TabsContent>
            
            {/* Otros contenidos de tabs simplificados */}
            <TabsContent value="identidad" className="m-0 h-full">
                <PromptEditor title="ADN Estratégico (Ventas)" icon={Fingerprint} value={prompts['prompt_adn_core']} onChange={v => handlePromptChange('prompt_adn_core', v)} color="text-amber-500" />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AgentBrain;