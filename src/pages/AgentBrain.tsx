"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, Eye as EyeIcon, Zap, Loader2, Terminal, BrainCircuit, Target, 
  GitBranch, RefreshCcw, Layers, History, RotateCcw, Send, Sparkles, Fingerprint, MessageSquare, AlertTriangle, Database, ImageIcon, Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PromptEditor } from '@/components/brain/PromptEditor';
import { KernelStep } from '@/components/brain/KernelStep';
import { toast } from 'sonner';

const AgentBrain = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'alma';
  
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [masterPrompt, setMasterPrompt] = useState("");
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);

  // Simulation State
  const [simQuestion, setSimQuestion] = useState("");
  const [simHistory, setSimHistory] = useState<any[]>([]);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => { fetchPrompts(); fetchVersions(); }, []);
  useEffect(() => { if (activeTab === 'debug') handleRefreshMaster(); }, [activeTab]);

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
        key,
        value,
        category: 'PROMPT',
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase.from('app_config').upsert(updates, { onConflict: 'key' });
      if (error) throw error;
      
      toast.success("Configuración del Cerebro actualizada.");
      fetchVersions();
    } catch (err: any) {
      toast.error("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSnapshot = async () => {
     const name = prompt("Nombre para este Snapshot:", `v${versions.length + 1}.0 - ${new Date().toLocaleDateString()}`);
     if (!name) return;
     
     setSaving(true);
     try {
        const { error } = await supabase.from('prompt_versions').insert({
           version_name: name,
           prompts_snapshot: prompts
        });
        if (error) throw error;
        toast.success("Snapshot creado correctamente.");
        fetchVersions();
     } finally { setSaving(false); }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simQuestion.trim() || simulating) return;

    const userMsg = { role: 'user', text: simQuestion };
    setSimHistory(prev => [...prev, userMsg]);
    setSimQuestion("");
    setSimulating(true);

    try {
      const { data, error } = await supabase.functions.invoke('simulate-samurai', {
        body: { question: simQuestion }
      });

      if (error) throw error;
      setSimHistory(prev => [...prev, { role: 'bot', text: data.answer, explanation: data.explanation }]);
    } catch (err: any) {
      toast.error("Error en simulación: " + err.message);
    } finally {
      setSimulating(false);
    }
  };

  const handleRefreshMaster = async () => {
    setLoadingMaster(true);
    try {
      const { data } = await supabase.functions.invoke('get-samurai-context');
      if (data) setMasterPrompt(data.system_prompt || "");
    } finally { setLoadingMaster(false); }
  };

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-indigo-600 w-10 h-10" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto flex flex-col h-[calc(100vh-140px)] gap-6 overflow-hidden">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
               <BrainCircuit className="w-8 h-8 text-indigo-500" /> Cerebro Core
               <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px]">EDITABLE</Badge>
            </h1>
            <p className="text-slate-400 text-sm">Control central de la consciencia y lógica del Samurai.</p>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" onClick={handleCreateSnapshot} className="border-slate-800 text-slate-400 hover:bg-slate-800">
                <GitBranch className="w-4 h-4 mr-2"/> SNAPSHOT
             </Button>
             <Button onClick={handleSaveAll} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} GUARDAR CAMBIOS
             </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })} className="flex-1 flex flex-col min-h-0">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-4 shrink-0 h-auto flex-wrap justify-start">
             <TabsTrigger value="alma" className="gap-2"><Bot className="w-4 h-4"/> 1. Alma</TabsTrigger>
             <TabsTrigger value="identidad" className="gap-2"><Fingerprint className="w-4 h-4"/> 2. ADN & Venta</TabsTrigger>
             <TabsTrigger value="versiones" className="gap-2"><GitBranch className="w-4 h-4"/> 3. Snapshots</TabsTrigger>
             <TabsTrigger value="vision" className="gap-2"><EyeIcon className="w-4 h-4"/> 4. Ojo Halcón</TabsTrigger>
             <TabsTrigger value="simulador" className="gap-2"><MessageSquare className="w-4 h-4"/> 5. Simulador</TabsTrigger>
             <TabsTrigger value="tuner" className="gap-2"><Sparkles className="w-4 h-4"/> 6. Laboratorio IA</TabsTrigger>
             <TabsTrigger value="debug" className="gap-2"><Terminal className="w-4 h-4"/> 7. Kernel Debug</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 relative bg-slate-900/20 rounded-xl border border-slate-800/50 p-1">
            
            <TabsContent value="alma" className="absolute inset-0 m-0 h-full">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                  <PromptEditor title="Alma de Samurai" icon={Bot} value={prompts['prompt_alma_samurai']} onChange={v => handlePromptChange('prompt_alma_samurai', v)} />
                  <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-emerald-500 flex flex-col h-full overflow-hidden text-white">
                    <CardHeader className="shrink-0 py-3 border-b border-slate-800 bg-slate-950/20"><CardTitle className="text-white text-[10px] uppercase tracking-widest flex items-center gap-2"><Layers className="w-3 h-3 text-emerald-400" /> Jerarquía Técnica</CardTitle></CardHeader>
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-3">
                          <KernelStep num={1} title="Alma & ADN Core" desc="Define quién eres y cómo hablas." color="text-indigo-400" icon={Bot}/>
                          <KernelStep num={2} title="Estrategia de Cierre" desc="Protocolo táctico de ventas." color="text-blue-400" icon={Target}/>
                          <KernelStep num={3} title="Media Manager" desc="Envío inteligente de posters." color="text-yellow-500" icon={ImageIcon}/>
                          <KernelStep num={4} title="Verdad Maestra" desc="Datos oficiales del negocio." color="text-emerald-400" icon={Database}/>
                          <KernelStep num={6} title="Bitácora #CIA" desc="Correcciones críticas prioritarias." color="text-red-500" icon={AlertTriangle}/>
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
            </TabsContent>

            <TabsContent value="identidad" className="absolute inset-0 m-0 h-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                  <PromptEditor title="ADN Core (Personalidad)" icon={Fingerprint} value={prompts['prompt_adn_core']} onChange={v => handlePromptChange('prompt_adn_core', v)} />
                  <PromptEditor title="Estrategia de Cierre" icon={Target} value={prompts['prompt_estrategia_cierre']} onChange={v => handlePromptChange('prompt_estrategia_cierre', v)} color="text-blue-400" />
                </div>
            </TabsContent>

            <TabsContent value="versiones" className="absolute inset-0 m-0 h-full">
               <Card className="bg-slate-900 border-slate-800 h-full flex flex-col overflow-hidden">
                  <CardHeader className="shrink-0 border-b border-slate-800 pb-3"><CardTitle className="text-white text-xs flex items-center gap-2 uppercase tracking-widest"><History className="w-5 h-5 text-indigo-400" /> Snapshots Guardados</CardTitle></CardHeader>
                  <ScrollArea className="flex-1">
                     <Table>
                        <TableHeader><TableRow className="border-slate-800 bg-slate-950/20"><TableHead className="pl-6 text-[10px]">Nombre de Versión</TableHead><TableHead className="text-[10px]">Fecha de Captura</TableHead><TableHead className="text-right pr-6 text-[10px]">Acciones</TableHead></TableRow></TableHeader>
                        <TableBody>
                           {versions.map(v => (
                              <TableRow key={v.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                                 <TableCell className="font-mono text-indigo-400 text-xs pl-6">{v.version_name}</TableCell>
                                 <TableCell className="text-slate-500 text-[10px]">{new Date(v.created_at).toLocaleString()}</TableCell>
                                 <TableCell className="text-right pr-6"><Button variant="ghost" size="sm" className="h-7 text-[9px] text-slate-400 hover:text-white">RESTAURAR</Button></TableCell>
                              </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                  </ScrollArea>
               </Card>
            </TabsContent>

            <TabsContent value="vision" className="absolute inset-0 m-0 h-full">
                <PromptEditor title="Ojo de Halcón (Instrucciones OCR)" icon={EyeIcon} value={prompts['prompt_vision_instrucciones']} onChange={v => handlePromptChange('prompt_vision_instrucciones', v)} color="text-red-400" />
            </TabsContent>

            <TabsContent value="simulador" className="absolute inset-0 m-0 flex flex-col h-full overflow-hidden">
                <Card className="bg-slate-950 border-slate-800 flex-1 flex flex-col overflow-hidden shadow-2xl">
                    <CardHeader className="border-b border-slate-800 bg-slate-900/50 py-3 flex items-center justify-between shrink-0 px-6">
                        <CardTitle className="text-white text-xs flex items-center gap-2 uppercase tracking-widest"><MessageSquare className="w-4 h-4 text-blue-400" /> Simulador de Respuesta</CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => setSimHistory([])} className="h-7 text-[10px] text-slate-500"><RotateCcw className="w-3 h-3 mr-1"/> Limpiar</Button>
                    </CardHeader>
                    <ScrollArea className="flex-1 p-6">
                       <div className="max-w-3xl mx-auto space-y-6">
                          {simHistory.length === 0 && <div className="text-center py-20 text-slate-700 italic text-sm">Prueba cómo respondería Sam con los prompts actuales...</div>}
                          {simHistory.map((m, i) => (
                             <div key={i} className={cn("flex flex-col gap-2", m.role === 'user' ? 'items-end' : 'items-start')}>
                                <div className={cn("p-4 rounded-2xl text-sm max-w-[85%] border", m.role === 'user' ? 'bg-indigo-600/10 border-indigo-500/20 text-indigo-100' : 'bg-slate-900 border-slate-800 text-slate-200')}>
                                   {m.text}
                                </div>
                                {m.explanation && (
                                   <div className="bg-black/40 border border-slate-800 p-3 rounded-lg w-full mt-2">
                                      <p className="text-[10px] text-emerald-500 font-bold uppercase mb-2 flex items-center gap-2"><Zap className="w-3 h-3"/> Razonamiento Técnico:</p>
                                      <div className="grid grid-cols-2 gap-4">
                                         <div><p className="text-[9px] text-slate-600 uppercase font-bold">Capas Usadas</p><div className="flex gap-1 mt-1">{m.explanation.layers_used.map((l:any, idx:number)=>(<Badge key={idx} variant="outline" className="text-[8px] border-slate-700 text-slate-400">{l}</Badge>))}</div></div>
                                         <div><p className="text-[9px] text-slate-600 uppercase font-bold">Lógica Aplicada</p><p className="text-[10px] text-slate-400 leading-relaxed italic">"{m.explanation.reasoning}"</p></div>
                                      </div>
                                   </div>
                                )}
                             </div>
                          ))}
                       </div>
                    </ScrollArea>
                    <form onSubmit={handleSimulate} className="p-4 bg-slate-900 border-t border-slate-800 shrink-0 flex gap-3">
                       <Input value={simQuestion} onChange={e => setSimQuestion(e.target.value)} placeholder="Escribe como si fueras un cliente..." className="bg-slate-950 border-slate-800 text-white" disabled={simulating} />
                       <Button type="submit" disabled={simulating || !simQuestion.trim()} className="bg-indigo-600 hover:bg-indigo-700 shrink-0 shadow-lg shadow-indigo-900/40">
                          {simulating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                       </Button>
                    </form>
                </Card>
            </TabsContent>

            <TabsContent value="debug" className="absolute inset-0 m-0 flex flex-col h-full overflow-hidden">
                <Card className="bg-slate-900 border-slate-800 shadow-2xl relative flex-1 flex flex-col overflow-hidden">
                    <div className="absolute top-4 right-6 z-10">
                       <Button onClick={handleRefreshMaster} variant="outline" className="h-9 text-[10px] border-indigo-500/50 text-indigo-400 bg-slate-950 hover:bg-indigo-500/20 font-bold" disabled={loadingMaster}>
                          {loadingMaster ? <Loader2 className="w-3 h-3 animate-spin mr-2"/> : <RefreshCcw className="w-3 h-3 mr-2"/>} RE-COMPILAR
                       </Button>
                    </div>
                    <CardHeader className="shrink-0 py-4 bg-slate-950/20 border-b border-slate-800"><CardTitle className="text-[10px] text-slate-500 flex items-center gap-2 uppercase tracking-widest"><Terminal className="w-4 h-4" /> Inspección del Kernel</CardTitle></CardHeader>
                    <div className="flex-1 bg-black p-8 overflow-y-auto custom-scrollbar">
                       <pre className="text-[11px] text-slate-500 font-mono whitespace-pre-wrap leading-relaxed select-text">
                          {loadingMaster ? "Cargando constitución..." : masterPrompt || "Kernel listo para inspección."}
                       </pre>
                    </div>
                </Card>
            </TabsContent>

          </div>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AgentBrain;