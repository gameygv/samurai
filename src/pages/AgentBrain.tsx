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
  Save, Bot, Eye, History, Zap, Loader2, FileText, Scan, Terminal, FlaskConical, BrainCircuit, ShieldAlert, Target, GitBranch, User, Calendar, RefreshCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const DEFAULTS = {
  'prompt_adn_core': '# ADN CORE\nEres Samurai, el cerrador de ventas de elite de The Elephant Bowl.\n\nTU MISIÓN:\nConvertir cada consulta en una venta de formación o instrumentos.',
  'prompt_protocolos': '# PROTOCOLOS\nReglas de conducta y comunicación.',
  'prompt_estrategia_cierre': '# ESTRATEGIA DE CIERRE\nReglas para manejar objeciones y cerrar ventas.',
  'prompt_vision_instrucciones': '# OJO DE HALCÓN\nAnaliza posters y pagos.',
};

const AgentBrain = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'identidad';
  const { user, profile } = useAuth();
  
  const [prompts, setPrompts] = useState<Record<string, string>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [masterPromptPreview, setMasterPromptPreview] = useState("");
  
  // Simulation State
  const [testMessage, setTestMessage] = useState("");
  const [testResult, setTestResult] = useState<{ reply: string; system_prompt: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Version Control State
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
      if (data && data.length > 0) {
        const dbPrompts = { ...DEFAULTS };
        data.forEach((item: any) => { dbPrompts[item.key as keyof typeof DEFAULTS] = item.value; });
        setPrompts(dbPrompts);
      }
      
      const { data: brainData } = await supabase.functions.invoke('get-samurai-brain');
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
     if (!testMessage.trim()) return;
     setTesting(true);
     setTestResult(null);
     try {
        const { data, error } = await supabase.functions.invoke('get-samurai-context', {
           body: { 
             message: testMessage, 
             simulate_reply: true,
             prompts: prompts
           }
        });
        if (error) throw error;
        setTestResult(data);
     } catch (err: any) {
        toast.error("Error en simulación: " + err.message);
     } finally {
        setTesting(false);
     }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Crear snapshot para control de versiones
      const versionName = `Guardado Manual - ${new Date().toLocaleString()}`;
      const { error: versionError } = await supabase
        .from('prompt_versions')
        .insert({
          version_name: versionName,
          prompts_snapshot: prompts,
          created_by: user?.id,
          created_by_name: profile?.full_name || user?.email
        });
      if (versionError) throw versionError;

      // 2. Guardar prompts actuales
      const promptsToSave = Object.entries(prompts).map(([key, value]) => ({
        key,
        value,
        category: 'PROMPT',
      }));

      const { error } = await supabase
        .from('app_config')
        .upsert(promptsToSave, { onConflict: 'key' });

      if (error) throw error;

      toast.success('Cerebro actualizado y versión guardada.');
      fetchPrompts();
      fetchVersions();
    } catch (err: any) {
      console.error("Save Error:", err);
      toast.error(`Error al guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async (versionToRevert: any) => {
    if (!confirm(`¿Seguro que quieres restaurar la versión "${versionToRevert.version_name}"?`)) return;
    setSaving(true);
    try {
      const snapshot = versionToRevert.prompts_snapshot;
      const promptsToSave = Object.entries(snapshot).map(([key, value]) => ({
        key, value, category: 'PROMPT'
      }));
      
      const { error: upsertError } = await supabase.from('app_config').upsert(promptsToSave, { onConflict: 'key' });
      if (upsertError) throw upsertError;

      const versionName = `Restaurado a "${versionToRevert.version_name.substring(0, 30)}..."`;
      await supabase.from('prompt_versions').insert({
        version_name: versionName,
        prompts_snapshot: snapshot,
        created_by: user?.id,
        created_by_name: profile?.full_name || user?.email,
        notes: `Restaurado desde la versión ID: ${versionToRevert.id}`
      });

      toast.success("Versión restaurada correctamente.");
      await fetchPrompts();
      await fetchVersions();
      setSearchParams({ tab: 'identidad' });
    } catch (err: any) {
      toast.error(`Error al restaurar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        
        <Card className="bg-red-900/10 border-red-500/30 border-l-4 border-l-red-600">
           <div className="p-4 flex items-center gap-4">
              <ShieldAlert className="w-8 h-8 text-red-500 shrink-0" />
              <div>
                 <h3 className="text-white font-bold text-sm">Identidad Samurai Blindada v2.0</h3>
                 <p className="text-xs text-slate-400">El sistema ahora inyecta automáticamente la Verdad Maestra y Reglas #CIA para evitar alucinaciones.</p>
              </div>
           </div>
        </Card>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Cerebro del Samurai</h1>
            <p className="text-slate-400">Control maestro de la lógica y visión de la IA.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 px-8">
             {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
             Guardar Todo
          </Button>
        </div>

        <Tabs value={initialTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-6 flex-wrap h-auto">
             <TabsTrigger value="identidad">1. Identidad Core</TabsTrigger>
             <TabsTrigger value="versiones">2. Control de Versiones</TabsTrigger>
             <TabsTrigger value="simulador">3. Simulador de Jerarquía</TabsTrigger>
             <TabsTrigger value="ojo-de-halcon">4. Ojo de Halcón</TabsTrigger>
             <TabsTrigger value="debug">5. Ver Prompt Maestro</TabsTrigger>
          </TabsList>

          <TabsContent value="identidad" className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <PromptCard title="ADN CORE" icon={Bot} value={prompts['prompt_adn_core']} onChange={(v:string) => setPrompts({...prompts, prompt_adn_core: v})} />
                <PromptCard title="ESTRATEGIA DE VENTAS" icon={Target} value={prompts['prompt_estrategia_cierre']} onChange={(v:string) => setPrompts({...prompts, prompt_estrategia_cierre: v})} />
                <PromptCard title="PROTOCOLOS" icon={FileText} value={prompts['prompt_protocolos']} onChange={(v:string) => setPrompts({...prompts, prompt_protocolos: v})} />
             </div>
          </TabsContent>

          <TabsContent value="versiones">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-sm text-white flex items-center gap-2"><GitBranch className="w-4 h-4 text-indigo-400" /> Historial de Cambios</CardTitle>
                <CardDescription>Cada vez que guardas, se crea un respaldo aquí.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Versión</TableHead><TableHead>Autor</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {versions.map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="text-xs text-slate-400">{new Date(v.created_at).toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-xs">{v.version_name}</TableCell>
                        <TableCell className="text-xs">{v.created_by_name || 'Sistema'}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => setViewingVersion(v)}><Eye className="w-4 h-4 mr-2" /> Ver</Button>
                          <Button variant="outline" size="sm" className="text-indigo-400 border-indigo-500/50" onClick={() => handleRevert(v)} disabled={saving}><RefreshCcw className="w-4 h-4 mr-2" /> Restaurar</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="simulador">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-slate-900 border-slate-800">
                   <CardHeader>
                      <CardTitle className="text-sm text-white flex items-center gap-2">
                         <FlaskConical className="w-4 h-4 text-indigo-400" /> Prueba de Pensamiento
                      </CardTitle>
                      <CardDescription>Envía una pregunta para ver cómo el Samurai usa los 4 niveles.</CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <Textarea 
                        placeholder="Ej: ¿Qué talleres tienen en Marzo?" 
                        value={testMessage}
                        onChange={e => setTestMessage(e.target.value)}
                        className="bg-slate-950 border-slate-800 h-32"
                      />
                      <Button onClick={handleRunSimulation} disabled={testing || !testMessage} className="w-full bg-indigo-600">
                         {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                         Ejecutar Simulación
                      </Button>
                   </CardContent>
                </Card>

                <Card className="bg-slate-950 border-slate-800">
                   <CardHeader>
                      <CardTitle className="text-sm text-emerald-400 flex items-center gap-2">
                         <BrainCircuit className="w-4 h-4" /> Respuesta del Sistema
                      </CardTitle>
                   </CardHeader>
                   <CardContent>
                      {testing ? (
                        <div className="h-48 flex flex-col items-center justify-center text-slate-500">
                          <Loader2 className="w-8 h-8 mb-2 animate-spin" />
                          <p className="text-xs italic">Samurai está pensando...</p>
                        </div>
                      ) : testResult ? (
                         <div className="space-y-4">
                            <div className="p-4 bg-slate-900 rounded border border-slate-800">
                               <p className="text-xs text-slate-300 italic leading-relaxed">{testResult.reply}</p>
                            </div>
                            <Accordion type="single" collapsible className="w-full">
                              <AccordionItem value="item-1" className="border-slate-800">
                                <AccordionTrigger className="text-xs text-slate-400 hover:no-underline">Ver Prompt de Simulación</AccordionTrigger>
                                <AccordionContent>
                                  <ScrollArea className="h-[200px] rounded bg-black p-2">
                                    <pre className="text-[9px] text-slate-500 font-mono whitespace-pre-wrap">
                                      {testResult.system_prompt}
                                    </pre>
                                  </ScrollArea>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                         </div>
                      ) : (
                         <div className="h-48 flex flex-col items-center justify-center text-slate-700">
                            <p className="text-xs italic">Ingresa una pregunta a la izquierda.</p>
                         </div>
                      )}
                   </CardContent>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="debug">
             <Card className="bg-slate-950 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-sm text-indigo-400 flex items-center gap-2">
                      <Terminal className="w-4 h-4" /> Prompt Maestro Generado
                   </CardTitle>
                </CardHeader>
                <CardContent>
                   <ScrollArea className="h-[500px] rounded border border-slate-800 p-4 bg-black">
                      <pre className="text-[10px] text-slate-500 font-mono whitespace-pre-wrap leading-relaxed">
                         {masterPromptPreview}
                      </pre>
                   </ScrollArea>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="ojo-de-halcon">
             <PromptCard title="INSTRUCCIONES DE VISIÓN" icon={Scan} value={prompts['prompt_vision_instrucciones']} onChange={(v:string) => setPrompts({...prompts, prompt_vision_instrucciones: v})} />
          </TabsContent>
        </Tabs>

        <Dialog open={!!viewingVersion} onOpenChange={() => setViewingVersion(null)}>
          <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-3xl">
            <DialogHeader>
              <DialogTitle>Viendo Versión: {viewingVersion?.version_name}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[60vh] mt-4 bg-black rounded p-4 border border-slate-800">
              <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                {JSON.stringify(viewingVersion?.prompts_snapshot, null, 2)}
              </pre>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

const PromptCard = ({ title, icon: Icon, value, onChange }: any) => (
  <Card className="bg-slate-900 border-slate-800 h-full hover:border-slate-700 transition-all">
    <CardHeader className="pb-3 border-b border-slate-800/50">
       <CardTitle className="text-sm text-white flex items-center gap-2"><Icon className="w-4 h-4 text-red-500"/> {title}</CardTitle>
    </CardHeader>
    <CardContent className="pt-4"><Textarea value={value} onChange={e => onChange(e.target.value)} className="min-h-[450px] bg-slate-950 border-slate-800 font-mono text-xs" /></CardContent>
  </Card>
);

export default AgentBrain;