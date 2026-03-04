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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Save, Bot, Eye as EyeIcon, Zap, Loader2, Terminal, BrainCircuit, Target, 
  GitBranch, User, RefreshCcw, Layers, History, RotateCcw, Trash2, Send, Image as ImageIcon, Sparkles, X, Fingerprint, MessageSquare, AlertTriangle, Database
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

  // Snapshot Dialog
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');

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
  const [simProfile, setSimProfile] = useState('NORMAL');
  const simScrollRef = useRef<HTMLDivElement>(null);

  // --- TEXTOS MAESTROS POR DEFECTO (RESCATADOS DEL SISTEMA ORIGINAL) ---
  const defaultAlma = `Eres Sam, Asistente Digital del equipo de The Elephant Bowl, la inteligencia avanzada y guardián de la sabiduría de Geoffrey Torkington. 
Tu propósito es guiar a los prospectos en un viaje de transformación a través del sonido y lograr que reserven su lugar en los próximos talleres.
No eres un bot genérico: eres parte del equipo. Nunca uses frases como "soy un modelo de lenguaje".
Tu objetivo central es informar, enamorar y convencer al cliente de comprar el anticipo del próximo taller cercano a su ciudad.`;

  const defaultADN = `Cálido, profesional y con sabiduría: Eres seguro, nunca apresurado.
Empatía adaptativa: Si el cliente está estresado -> baja el ritmo y sé comprensivo. Si es pragmático -> sé directo y claro.
Venta consultiva: Asesoras, no informas. Cada respuesta siembra curiosidad por el curso o los instrumentos.
Usa emojis con moderación para dar calidez (🧘‍♂️, ✨, 🐘).`;

  const defaultCierre = `OBJETIVO PRINCIPAL: Cobrar un anticipo de $1,500 MXN para reservar su lugar.
REGLA DE ORO: ¡Nunca sueltes información de pagos, fechas exactas o precios en tu primer mensaje!

FASE 1 (DATA HUNTING):
- Tu primer objetivo es SIEMPRE preguntar y obtener el NOMBRE y la CIUDAD DE ORIGEN del cliente de forma amable.

FASE 2 (SEDUCCIÓN Y POSTER):
- Una vez que tengas su ciudad, revisa el Media Manager. Si hay un taller en su ciudad, envíale el póster correspondiente usando el código de imagen.

FASE 3 (CIERRE FINANCIERO):
- Cuando el cliente pregunte cómo pagar o muestre interés sólido, PIDE SU EMAIL. Es indispensable antes de cobrar.
- Una vez que tengas su Email, ofrécele pagar el anticipo de $1,500 MXN dándole dos opciones:
  1) Link de Tarjeta/PayPal (Pre-rellenado de WooCommerce).
  2) Depósito/Transferencia manual a los datos bancarios.

REACTIVACIÓN:
- Si el cliente deja de responder por horas, debes llevar un seguimiento sutil, preguntando si pudo revisar la información y si le gustaría asegurar su lugar antes de que se agote.`;

  const defaultVision = `Analiza esta imagen con extremo detalle y precisión.
Si es un POSTER PROMOCIONAL: Extrae el Título del evento, Fechas exactas, Ciudad, Precios y Ubicación.
Si es un COMPROBANTE DE PAGO (Recibo, Transferencia, Screenshot bancario): Extrae el Banco origen/destino, Monto transferido, Fecha de la operación, Nombre del emisor y Número de Referencia o Clave de Rastreo.
Responde estrictamente en texto plano estructurado.`;

  useEffect(() => { fetchPrompts(); fetchVersions(); }, []);
  useEffect(() => { if (tunerScrollRef.current) tunerScrollRef.current.scrollIntoView({ behavior: 'smooth' }); }, [tunerMessages, tuning]);
  useEffect(() => { if (simScrollRef.current) simScrollRef.current.scrollIntoView({ behavior: 'smooth' }); }, [simMessages, simulating]);

  const fetchPrompts = async () => {
    setLoading(true);
    const { data } = await supabase.from('app_config').select('key, value').eq('category', 'PROMPT');
    const p: any = {};
    if (data) data.forEach(item => p[item.key] = item.value);
    
    // Auto-rellenar si están vacíos
    if (!p['prompt_alma_samurai']) p['prompt_alma_samurai'] = defaultAlma;
    if (!p['prompt_adn_core']) p['prompt_adn_core'] = defaultADN;
    if (!p['prompt_estrategia_cierre']) p['prompt_estrategia_cierre'] = defaultCierre;
    if (!p['prompt_vision_instrucciones']) p['prompt_vision_instrucciones'] = defaultVision;
    
    setPrompts(p);
    handleRefreshMaster();
    setLoading(false);
  };

  const fetchVersions = async () => {
    setLoadingVersions(true);
    const { data } = await supabase.from('prompt_versions').select('*').order('created_at', { ascending: false });
    if (data) setVersions(data);
    setLoadingVersions(false);
  };

  const handleRefreshMaster = async () => {
    setLoadingMaster(true);
    const { data } = await supabase.functions.invoke('get-samurai-context');
    if (data) setMasterPrompt(data.system_prompt || "");
    setLoadingMaster(false);
  };

  const handleSaveSnapshot = async () => {
    setSaving(true);
    try {
      const promptsToSave = Object.entries(prompts).map(([key, value]) => ({
        key, value: value || '', category: 'PROMPT',
      }));
      await supabase.from('app_config').upsert(promptsToSave, { onConflict: 'key' });
      
      await supabase.from('prompt_versions').insert({
        version_name: snapshotName || `Manual ${new Date().toLocaleDateString()}`,
        prompts_snapshot: prompts,
        created_by_name: profile?.username || 'Admin',
        notes: 'Snapshot guardado desde el panel'
      });

      toast.success('Cambios aplicados y snapshot creado exitosamente.');
      setIsSaveDialogOpen(false);
      setSnapshotName('');
      handleRefreshMaster();
      fetchVersions();
    } finally {
      setSaving(false);
    }
  };

  const handleSimulateSubmit = async () => {
     if (!simInput.trim()) return;
     const userText = simInput;
     setSimMessages(prev => [...prev, { role: 'user', text: `[PERFIL: ${simProfile}] ${userText}` }]);
     setSimInput('');
     setSimulating(true);
     try {
        const { data } = await supabase.functions.invoke('simulate-samurai', { body: { question: userText, profile: simProfile } });
        setSimMessages(prev => [...prev, { role: 'assistant', text: data.answer, explanation: data.explanation }]);
     } finally {
        setSimulating(false);
     }
  };

  const handleReportSimError = async (userMsg: string, aiRes: string) => {
     const instruction = prompt("¿Qué debería haber respondido o qué instrucción de #CIA quieres inyectar?");
     if (!instruction) return;
     const tid = toast.loading("Inyectando lección en Bitácora...");
     try {
        await supabase.from('errores_ia').insert({
            mensaje_cliente: `SIMULACIÓN: ${userMsg}`, respuesta_ia: aiRes,
            correccion_sugerida: instruction, categoria: 'CONDUCTA', estado_correccion: 'REPORTADA'
        });
        toast.success("Lección enviada a la Bitácora para validación.", { id: tid });
     } catch (err) { toast.error("Error al reportar", { id: tid }); }
  };

  const handlePasteImage = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find(x => x.type.indexOf('image') !== -1);
    if (item) {
        const reader = new FileReader();
        reader.onload = (event) => setTunerImage(event.target?.result as string);
        reader.readAsDataURL(item.getAsFile()!);
    }
  };

  const handleTuneSubmit = async () => {
      if (!tunerInput.trim() && !tunerImage) return;
      const newUserMsg = { role: 'user', text: tunerInput, image: tunerImage };
      setTunerMessages(prev => [...prev, newUserMsg]);
      setTunerInput('');
      setTunerImage(null);
      setTuning(true);
      try {
          const { data } = await supabase.functions.invoke('tune-samurai-prompts', { body: { messages: [...tunerMessages, newUserMsg], currentPrompts: prompts } });
          const result = data.result;
          setTunerMessages(prev => [...prev, { role: 'assistant', text: result.message }]);
          setPrompts({ ...prompts, ...result.prompts });
          toast.success("¡Prompts regenerados! Revisa las pestañas y guarda el snapshot.");
      } finally {
          setTuning(false);
      }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12 flex flex-col h-[calc(100vh-100px)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
               <BrainCircuit className="w-8 h-8 text-indigo-500" /> Cerebro Core
            </h1>
            <p className="text-slate-400 text-sm">Control transparente y absoluto de la IA (Sin código oculto).</p>
          </div>
          <Button onClick={() => setIsSaveDialogOpen(true)} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 font-bold px-8 shadow-xl border border-indigo-400/30 shrink-0">
             {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
             GUARDAR SNAPSHOT
          </Button>
        </div>

        <Tabs value={initialTab} onValueChange={v => setSearchParams({ tab: v })} className="flex flex-col min-h-0 flex-1">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-4 flex-wrap h-auto w-full justify-start shrink-0">
             <TabsTrigger value="alma" className="gap-2"><Target className="w-4 h-4"/> 1. Alma</TabsTrigger>
             <TabsTrigger value="identidad" className="gap-2"><User className="w-4 h-4"/> 2. ADN & Cierre</TabsTrigger>
             <TabsTrigger value="versiones" className="gap-2"><GitBranch className="w-4 h-4"/> 3. Snapshots</TabsTrigger>
             <TabsTrigger value="ojo_halcon" className="gap-2"><EyeIcon className="w-4 h-4"/> 4. Ojo de Halcón</TabsTrigger>
             <TabsTrigger value="simulador" className="gap-2"><MessageSquare className="w-4 h-4"/> 5. Simulador</TabsTrigger>
             <TabsTrigger value="tuner" className="gap-2 bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 transition-all"><Sparkles className="w-4 h-4 text-yellow-400"/> 6. Laboratorio IA</TabsTrigger>
             <TabsTrigger value="debug" className="gap-2"><Terminal className="w-4 h-4"/> 7. Kernel Debug</TabsTrigger>
          </TabsList>

          <TabsContent value="alma" className="flex-1 min-h-0">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
               <PromptCard title="ALMA DE SAMURAI" icon={Bot} value={prompts['prompt_alma_samurai']} onChange={(v:string) => setPrompts({...prompts, prompt_alma_samurai: v})} placeholder="Propósito base..." />
               <Card className="bg-slate-900 border-slate-800 shadow-xl border-l-4 border-l-emerald-500 flex flex-col h-full">
                  <CardHeader className="shrink-0"><CardTitle className="text-white flex items-center gap-2"><Layers className="w-5 h-5 text-emerald-400" /> Jerarquía Completa del Kernel</CardTitle><CardDescription>Así procesa Samurai la información de mayor a menor prioridad.</CardDescription></CardHeader>
                  <CardContent className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                     <LogicStep num={1} title="Alma & ADN Core" desc="Define la personalidad, empatía y misión principal." color="text-indigo-400" icon={Bot}/>
                     <LogicStep num={2} title="Estrategia de Cierre" desc="Instrucciones tácticas para capturar datos y vender." color="text-blue-400" icon={Target}/>
                     <LogicStep num={3} title="Media Manager (Posters)" desc="Inyección automática de códigos visuales según la ciudad." color="text-yellow-500" icon={ImageIcon}/>
                     <LogicStep num={4} title="Verdad Maestra (Web)" desc="Precios, temarios y fechas oficiales leídas de theelephantbowl.com." color="text-emerald-400" icon={Database}/>
                     <LogicStep num={5} title="Base de Conocimiento" desc="PDFs adicionales y catálogos estáticos." color="text-orange-400" icon={Fingerprint}/>
                     <LogicStep num={6} title="Bitácora #CIA (Overrule)" desc="Instrucciones post-entrenamiento. Rompen cualquier regla anterior si hay conflicto." color="text-red-500" icon={AlertTriangle}/>
                  </CardContent>
               </Card>
             </div>
          </TabsContent>

          <TabsContent value="identidad" className="flex-1 min-h-0">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
               <PromptCard title="ADN CORE" icon={Fingerprint} value={prompts['prompt_adn_core']} onChange={(v:string) => setPrompts({...prompts, prompt_adn_core: v})} placeholder="Tono y empatía..." />
               <PromptCard title="ESTRATEGIA DE CIERRE" icon={Target} value={prompts['prompt_estrategia_cierre']} onChange={(v:string) => setPrompts({...prompts, prompt_estrategia_cierre: v})} placeholder="Fases tácticas..." />
             </div>
          </TabsContent>

          <TabsContent value="versiones" className="flex-1 min-h-0">
             <Card className="bg-slate-900 border-slate-800 h-full flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4 shrink-0">
                   <div><CardTitle className="text-white flex items-center gap-2"><History className="w-5 h-5 text-indigo-400" /> Historial de Entrenamientos</CardTitle></div>
                   <Button variant="destructive" size="sm" onClick={async () => { if(confirm("¿Purgar todo?")) await supabase.functions.invoke('manage-prompt-versions', { body: { action: 'PURGE' } }); fetchVersions(); }}>Purgar</Button>
                </CardHeader>
                <div className="flex-1 overflow-y-auto">
                   <Table>
                      <TableHeader><TableRow className="border-slate-800"><TableHead className="pl-6">Versión</TableHead><TableHead>Fecha</TableHead><TableHead className="text-right pr-6">Acción</TableHead></TableRow></TableHeader>
                      <TableBody>
                         {versions.map(v => (
                            <TableRow key={v.id} className="border-slate-800 hover:bg-slate-800/30">
                               <TableCell className="font-mono text-indigo-400 text-xs pl-6">{v.version_name}</TableCell>
                               <TableCell className="text-slate-500 text-xs">{new Date(v.created_at).toLocaleString()}</TableCell>
                               <TableCell className="text-right pr-6"><Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => { setPrompts(v.prompts_snapshot); toast.info("Cargado. Guarda para aplicar."); }}><RotateCcw className="w-3 h-3 mr-1" /> RESTAURAR</Button></TableCell>
                            </TableRow>
                         ))}
                      </TableBody>
                   </Table>
                </div>
             </Card>
          </TabsContent>

          <TabsContent value="ojo_halcon" className="flex-1 min-h-0">
             <PromptCard title="VISIÓN AI (INSTRUCCIONES OCR)" icon={EyeIcon} value={prompts['prompt_vision_instrucciones']} onChange={(v:string) => setPrompts({...prompts, prompt_vision_instrucciones: v})} placeholder="Instrucciones OCR..." />
          </TabsContent>

          <TabsContent value="simulador" className="flex-1 min-h-0 flex flex-col">
             <Card className="bg-slate-900 border-slate-800 shadow-2xl flex flex-col h-full border-t-4 border-t-blue-500 overflow-hidden">
                <CardHeader className="border-b border-slate-800 bg-slate-950/30 py-4 flex flex-row items-center justify-between shrink-0">
                   <div>
                      <CardTitle className="text-white text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-blue-400" /> Simulador de Combate</CardTitle>
                      <CardDescription className="text-[10px]">Prueba tus cambios antes de ir a producción.</CardDescription>
                   </div>
                   <Select value={simProfile} onValueChange={setSimProfile}>
                      <SelectTrigger className="w-40 bg-slate-950 border-slate-800 h-8 text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-900 text-white border-slate-800">
                         <SelectItem value="NORMAL">Lead Normal</SelectItem>
                         <SelectItem value="HOSTIL">Lead Hostil / Difícil</SelectItem>
                         <SelectItem value="SIN_DATOS">Lead sin Nombre/Ciudad</SelectItem>
                         <SelectItem value="INTERESADO">Lead Alta Intención</SelectItem>
                      </SelectContent>
                   </Select>
                </CardHeader>
                <div className="flex-1 overflow-y-auto p-4 bg-black/20 custom-scrollbar">
                   <div className="space-y-4 max-w-4xl mx-auto">
                      {simMessages.map((msg, i) => (
                          <div key={i} className={cn("flex flex-col gap-2", msg.role === 'user' ? 'items-end' : 'items-start')}>
                             <div className={cn("max-w-[85%] rounded-2xl p-4 text-sm group relative", msg.role === 'user' ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100' : 'bg-slate-950 border border-slate-800 text-slate-300')}>
                                <p className="whitespace-pre-wrap">{msg.text}</p>
                                {msg.role === 'assistant' && (
                                   <button onClick={() => handleReportSimError(simMessages[i-1]?.text, msg.text)} className="absolute -right-12 top-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400" title="Reportar error a #CIA"><AlertTriangle className="w-4 h-4" /></button>
                                )}
                             </div>
                             {msg.explanation && <div className="text-[9px] text-slate-500 italic ml-4 bg-slate-900/50 p-2 rounded max-w-[80%] border border-slate-800/50"><strong className="text-indigo-400">Razón Kernel:</strong> {msg.explanation.reasoning}</div>}
                          </div>
                      ))}
                      {simulating && <div className="text-slate-500 flex gap-2 items-center text-sm p-4"><Loader2 className="w-4 h-4 animate-spin text-blue-500"/> Sam pensando...</div>}
                      <div ref={simScrollRef} />
                   </div>
                </div>
                <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
                   <div className="flex gap-2 max-w-4xl mx-auto">
                      <Input value={simInput} onChange={e => setSimInput(e.target.value)} placeholder="Simular mensaje del cliente..." className="bg-slate-950 border-slate-700 h-12" onKeyDown={e => e.key === 'Enter' && handleSimulateSubmit()} />
                      <Button onClick={handleSimulateSubmit} disabled={simulating} className="bg-blue-600 h-12 w-12 shrink-0"><Send className="w-4 h-4" /></Button>
                   </div>
                </div>
             </Card>
          </TabsContent>

          <TabsContent value="tuner" className="flex-1 min-h-0 flex flex-col">
             <Card className="bg-slate-900 border-slate-800 shadow-2xl flex flex-col h-full border-t-4 border-t-purple-500 overflow-hidden">
                <CardHeader className="border-b border-slate-800 bg-slate-950/30 py-4 shrink-0">
                   <CardTitle className="text-white text-sm flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-400" /> Laboratorio IA (Tuner)</CardTitle>
                   <CardDescription className="text-[10px]">Pide a la IA que modifique tus Prompts (Alma, ADN, Cierre, Ojo de Halcón).</CardDescription>
                </CardHeader>
                <div className="flex-1 overflow-y-auto p-4 bg-black/20 custom-scrollbar">
                   <div className="space-y-4 max-w-4xl mx-auto">
                      {tunerMessages.length === 0 && (
                          <div className="text-center py-20 text-slate-500">
                             <div className="mx-auto w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mb-4"><Sparkles className="w-8 h-8 text-purple-500"/></div>
                             <p>Explícale a la IA qué quieres cambiar en la configuración, o pega una captura de un error.</p>
                             <p className="text-xs italic mt-2 opacity-60">"Modifica el prompt de Ojo de Halcón para que solo extraiga números."</p>
                          </div>
                      )}
                      {tunerMessages.map((msg, i) => (
                          <div key={i} className={cn("flex", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                             <div className={cn("max-w-[85%] rounded-2xl p-4 text-sm shadow-xl", msg.role === 'user' ? 'bg-indigo-600/20 border border-indigo-500/30' : 'bg-slate-950 border border-slate-800')}>
                                {msg.image && <img src={msg.image} className="max-w-[200px] rounded-lg mb-2 border border-slate-700" alt="context" />}
                                <p className="whitespace-pre-wrap">{msg.text}</p>
                             </div>
                          </div>
                      ))}
                      {tuning && <div className="p-4 text-xs text-slate-500 animate-pulse">Reescribiendo memoria core...</div>}
                      <div ref={tunerScrollRef} />
                   </div>
                </div>
                <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
                   {tunerImage && <div className="mb-2 relative inline-block"><img src={tunerImage} className="h-14 rounded" /><button onClick={() => setTunerImage(null)} className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5"><X className="w-3 h-3" /></button></div>}
                   <div className="flex gap-2 max-w-4xl mx-auto items-end relative">
                      <label className="cursor-pointer shrink-0 w-11 h-11 bg-slate-950 border border-slate-700 rounded-lg flex items-center justify-center hover:bg-slate-800 transition-colors">
                         <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                             if (e.target.files && e.target.files[0]) {
                                 const reader = new FileReader();
                                 reader.onload = (ev) => setTunerImage(ev.target?.result as string);
                                 reader.readAsDataURL(e.target.files[0]);
                             }
                         }}/>
                         <ImageIcon className="w-5 h-5 text-slate-400" />
                      </label>
                      <Textarea value={tunerInput} onChange={e => setTunerInput(e.target.value)} onPaste={handlePasteImage} placeholder="Escribe tu instrucción al Ingeniero..." className="bg-slate-950 border-slate-700 min-h-[44px] max-h-32 resize-none py-3 text-sm" onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTuneSubmit(); }}} />
                      <Button onClick={handleTuneSubmit} disabled={tuning || (!tunerInput.trim() && !tunerImage)} className="h-11 w-11 shrink-0 bg-purple-600"><Send className="w-4 h-4" /></Button>
                   </div>
                </div>
             </Card>
          </TabsContent>

          <TabsContent value="debug" className="flex-1 min-h-0 flex flex-col">
             <Card className="bg-slate-900 border-slate-800 shadow-2xl relative flex flex-col h-full overflow-hidden">
                <div className="absolute top-4 right-4 z-10"><Button onClick={handleRefreshMaster} variant="outline" className="h-8 border-indigo-500/50 text-indigo-400 bg-slate-900 hover:bg-indigo-500/20" disabled={loadingMaster}>{loadingMaster ? <Loader2 className="w-3 h-3 animate-spin mr-2"/> : <RefreshCcw className="w-3 h-3 mr-2"/>} RE-COMPILAR KERNEL</Button></div>
                <CardHeader className="shrink-0"><CardTitle className="text-[10px] text-indigo-400 flex items-center gap-2 uppercase tracking-widest"><Terminal className="w-4 h-4" /> Ensamblaje Final del Prompt (Solo Lectura)</CardTitle></CardHeader>
                <div className="flex-1 overflow-y-auto bg-black shadow-inner p-6 custom-scrollbar">
                   {loadingMaster ? <div className="h-full flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div> : 
                    <pre className="text-[10px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed select-text">{masterPrompt}</pre>
                   }
                </div>
             </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
           <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-sm">
              <DialogHeader><DialogTitle>Crear Snapshot</DialogTitle><DialogDescription>Ponle un nombre para recordarlo.</DialogDescription></DialogHeader>
              <div className="py-4"><Input value={snapshotName} onChange={e => setSnapshotName(e.target.value)} placeholder="Ej: Fix Precios Monterrey" className="bg-slate-950 border-slate-800" /></div>
              <DialogFooter><Button onClick={handleSaveSnapshot} disabled={saving} className="bg-indigo-600 w-full">{saving ? <Loader2 className="animate-spin w-4 h-4" /> : 'Confirmar & Guardar'}</Button></DialogFooter>
           </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

const PromptCard = ({ title, icon: Icon, value, onChange, placeholder }: any) => (
  <Card className="bg-slate-900 border-slate-800 h-full hover:border-indigo-500/30 transition-colors shadow-lg flex flex-col overflow-hidden">
    <CardHeader className="pb-3 border-b border-slate-800/50 bg-slate-950/30 shrink-0"><CardTitle className="text-xs text-white flex items-center gap-2 uppercase tracking-widest"><Icon className="w-4 h-4 text-indigo-500"/> {title}</CardTitle></CardHeader>
    <CardContent className="p-0 flex-1 flex flex-col">
        <Textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="flex-1 rounded-none border-0 bg-slate-950 font-mono text-xs focus-visible:ring-0 p-4 leading-relaxed custom-scrollbar resize-none" />
    </CardContent>
  </Card>
);

const LogicStep = ({ num, title, desc, color, icon: Icon }: any) => (
   <div className="flex gap-4 items-start bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-900 border border-slate-700 shrink-0 ${color}`}><Icon className="w-4 h-4" /></div>
      <div>
         <p className={`text-xs font-bold ${color}`}>{num}. {title}</p>
         <p className="text-[11px] text-slate-400 leading-relaxed mt-1">{desc}</p>
      </div>
   </div>
);

export default AgentBrain;