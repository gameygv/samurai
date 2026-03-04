import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Save, Bot, Eye as EyeIcon, Zap, Loader2, Terminal, BrainCircuit, Target, 
  GitBranch, User, RefreshCcw, Layers, History, RotateCcw, Trash2, Send, Image as ImageIcon, Sparkles, X, Fingerprint, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const AgentBrain = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'alma';
  const { profile } = useAuth();
  
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [versions, setVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [masterPrompt, setMasterPrompt] = useState("");
  const [loadingMaster, setLoadingMaster] = useState(false);

  // Meta-Tuner State
  const [tunerMessages, setTunerMessages] = useState<any[]>([]);
  const [tunerInput, setTunerInput] = useState('');
  const [tunerImage, setTunerImage] = useState<string | null>(null);
  const [tuning, setTuning] = useState(false);
  const tunerScrollRef = useRef<HTMLDivElement>(null);

  // Simulator State
  const [simMessages, setSimMessages] = useState<{role: string, text: string, explanation?: any}[]>([]);
  const [simInput, setSimInput] = useState('');
  const [simulating, setSimulating] = useState(false);
  const simScrollRef = useRef<HTMLDivElement>(null);

  const defaultAlma = "Eres el asistente digital del equipo de The Elephant Bowl, la inteligencia avanzada y guardián de la sabiduría de Geoffrey Torkington. Tu propósito no es solo responder dudas, sino guiar a los prospectos en un viaje de transformación a través del sonido.\n\nTe presentas amablemente como 'Sam'. La idea es llevar al cliente al link de compra, vendiendo una reservación de $1500 MXN.";
  const defaultEstrategia = "FASE 1 (DATA HUNTING):\nNo sueltes precios sin pedir antes el Nombre y la Ciudad de la persona.\n\nFASE 2 (SEDUCCIÓN):\nUsa la ciudad para enviar el póster más cercano del Media Manager.\n\nFASE 3 (CIERRE):\nEl anticipo es de $1,500 MXN. Ofrece el link de pago o los datos bancarios. REGLA ABSOLUTA: Solo da el link o datos si ya tienes el EMAIL del cliente.\n\nREACTIVACIÓN:\nSi el cliente dejó de responder, pregúntale amablemente si pudo revisar la información y si tiene dudas.";

  useEffect(() => {
    fetchPrompts();
    fetchVersions();
  }, []);

  useEffect(() => {
    if (tunerScrollRef.current) tunerScrollRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [tunerMessages, tuning]);

  useEffect(() => {
    if (simScrollRef.current) simScrollRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [simMessages, simulating]);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('app_config').select('key, value').eq('category', 'PROMPT');
      if (data) {
        const p: any = {};
        data.forEach(item => p[item.key] = item.value);
        if (!p['prompt_alma_samurai']) p['prompt_alma_samurai'] = defaultAlma;
        if (!p['prompt_estrategia_cierre']) p['prompt_estrategia_cierre'] = defaultEstrategia;
        if (!p['prompt_vision_instrucciones']) p['prompt_vision_instrucciones'] = ""; 
        setPrompts(p);
      }
      handleRefreshMaster();
    } finally {
      setLoading(false);
    }
  };

  const fetchVersions = async () => {
    setLoadingVersions(true);
    const { data } = await supabase.from('prompt_versions').select('*').order('created_at', { ascending: false });
    if (data) setVersions(data);
    setLoadingVersions(false);
  };

  const handleRefreshMaster = async () => {
    setLoadingMaster(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-samurai-context');
      if (error) throw error;
      setMasterPrompt(data.system_prompt || "Kernel vacío.");
    } finally {
      setLoadingMaster(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const promptsToSave = Object.entries(prompts).map(([key, value]) => ({
        key, value: value || '', category: 'PROMPT',
      }));
      await supabase.from('app_config').upsert(promptsToSave, { onConflict: 'key' });
      
      await supabase.from('prompt_versions').insert({
        version_name: `v${new Date().toISOString().split('T')[0]}-${Math.floor(Math.random()*1000)}`,
        prompts_snapshot: prompts,
        created_by_name: profile?.username || 'Admin',
        notes: 'Snapshot Manual / Tuner IA'
      });

      toast.success('Jerarquía guardada en Base de Datos y Kernel actualizado.');
      handleRefreshMaster();
      fetchVersions();
    } finally {
      setSaving(false);
    }
  };

  // --- SIMULATOR FUNCTIONS ---
  const handleSimulateSubmit = async () => {
     if (!simInput.trim()) return;
     
     const userText = simInput;
     setSimMessages(prev => [...prev, { role: 'user', text: userText }]);
     setSimInput('');
     setSimulating(true);

     try {
        const { data, error } = await supabase.functions.invoke('simulate-samurai', {
           body: { question: userText }
        });
        if (error) throw error;
        
        setSimMessages(prev => [...prev, { role: 'assistant', text: data.answer, explanation: data.explanation }]);
     } catch (err: any) {
        toast.error(err.message);
        setSimMessages(prev => [...prev, { role: 'assistant', text: `Error: ${err.message}` }]);
     } finally {
        setSimulating(false);
     }
  };

  // --- META TUNER FUNCTIONS ---
  const handlePasteImage = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    setTunerImage(event.target?.result as string);
                };
                reader.readAsDataURL(blob);
            }
        }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (event) => {
            setTunerImage(event.target?.result as string);
        };
        reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleTuneSubmit = async () => {
      if (!tunerInput.trim() && !tunerImage) return;

      const newUserMsg = { role: 'user', text: tunerInput, image: tunerImage };
      const currentHistory = [...tunerMessages, newUserMsg];
      
      setTunerMessages(currentHistory);
      setTunerInput('');
      setTunerImage(null);
      setTuning(true);

      try {
          const { data, error } = await supabase.functions.invoke('tune-samurai-prompts', {
              body: { messages: currentHistory, currentPrompts: prompts }
          });

          if (error) throw new Error(error.message);
          if (data.error) throw new Error(data.error);

          const result = data.result;
          setTunerMessages(prev => [...prev, { role: 'assistant', text: result.message }]);

          setPrompts({
              ...prompts,
              prompt_alma_samurai: result.prompts.prompt_alma_samurai,
              prompt_adn_core: result.prompts.prompt_adn_core,
              prompt_estrategia_cierre: result.prompts.prompt_estrategia_cierre,
              prompt_vision_instrucciones: result.prompts.prompt_vision_instrucciones
          });

          toast.success("¡Prompts regenerados! Revisa las pestañas y presiona 'Guardar Snapshot'.");

      } catch (err: any) {
          toast.error("Error en el Laboratorio IA: " + err.message);
          setTunerMessages(prev => [...prev, { role: 'assistant', text: `Error de conexión: ${err.message}` }]);
      } finally {
          setTuning(false);
      }
  };

  const handleRestoreVersion = async (version: any) => {
    if (!confirm(`¿Restaurar la versión ${version.version_name}?`)) return;
    setPrompts(version.prompts_snapshot);
    toast.info("Versión cargada en los paneles. Dale a 'GUARDAR SNAPSHOT' para aplicarla al bot.");
  };

  const handleDeleteVersion = async (id: string) => {
     if (!confirm("¿Eliminar este Snapshot del historial?")) return;
     setLoadingVersions(true);
     try {
        const { error, data } = await supabase.functions.invoke('manage-prompt-versions', { body: { action: 'DELETE', id } });
        if (error) throw error;
        toast.success("Snapshot eliminado exitosamente.");
        fetchVersions();
     } catch (err: any) { 
        toast.error(`Error al eliminar: ${err.message}`); 
        setLoadingVersions(false);
     }
  };

  const handlePurgeHistory = async () => {
     if (!confirm("⚠️ ADVERTENCIA: Esto borrará TODOS los snapshots de la base de datos. La configuración actual NO se perderá. ¿Continuar?")) return;
     setLoadingVersions(true);
     try {
        const { error, data } = await supabase.functions.invoke('manage-prompt-versions', { body: { action: 'PURGE' } });
        if (error) throw error;
        toast.success("Historial purgado desde cero.");
        fetchVersions();
     } catch (err: any) { 
        toast.error(`Error al limpiar historial: ${err.message}`); 
        setLoadingVersions(false);
     }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
               <BrainCircuit className="w-8 h-8 text-indigo-500" /> Cerebro Core
            </h1>
            <p className="text-slate-400 text-sm">Control transparente de toda la lógica e identidad de Samurai.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 font-bold px-8 shadow-xl">
             {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
             GUARDAR SNAPSHOT
          </Button>
        </div>

        <Tabs value={initialTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-6 flex-wrap h-auto w-full justify-start">
             <TabsTrigger value="alma" className="gap-2"><Target className="w-4 h-4"/> 1. Alma de Samurai</TabsTrigger>
             <TabsTrigger value="identidad" className="gap-2"><User className="w-4 h-4"/> 2. ADN & Cierre</TabsTrigger>
             <TabsTrigger value="versiones" className="gap-2"><GitBranch className="w-4 h-4"/> 3. Snapshots</TabsTrigger>
             <TabsTrigger value="ojo_halcon" className="gap-2"><EyeIcon className="w-4 h-4"/> 4. Ojo de Halcón</TabsTrigger>
             <TabsTrigger value="simulador" className="gap-2"><MessageSquare className="w-4 h-4"/> 5. Simulador</TabsTrigger>
             <TabsTrigger value="tuner" className="gap-2 bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white transition-all"><Sparkles className="w-4 h-4 text-yellow-400"/> 6. Laboratorio IA</TabsTrigger>
             <TabsTrigger value="debug" className="gap-2"><Terminal className="w-4 h-4"/> 7. Kernel Debug</TabsTrigger>
          </TabsList>

          <TabsContent value="alma" className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in-50">
             <PromptCard title="ALMA DE SAMURAI (PROPÓSITO BASE)" icon={Bot} value={prompts['prompt_alma_samurai']} onChange={(v:string) => setPrompts({...prompts, prompt_alma_samurai: v})} placeholder="Instrucciones iniciales, propósito y presentación base..." />
             <Card className="bg-slate-900 border-slate-800 shadow-xl h-full border-l-4 border-l-emerald-500">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><Layers className="w-5 h-5 text-emerald-400" /> Cómo lee Samurai tus Prompts</CardTitle></CardHeader>
                <CardContent><div className="space-y-4">
                   <LogicStep num={1} title="Alma de Samurai" desc="El propósito general y su presentación." color="text-indigo-400" />
                   <LogicStep num={2} title="ADN Core" desc="Rasgos de personalidad, tono." color="text-blue-400" />
                   <LogicStep num={3} title="Estrategia de Cierre" desc="Instrucciones tácticas para vender (Fases 1, 2, 3, 4 y Reactivación)." color="text-emerald-400" />
                   <LogicStep num={4} title="Media Manager (Automático)" desc="Reglas estrictas de pósters y OCR." color="text-yellow-500" />
                   <LogicStep num={5} title="Verdad Maestra & B.C." desc="Textos del sitio web y PDFs." color="text-orange-400" />
                   <LogicStep num={6} title="Bitácora #CIA" desc="Correcciones prioritarias reportadas en el chat." color="text-red-500" />
                </div></CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="identidad" className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in-50">
             <PromptCard title="ADN CORE (PERSONALIDAD)" icon={Fingerprint} value={prompts['prompt_adn_core']} onChange={(v:string) => setPrompts({...prompts, prompt_adn_core: v})} placeholder="Rasgos de personalidad, empatía..." />
             <PromptCard title="ESTRATEGIA DE CIERRE Y FASES" icon={Target} value={prompts['prompt_estrategia_cierre']} onChange={(v:string) => setPrompts({...prompts, prompt_estrategia_cierre: v})} placeholder="Detalla cómo actuar en Fases y Reactivación..." />
          </TabsContent>

          <TabsContent value="versiones" className="animate-in fade-in-50">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4">
                   <div><CardTitle className="text-white flex items-center gap-2"><History className="w-5 h-5 text-indigo-400" /> Historial de Snapshots</CardTitle></div>
                   <Button variant="destructive" size="sm" onClick={handlePurgeHistory} disabled={loadingVersions}>{loadingVersions ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />} Purgar Todo</Button>
                </CardHeader>
                <CardContent className="p-0">
                   <Table>
                      <TableHeader><TableRow className="border-slate-800"><TableHead className="pl-6">Snapshot</TableHead><TableHead>Fecha</TableHead><TableHead className="text-right pr-6">Acción</TableHead></TableRow></TableHeader>
                      <TableBody>
                         {loadingVersions ? <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-indigo-500"/></TableCell></TableRow> : 
                          versions.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-10 text-slate-500 italic">No hay historial.</TableCell></TableRow> :
                          versions.map(v => (
                            <TableRow key={v.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                               <TableCell className="font-mono text-indigo-400 text-xs pl-6">{v.version_name}</TableCell>
                               <TableCell className="text-slate-500 text-xs">{new Date(v.created_at).toLocaleString()}</TableCell>
                               <TableCell className="text-right pr-6">
                                  <div className="flex justify-end gap-2">
                                     <Button variant="outline" size="sm" className="h-8 text-[10px] border-slate-700 hover:text-white" onClick={() => handleRestoreVersion(v)}><RotateCcw className="w-3 h-3 mr-1" /> RESTAURAR</Button>
                                     <Button variant="ghost" size="sm" className="h-8 text-red-500 hover:bg-red-500/10" onClick={() => handleDeleteVersion(v.id)}><Trash2 className="w-4 h-4" /></Button>
                                  </div>
                               </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                   </Table>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="ojo_halcon" className="animate-in fade-in-50">
             <PromptCard title="CAPA 5: OJO DE HALCÓN (VISIÓN AI)" icon={EyeIcon} value={prompts['prompt_vision_instrucciones']} onChange={(v:string) => setPrompts({...prompts, prompt_vision_instrucciones: v})} placeholder="(Opcional) Instrucciones de lectura de comprobantes bancarios y OCR de posters." />
          </TabsContent>

          {/* ======================================================== */}
          {/* SIMULADOR (PRUEBA DE CHAT EN VIVO)                       */}
          {/* ======================================================== */}
          <TabsContent value="simulador" className="animate-in fade-in-50 h-[600px] flex flex-col">
             <Card className="bg-slate-900 border-slate-800 shadow-2xl flex flex-col h-full border-t-4 border-t-blue-500">
                <CardHeader className="border-b border-slate-800 bg-slate-950/30 py-4 shrink-0">
                   <CardTitle className="text-white flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-blue-400" /> Simulador de Interacción
                   </CardTitle>
                   <CardDescription>Habla con Samurai para probar cómo reacciona con tus prompts actuales guardados.</CardDescription>
                </CardHeader>
                <ScrollArea className="flex-1 p-4 bg-black/20">
                   <div className="space-y-6 max-w-4xl mx-auto">
                      {simMessages.length === 0 && (
                          <div className="text-center py-20 text-slate-500">
                             <Bot className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                             <p>Escribe un mensaje para probar las respuestas de Sam.</p>
                          </div>
                      )}
                      
                      {simMessages.map((msg, i) => (
                          <div key={i} className={cn("flex flex-col gap-2", msg.role === 'user' ? 'items-end' : 'items-start')}>
                             <div className={cn("max-w-[85%] rounded-2xl p-4 shadow-xl", msg.role === 'user' ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 rounded-br-sm' : 'bg-slate-950 border border-slate-800 text-slate-300 rounded-bl-sm')}>
                                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                             </div>
                             {msg.explanation && (
                                <div className="max-w-[80%] bg-slate-900/50 border border-slate-800/50 p-3 rounded-lg text-[10px] ml-4">
                                   <span className="text-indigo-400 font-bold uppercase block mb-1">Razonamiento (Kernel):</span>
                                   <span className="text-slate-400 italic">{msg.explanation.reasoning}</span>
                                </div>
                             )}
                          </div>
                      ))}
                      {simulating && (
                          <div className="flex justify-start">
                             <div className="bg-slate-950 border border-slate-800 rounded-2xl rounded-tl-sm p-4 text-sm text-slate-400 flex items-center gap-3">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> Sam está pensando...
                             </div>
                          </div>
                      )}
                      <div ref={simScrollRef} />
                   </div>
                </ScrollArea>
                <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
                   <div className="flex gap-2 max-w-4xl mx-auto">
                      <Input 
                         value={simInput} 
                         onChange={e => setSimInput(e.target.value)} 
                         placeholder="Ej: Hola, quiero info del taller de CDMX..." 
                         className="bg-slate-950 border-slate-700 h-12"
                         onKeyDown={e => { if (e.key === 'Enter') handleSimulateSubmit(); }}
                      />
                      <Button onClick={handleSimulateSubmit} disabled={simulating || !simInput.trim()} className="h-12 w-12 bg-blue-600 hover:bg-blue-700 shrink-0 rounded-xl">
                         <Send className="w-5 h-5" />
                      </Button>
                   </div>
                </div>
             </Card>
          </TabsContent>

          {/* ======================================================== */}
          {/* LABORATORIO IA (CHAT CON EL INGENIERO DE PROMPTS)        */}
          {/* ======================================================== */}
          <TabsContent value="tuner" className="animate-in fade-in-50 h-[600px] flex flex-col">
             <Card className="bg-slate-900 border-slate-800 shadow-2xl flex flex-col h-full border-t-4 border-t-purple-500">
                <CardHeader className="border-b border-slate-800 bg-slate-950/30 py-4 shrink-0">
                   <CardTitle className="text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-400" /> Ingeniero de Prompts IA
                   </CardTitle>
                   <CardDescription>Pega capturas de chats donde Samurai falló o dale instrucciones directas. Regenerará tus Prompts al instante.</CardDescription>
                </CardHeader>
                
                <ScrollArea className="flex-1 p-4 bg-black/20">
                   <div className="space-y-6 max-w-4xl mx-auto">
                      {tunerMessages.length === 0 && (
                          <div className="text-center py-20 text-slate-500 flex flex-col items-center gap-4">
                             <div className="p-4 bg-purple-500/10 rounded-full"><Sparkles className="w-8 h-8 text-purple-400" /></div>
                             <p>Pega aquí una captura del chat (Ctrl+V) o escribe:</p>
                             <p className="text-xs italic">"Samurai está siendo muy agresivo cobrando, suaviza el prompt de cierre."</p>
                          </div>
                      )}
                      
                      {tunerMessages.map((msg, i) => (
                          <div key={i} className={cn("flex", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                             <div className={cn("max-w-[85%] rounded-2xl p-4 shadow-xl", msg.role === 'user' ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 rounded-tr-sm' : 'bg-slate-950 border border-slate-800 text-slate-300 rounded-tl-sm')}>
                                {msg.image && <img src={msg.image} alt="User Context" className="max-w-[300px] rounded-lg mb-3 border border-indigo-500/50 shadow-md" />}
                                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                             </div>
                          </div>
                      ))}
                      {tuning && (
                          <div className="flex justify-start">
                             <div className="bg-slate-950 border border-slate-800 rounded-2xl rounded-tl-sm p-4 text-sm text-slate-400 flex items-center gap-3">
                                <Loader2 className="w-4 h-4 animate-spin text-purple-500" /> Analizando contexto y reescribiendo memoria core...
                             </div>
                          </div>
                      )}
                      <div ref={tunerScrollRef} />
                   </div>
                </ScrollArea>
                
                <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
                   {tunerImage && (
                       <div className="mb-3 relative inline-block">
                           <img src={tunerImage} className="h-20 rounded border border-slate-700 shadow-md" alt="Attached" />
                           <button onClick={() => setTunerImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                       </div>
                   )}
                   <div className="flex gap-2 items-end max-w-4xl mx-auto relative">
                      <label className="cursor-pointer h-12 w-12 flex items-center justify-center bg-slate-950 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors shrink-0" title="Subir Imagen">
                         <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                         <ImageIcon className="w-5 h-5 text-slate-400" />
                      </label>
                      <Textarea 
                         value={tunerInput} 
                         onChange={e => setTunerInput(e.target.value)} 
                         onPaste={handlePasteImage}
                         placeholder="Pega una imagen (Ctrl+V) o escribe qué debo corregir..." 
                         className="min-h-[48px] max-h-32 bg-slate-950 border-slate-700 text-white focus-visible:ring-purple-500 resize-none py-3"
                         onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTuneSubmit(); } }}
                      />
                      <Button onClick={handleTuneSubmit} disabled={tuning || (!tunerInput.trim() && !tunerImage)} className="h-12 w-12 bg-purple-600 hover:bg-purple-700 shrink-0 rounded-xl">
                         <Send className="w-5 h-5" />
                      </Button>
                   </div>
                </div>
             </Card>
          </TabsContent>

          <TabsContent value="debug" className="animate-in fade-in-50">
             <Card className="bg-slate-900 border-slate-800 shadow-2xl relative">
                <div className="absolute top-4 right-4 z-10"><Button onClick={handleRefreshMaster} variant="outline" className="h-8 border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/20" disabled={loadingMaster}>{loadingMaster ? <Loader2 className="w-3 h-3 animate-spin mr-2"/> : <RefreshCcw className="w-3 h-3 mr-2"/>} RE-COMPILAR KERNEL</Button></div>
                <CardHeader><CardTitle className="text-[10px] text-indigo-400 flex items-center gap-2 uppercase tracking-widest"><Terminal className="w-4 h-4" /> Ensamblaje Final del Prompt</CardTitle></CardHeader>
                <CardContent className="h-full">
                   {loadingMaster ? <div className="h-[400px] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div> : 
                    <ScrollArea className="h-[500px] rounded-xl border border-slate-800 p-6 bg-black shadow-inner">
                       <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed select-text">{masterPrompt}</pre>
                    </ScrollArea>}
                </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

const PromptCard = ({ title, icon: Icon, value, onChange, placeholder }: any) => (
  <Card className="bg-slate-900 border-slate-800 h-full hover:border-indigo-500/30 transition-colors shadow-lg flex flex-col">
    <CardHeader className="pb-3 border-b border-slate-800/50 bg-slate-950/30 shrink-0"><CardTitle className="text-xs text-white flex items-center gap-2 uppercase tracking-widest"><Icon className="w-4 h-4 text-indigo-500"/> {title}</CardTitle></CardHeader>
    <CardContent className="p-0 flex-1 flex flex-col">
        <Textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="flex-1 rounded-none border-0 bg-slate-950 font-mono text-xs focus-visible:ring-0 p-4 leading-relaxed custom-scrollbar min-h-[400px]" />
    </CardContent>
  </Card>
);

const LogicStep = ({ num, title, desc, color }: any) => (
   <div className="flex gap-3">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center bg-slate-950 border border-slate-800 text-[10px] font-bold ${color} shrink-0 mt-0.5`}>{num}</div>
      <div>
         <p className={`text-xs font-bold ${color}`}>{title}</p>
         <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{desc}</p>
      </div>
   </div>
);

export default AgentBrain;