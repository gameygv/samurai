"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, Eye as EyeIcon, Zap, Loader2, Terminal, BrainCircuit, Target, 
  GitBranch, RefreshCcw, Layers, History, Send, Fingerprint, MessageSquare, AlertTriangle, Database, ImageIcon, Save, Trash2, FlaskConical, Sparkles, Upload, CheckCircle2
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

  // Lab State
  const [labMessages, setLabMessages] = useState<any[]>([]);
  const [labInput, setLabInput] = useState("");
  const [labImage, setLabImage] = useState<string | null>(null);
  const [labProcessing, setLabProcessing] = useState(false);
  const [proposedPrompts, setProposedPrompts] = useState<any>(null);

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
      
      toast.success("Cerebro actualizado correctamente");
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
        const { error } = await supabase.from('prompt_versions').insert({
           version_name: name,
           prompts_snapshot: prompts
        });
        if (error) throw error;
        toast.success("Snapshot creado.");
        fetchVersions();
     } finally { setSaving(false); }
  };

  const handleDeleteSnapshot = async (id: string) => {
    if (!confirm("¿Seguro que quieres borrar este snapshot?")) return;
    try {
      const { error } = await supabase.functions.invoke('manage-prompt-versions', {
        body: { action: 'DELETE', id }
      });
      if (error) throw error;
      toast.success("Snapshot eliminado");
      fetchVersions();
    } catch (err: any) {
      toast.error("Error al eliminar");
    }
  };

  const handleRestoreSnapshot = (snapshot: any) => {
    if (!confirm(`¿Restaurar "${snapshot.version_name}"? Esto reemplazará los prompts actuales (debes presionar "Aplicar Cambios" después).`)) return;
    setPrompts(snapshot.prompts_snapshot);
    toast.success("Snapshot cargado. Revisa las pestañas 1 y 2.");
    setSearchParams({ tab: 'alma' }); 
  };

  // LAB LOGIC
  const handleLabImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLabImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleLabSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!labInput.trim() && !labImage) || labProcessing) return;

    const userMsg = { role: 'user', text: labInput, image: labImage };
    setLabMessages(prev => [...prev, userMsg]);
    const currentInput = labInput;
    const currentImage = labImage;
    setLabInput("");
    setLabImage(null);
    setLabProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('tune-samurai-prompts', {
        body: { messages: [...labMessages, { role: 'user', text: currentInput, image: currentImage }], currentPrompts: prompts }
      });
      
      if (error) throw error;
      
      setLabMessages(prev => [...prev, { role: 'assistant', text: data.result.message }]);
      setProposedPrompts(data.result.prompts);
      toast.info("El Arquitecto ha propuesto mejoras.");
    } catch (err: any) {
      toast.error("Error en Laboratorio: " + err.message);
    } finally {
      setLabProcessing(false);
    }
  };

  const applyProposedPrompts = () => {
     if (!proposedPrompts) return;
     setPrompts(proposedPrompts);
     setProposedPrompts(null);
     toast.success("Propuesta aplicada. Pulsa 'Aplicar Cambios' para finalizar.");
     setSearchParams({ tab: 'alma' });
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simQuestion.trim() || simulating) return;

    const currentQ = simQuestion;
    const newHistory = [...simHistory, { role: 'user', text: currentQ }];
    setSimHistory(newHistory);
    setSimQuestion("");
    setSimulating(true);

    try {
      const { data, error } = await supabase.functions.invoke('simulate-samurai', {
        body: { 
            question: currentQ, 
            history: newHistory.slice(-10), 
            customPrompts: prompts 
        }
      });
      
      if (error || data?.error) throw new Error(data?.error || "Error en el Kernel");
      
      setSimHistory(prev => [...prev, { role: 'bot', text: data.answer, explanation: data.explanation }]);
    } catch (err: any) {
      toast.error(err.message);
      setSimHistory(prev => [...prev, { role: 'bot', text: "⚠ Fallo de conexión o API Key inválida." }]);
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
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-slate-900/50 p-5 rounded-xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600/10 rounded-xl border border-indigo-500/20">
               <BrainCircuit className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Cerebro Core</h1>
              <p className="text-slate-400 text-sm">Control central de la consciencia y lógica de Elephant Bowl.</p>
            </div>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" onClick={handleCreateSnapshot} className="border-slate-700 text-slate-300 hover:bg-slate-800 h-11 px-6 font-bold">
                <GitBranch className="w-4 h-4 mr-2 text-indigo-400"/> SNAPSHOT
             </Button>
             <Button onClick={handleSaveAll} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 h-11 px-8 font-bold shadow-lg shadow-indigo-900/30 transition-all active:scale-95">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} APLICAR CAMBIOS
             </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })} className="flex-1 flex flex-col min-h-0">
          <TabsList className="bg-slate-900/80 border border-slate-800 p-1 mb-4 shrink-0 h-auto flex-wrap justify-start gap-1">
             <TabsTrigger value="alma" className="gap-2 px-4 py-2"><Bot className="w-4 h-4"/> 1. Alma</TabsTrigger>
             <TabsTrigger value="identidad" className="gap-2 px-4 py-2"><Fingerprint className="w-4 h-4"/> 2. ADN & Venta</TabsTrigger>
             <TabsTrigger value="versiones" className="gap-2 px-4 py-2"><GitBranch className="w-4 h-4"/> 3. Snapshots</TabsTrigger>
             <TabsTrigger value="vision" className="gap-2 px-4 py-2"><EyeIcon className="w-4 h-4"/> 4. Ojo Halcón</TabsTrigger>
             <TabsTrigger value="simulador" className="gap-2 px-4 py-2"><MessageSquare className="w-4 h-4"/> 5. Simulador</TabsTrigger>
             <TabsTrigger value="debug" className="gap-2 px-4 py-2"><Terminal className="w-4 h-4"/> 6. Kernel Debug</TabsTrigger>
             <TabsTrigger value="lab" className="gap-2 px-4 py-2 bg-indigo-600/10 text-indigo-400 data-[state=active]:bg-indigo-600 data-[state=active]:text-white"><FlaskConical className="w-4 h-4"/> 7. Laboratorio IA</TabsTrigger>
          </TabsList>

          <div className="flex-1 flex flex-col min-h-0 bg-slate-900/20 rounded-xl border border-slate-800/50 p-1">
            
            <TabsContent value="lab" className="m-0 h-full flex flex-col data-[state=inactive]:hidden">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                   <div className="lg:col-span-8 flex flex-col gap-4">
                      <Card className="bg-slate-950 border-slate-800 flex-1 flex flex-col overflow-hidden shadow-2xl rounded-xl">
                         <CardHeader className="border-b border-slate-800 bg-slate-900/50 py-3 flex items-center justify-between shrink-0 px-6">
                            <div>
                               <CardTitle className="text-white text-xs flex items-center gap-2 uppercase tracking-widest"><FlaskConical className="w-4 h-4 text-indigo-400" /> Arquitecto de Prompts</CardTitle>
                               <CardDescription className="text-[10px]">Evolución asistida de la consciencia de la IA.</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setLabMessages([])} className="h-8 text-[10px] text-slate-500 hover:text-white"><RefreshCcw className="w-3 h-3 mr-2"/> Reiniciar</Button>
                         </CardHeader>
                         <ScrollArea className="flex-1 p-6">
                            <div className="space-y-6">
                               {labMessages.length === 0 && (
                                  <div className="text-center py-20">
                                     <Bot className="w-12 h-12 text-slate-800 mx-auto mb-4 opacity-20" />
                                     <p className="text-slate-500 italic text-sm">"Hola, soy el Arquitecto. ¿Qué quieres que aprenda la IA hoy?"</p>
                                  </div>
                               )}
                               {labMessages.map((m, i) => (
                                  <div key={i} className={cn("flex flex-col gap-2", m.role === 'user' ? 'items-end' : 'items-start')}>
                                     <div className={cn("p-4 rounded-2xl text-sm max-w-[85%] border shadow-lg", m.role === 'user' ? 'bg-indigo-600/10 border-indigo-500/20 text-indigo-100' : 'bg-slate-900 border-slate-800 text-slate-200')}>
                                        {m.image && <img src={m.image} className="w-full max-w-[300px] rounded-lg mb-3 border border-white/10" />}
                                        {m.text}
                                     </div>
                                  </div>
                               ))}
                               {labProcessing && <div className="flex gap-2 items-center text-indigo-400 text-xs animate-pulse"><Loader2 className="w-4 h-4 animate-spin"/> El Arquitecto está redactando los nuevos prompts...</div>}
                            </div>
                         </ScrollArea>
                         
                         <form onSubmit={handleLabSubmit} className="p-4 bg-slate-900 border-t border-slate-800 shrink-0 space-y-4">
                            {labImage && (
                               <div className="flex items-center gap-4 bg-slate-950 p-2 rounded-lg border border-indigo-500/30">
                                  <img src={labImage} className="w-12 h-12 rounded object-cover" />
                                  <span className="text-[10px] text-indigo-400 flex-1">Captura lista para analizar</span>
                                  <Button size="sm" variant="ghost" onClick={() => setLabImage(null)} className="text-red-400">Eliminar</Button>
                               </div>
                            )}
                            <div className="flex gap-4">
                               <div className="relative shrink-0">
                                  <input type="file" id="lab-upload" className="hidden" accept="image/*" onChange={handleLabImageUpload} />
                                  <label htmlFor="lab-upload" className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 cursor-pointer hover:bg-slate-700 transition-colors">
                                     <ImageIcon className="w-5 h-5 text-slate-400" />
                                  </label>
                               </div>
                               <Input 
                                 value={labInput} 
                                 onChange={e => setLabInput(e.target.value)} 
                                 placeholder="Dime qué corregir o sube una captura..." 
                                 className="bg-slate-950 border-slate-800 text-white h-12" 
                                 disabled={labProcessing} 
                               />
                               <Button type="submit" disabled={labProcessing || (!labInput.trim() && !labImage)} className="bg-indigo-600 h-12 px-6">
                                  <Send className="w-5 h-5" />
                               </Button>
                            </div>
                         </form>
                      </Card>
                   </div>

                   <div className="lg:col-span-4 flex flex-col gap-6">
                      <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-yellow-600 shadow-xl">
                         <CardHeader><CardTitle className="text-xs uppercase tracking-widest text-yellow-500 flex items-center gap-2"><Sparkles className="w-4 h-4"/> Propuesta de Mejora</CardTitle></CardHeader>
                         <CardContent className="space-y-4">
                            {!proposedPrompts ? (
                               <div className="py-10 text-center text-slate-600 text-[10px] italic">No hay cambios propuestos aún.</div>
                            ) : (
                               <div className="space-y-4">
                                  <div className="p-3 bg-slate-950 rounded border border-slate-800">
                                     <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Impacto:</p>
                                     <ul className="text-[10px] text-slate-300 space-y-2">
                                        <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-indigo-500"/> Se ajustó la personalidad.</li>
                                        <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-indigo-500"/> Se optimizó la estrategia de venta.</li>
                                     </ul>
                                  </div>
                                  <Button onClick={applyProposedPrompts} className="w-full bg-yellow-600 hover:bg-yellow-700 h-12 font-bold shadow-lg shadow-yellow-900/20">
                                     <CheckCircle2 className="w-4 h-4 mr-2" /> APLICAR PROPUESTA
                                  </Button>
                               </div>
                            )}
                         </CardContent>
                      </Card>
                   </div>
                </div>
            </TabsContent>

            <TabsContent value="alma" className="m-0 h-full flex flex-col data-[state=inactive]:hidden">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
                  <div className="h-full min-h-0">
                     <PromptEditor title="Alma de Elephant Bowl" icon={Bot} value={prompts['prompt_alma_samurai']} onChange={v => handlePromptChange('prompt_alma_samurai', v)} />
                  </div>
                  <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-emerald-500 flex flex-col h-full overflow-hidden shadow-2xl">
                    <CardHeader className="shrink-0 py-4 border-b border-slate-800 bg-slate-950/20"><CardTitle className="text-white text-xs uppercase tracking-widest flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-400" /> Jerarquía Técnica</CardTitle></CardHeader>
                    <ScrollArea className="flex-1 p-6">
                      <div className="space-y-4">
                          <KernelStep num={1} title="Alma & ADN Core" desc="Define quién eres y cómo hablas." color="text-indigo-400" icon={Bot}/>
                          <KernelStep num={2} title="Estrategia de Cierre" desc="Protocolo táctico de ventas." color="text-blue-400" icon={Target}/>
                          <KernelStep num={3} title="Media Manager" desc="Envío inteligente de posters." color="text-yellow-600" icon={ImageIcon}/>
                          <KernelStep num={4} title="Verdad Maestra" desc="Datos oficiales del negocio." color="text-emerald-400" icon={Database}/>
                          <KernelStep num={5} title="Bitácora #CIA" desc="Correcciones críticas prioritarias." color="text-red-400" icon={AlertTriangle}/>
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
            </TabsContent>

            <TabsContent value="identidad" className="m-0 h-full data-[state=inactive]:hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full min-h-0">
                   <div className="h-full min-h-0">
                      <PromptEditor title="ADN Core (Personalidad)" icon={Fingerprint} value={prompts['prompt_adn_core']} onChange={v => handlePromptChange('prompt_adn_core', v)} />
                   </div>
                   <div className="h-full min-h-0">
                      <PromptEditor title="Estrategia de Cierre" icon={Target} value={prompts['prompt_estrategia_cierre']} onChange={v => handlePromptChange('prompt_estrategia_cierre', v)} color="text-blue-400" />
                   </div>
                </div>
            </TabsContent>

            <TabsContent value="versiones" className="m-0 h-full data-[state=inactive]:hidden flex flex-col">
               <Card className="bg-slate-900 border-slate-800 flex-1 flex flex-col overflow-hidden shadow-2xl">
                  <CardHeader className="shrink-0 border-b border-slate-800 p-6 bg-slate-950/20"><CardTitle className="text-white text-sm flex items-center gap-2 uppercase tracking-widest font-bold"><History className="w-5 h-5 text-indigo-400" /> Snapshots Guardados</CardTitle></CardHeader>
                  <ScrollArea className="flex-1">
                     <Table>
                        <TableHeader><TableRow className="border-slate-800 bg-slate-950/40"><TableHead className="pl-6 text-[10px] uppercase font-bold text-slate-500">Nombre</TableHead><TableHead className="text-[10px] uppercase font-bold text-slate-500">Capturado el</TableHead><TableHead className="text-right pr-6 text-[10px] uppercase font-bold text-slate-500">Acción</TableHead></TableRow></TableHeader>
                        <TableBody>
                           {versions.length === 0 ? (
                              <TableRow><TableCell colSpan={3} className="text-center py-20 text-slate-600 italic">No hay snapshots creados.</TableCell></TableRow>
                           ) : versions.map(v => (
                              <TableRow key={v.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors group">
                                 <TableCell className="font-mono text-indigo-400 text-xs pl-6">{v.version_name}</TableCell>
                                 <TableCell className="text-slate-400 text-[10px]">{new Date(v.created_at).toLocaleString()}</TableCell>
                                 <TableCell className="text-right pr-6">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                       <Button variant="ghost" size="sm" className="h-8 text-[10px] text-red-400 hover:bg-red-500/10" onClick={() => handleDeleteSnapshot(v.id)}>
                                          <Trash2 className="w-3.5 h-3.5 mr-1" /> BORRAR
                                       </Button>
                                       <Button variant="secondary" size="sm" className="h-8 text-[10px] font-bold" onClick={() => handleRestoreSnapshot(v)}>
                                          RESTAURAR
                                       </Button>
                                    </div>
                                 </TableCell>
                              </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                  </ScrollArea>
               </Card>
            </TabsContent>

            <TabsContent value="vision" className="m-0 h-full data-[state=inactive]:hidden">
                <PromptEditor title="Ojo de Halcón (Instrucciones OCR)" icon={EyeIcon} value={prompts['prompt_vision_instrucciones']} onChange={v => handlePromptChange('prompt_vision_instrucciones', v)} color="text-red-400" />
            </TabsContent>

            <TabsContent value="simulador" className="m-0 h-full flex flex-col data-[state=inactive]:hidden">
                <Card className="bg-slate-950 border-slate-800 flex-1 flex flex-col overflow-hidden shadow-2xl rounded-xl">
                    <CardHeader className="border-b border-slate-800 bg-slate-900/50 py-3 flex items-center justify-between shrink-0 px-6">
                        <CardTitle className="text-white text-xs flex items-center gap-2 uppercase tracking-widest"><MessageSquare className="w-4 h-4 text-blue-400" /> Entorno de Pruebas</CardTitle>
                        <div className="flex items-center gap-4">
                           <Badge variant="outline" className="text-[8px] border-indigo-500/30 text-indigo-400 bg-indigo-500/5">MODO: TIEMPO REAL</Badge>
                           <Button variant="ghost" size="sm" onClick={() => setSimHistory([])} className="h-8 text-[10px] text-slate-500 hover:text-white"><RefreshCcw className="w-3 h-3 mr-2"/> Limpiar</Button>
                        </div>
                    </CardHeader>
                    <ScrollArea className="flex-1 p-6 bg-slate-950">
                       <div className="max-w-4xl mx-auto space-y-6 pb-4">
                          {simHistory.length === 0 && (
                            <div className="text-center py-20">
                               <MessageSquare className="w-12 h-12 text-slate-800 mx-auto mb-4 opacity-20" />
                               <p className="text-slate-500 italic text-sm">Prueba lo que acabas de escribir arriba antes de guardar.</p>
                            </div>
                          )}
                          {simHistory.map((m, i) => (
                             <div key={i} className={cn("flex flex-col gap-2", m.role === 'user' ? 'items-end' : 'items-start')}>
                                <div className={cn("p-4 rounded-2xl text-sm max-w-[85%] border shadow-lg", m.role === 'user' ? 'bg-indigo-600/10 border-indigo-500/20 text-indigo-100' : 'bg-slate-900 border-slate-800 text-slate-200')}>
                                   {m.text}
                                </div>
                                {m.explanation && (
                                   <div className="bg-black/40 border border-slate-800 p-4 rounded-xl w-full mt-2 shadow-inner">
                                      <p className="text-[10px] text-emerald-500 font-bold uppercase mb-3 flex items-center gap-2"><Zap className="w-3.5 h-3.5"/> Razonamiento Técnico:</p>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                         <div><p className="text-[9px] text-slate-600 uppercase font-bold mb-2">Capas Usadas</p><div className="flex flex-wrap gap-1.5">{m.explanation.layers_used.map((l:any, idx:number)=>(<Badge key={idx} variant="outline" className="text-[8px] border-slate-700 text-slate-400 bg-slate-900">{l}</Badge>))}</div></div>
                                         <div><p className="text-[9px] text-slate-600 uppercase font-bold mb-2">Lógica Aplicada</p><p className="text-[10px] text-slate-400 leading-relaxed italic">"{m.explanation.reasoning}"</p></div>
                                      </div>
                                   </div>
                                )}
                             </div>
                          ))}
                       </div>
                    </ScrollArea>
                    <form onSubmit={handleSimulate} className="p-4 bg-slate-900 border-t border-slate-800 shrink-0 flex gap-4">
                       <Input 
                         value={simQuestion} 
                         onChange={e => setSimQuestion(e.target.value)} 
                         placeholder="Escribe un mensaje de cliente..." 
                         className="bg-slate-950 border-slate-800 text-white h-12" 
                         disabled={simulating} 
                       />
                       <Button type="submit" disabled={simulating || !simQuestion.trim()} className="bg-indigo-600 hover:bg-indigo-700 shrink-0 h-12 px-6">
                          {simulating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                       </Button>
                    </form>
                </Card>
            </TabsContent>

            <TabsContent value="debug" className="m-0 h-full flex flex-col data-[state=inactive]:hidden">
                <Card className="bg-slate-900 border-slate-800 shadow-2xl relative flex-1 flex flex-col overflow-hidden">
                    <div className="absolute top-4 right-6 z-10">
                       <Button onClick={handleRefreshMaster} variant="outline" className="h-9 text-[10px] border-indigo-500/50 text-indigo-400 bg-slate-950 hover:bg-indigo-500/20 font-bold" disabled={loadingMaster}>
                          {loadingMaster ? <Loader2 className="w-3 h-3 animate-spin mr-2"/> : <RefreshCcw className="w-3 h-3 mr-2"/>} RE-COMPILAR
                       </Button>
                    </div>
                    <CardHeader className="shrink-0 py-4 bg-slate-950/20 border-b border-slate-800"><CardTitle className="text-[10px] text-slate-500 flex items-center gap-2 uppercase tracking-widest"><Terminal className="w-4 h-4" /> Inspección del Kernel</CardTitle></CardHeader>
                    <div className="flex-1 bg-black p-8 overflow-y-auto custom-scrollbar">
                       <pre className="text-[11px] text-slate-500 font-mono whitespace-pre-wrap leading-relaxed select-text">
                          {loadingMaster ? "Cargando constitución..." : masterPrompt || "Presiona Re-compilar para ver el prompt final."}
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