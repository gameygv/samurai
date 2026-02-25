import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Save, Bot, Eye, History, Zap, Loader2, FileText, Scan, Terminal, FlaskConical, BrainCircuit, ShieldAlert, Target, GitBranch, User, Calendar, RefreshCcw, Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const AgentBrain = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'identidad';
  const { user, profile } = useAuth();
  
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [masterPromptPreview, setMasterPromptPreview] = useState("");
  
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState<{ system_prompt: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const [versions, setVersions] = useState<any[]>([]);
  const [viewingVersion, setViewingVersion] = useState<any>(null);

  useEffect(() => {
    fetchPrompts();
    fetchVersions();
  }, []);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('app_config').select('key, value').eq('category', 'PROMPT');
      if (data) {
        const p: any = {};
        data.forEach(item => p[item.key] = item.value);
        setPrompts(p);
      }
      
      const { data: brainData } = await supabase.functions.invoke('get-samurai-context');
      if (brainData) setMasterPromptPreview(brainData.system_prompt);
      
    } finally {
      setLoading(false);
    }
  };

  const fetchVersions = async () => {
    const { data } = await supabase.from('prompt_versions').select('*').order('created_at', { ascending: false });
    if (data) setVersions(data);
  };

  const handleRunSimulation = async () => {
     setTesting(true);
     try {
        const { data, error } = await supabase.functions.invoke('get-samurai-context');
        if (error) throw error;
        setTestResult(data);
     } catch (err: any) {
        toast.error("Error cargando consciencia: " + err.message);
     } finally {
        setTesting(false);
     }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const versionName = `Update Kernel - ${new Date().toLocaleString()}`;
      await supabase.from('prompt_versions').insert({
          version_name: versionName,
          prompts_snapshot: prompts,
          created_by: user?.id,
          created_by_name: profile?.full_name || user?.email
      });

      const promptsToSave = Object.entries(prompts).map(([key, value]) => ({
        key, value, category: 'PROMPT',
      }));

      await supabase.from('app_config').upsert(promptsToSave, { onConflict: 'key' });
      toast.success('Cerebro actualizado correctamente.');
      fetchPrompts();
      fetchVersions();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
               <BrainCircuit className="w-8 h-8 text-red-600" /> Cerebro del Samurai
            </h1>
            <p className="text-slate-400">Orquestación de capas de pensamiento y conocimiento dinámico.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 px-8">
             {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
             Sincronizar Cambios
          </Button>
        </div>

        <Tabs value={initialTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-6 flex-wrap h-auto">
             <TabsTrigger value="identidad"><User className="w-4 h-4 mr-2"/> Identidad</TabsTrigger>
             <TabsTrigger value="debug"><Terminal className="w-4 h-4 mr-2"/> Prompt Maestro (Kernel)</TabsTrigger>
             <TabsTrigger value="versiones"><GitBranch className="w-4 h-4 mr-2"/> Versiones</TabsTrigger>
          </TabsList>

          <TabsContent value="identidad" className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PromptCard title="ADN CORE" icon={Bot} value={prompts['prompt_adn_core']} onChange={(v:string) => setPrompts({...prompts, prompt_adn_core: v})} />
                <PromptCard title="ESTRATEGIA" icon={Target} value={prompts['prompt_estrategia_cierre']} onChange={(v:string) => setPrompts({...prompts, prompt_estrategia_cierre: v})} />
             </div>
          </TabsContent>

          <TabsContent value="debug">
             <Card className="bg-slate-950 border-slate-800 shadow-2xl relative">
                <div className="absolute top-4 right-4 z-10">
                   <Button onClick={handleRunSimulation} variant="outline" className="bg-indigo-600/10 border-indigo-500/50 text-indigo-400" disabled={testing}>
                      {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <RefreshCcw className="w-4 h-4 mr-2"/>}
                      Refrescar Kernel
                   </Button>
                </div>
                <CardHeader>
                   <CardTitle className="text-sm text-indigo-400 flex items-center gap-2">
                      <Layers className="w-4 h-4" /> Estructura de Consciencia Generada
                   </CardTitle>
                   <CardDescription>Este es el prompt final que recibe la IA, consolidando Verdad Maestra, #CIA y Media Catalog.</CardDescription>
                </CardHeader>
                <CardContent>
                   <ScrollArea className="h-[600px] rounded-xl border border-slate-800 p-6 bg-black">
                      <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">
                         {testResult?.system_prompt || masterPromptPreview}
                      </pre>
                   </ScrollArea>
                </CardContent>
             </Card>
          </TabsContent>
          
          <TabsContent value="versiones">
             {/* ... UI de versiones ... */}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

const PromptCard = ({ title, icon: Icon, value, onChange }: any) => (
  <Card className="bg-slate-900 border-slate-800 h-full">
    <CardHeader className="pb-3 border-b border-slate-800/50">
       <CardTitle className="text-sm text-white flex items-center gap-2"><Icon className="w-4 h-4 text-red-500"/> {title}</CardTitle>
    </CardHeader>
    <CardContent className="pt-4"><Textarea value={value} onChange={e => onChange(e.target.value)} className="min-h-[400px] bg-slate-950 border-slate-800 font-mono text-xs" /></CardContent>
  </Card>
);

export default AgentBrain;