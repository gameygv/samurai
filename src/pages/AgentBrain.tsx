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
  GitBranch, User, RefreshCcw, Layers, History, RotateCcw, Trash2, Send, Image as ImageIcon, Sparkles, X, Fingerprint, MessageSquare, AlertTriangle, ShieldCheck
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

  useEffect(() => { fetchPrompts(); fetchVersions(); }, []);
  useEffect(() => { if (tunerScrollRef.current) tunerScrollRef.current.scrollIntoView({ behavior: 'smooth' }); }, [tunerMessages, tuning]);
  useEffect(() => { if (simScrollRef.current) simScrollRef.current.scrollIntoView({ behavior: 'smooth' }); }, [simMessages, simulating]);

  const fetchPrompts = async () => {
    setLoading(true);
    const { data } = await supabase.from('app_config').select('key, value').eq('category', 'PROMPT');
    if (data) {
        const p: any = {};
        data.forEach(item => p[item.key] = item.value);
        setPrompts(p);
    }
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

      toast.success('Cambios aplicados y snapshot creado.');
      setIsSaveDialogOpen(false);
      setSnapshotName('');
      handleRefreshMaster();
      fetchVersions();
    } finally {
      setSaving(false);
    }
  };

  // --- SIMULATOR ---
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
            mensaje_cliente: `SIMULACIÓN: ${userMsg}`,
            respuesta_ia: aiRes,
            correccion_sugerida: instruction,
            categoria: 'CONDUCTA',
            estado_correccion: 'REPORTADA'
        });
        toast.success("Lección enviada a la Bitácora para validación.", { id: tid });
     } catch (err) {
        toast.error("Error al reportar", { id: tid });
     }
  };

  // --- LABORATORY ---
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
          toast.success("¡Prompts regenerados! Revisa las pestañas.");
      } finally {
          setTuning(false);
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
            <p className="text-slate-400 text-sm">Ingeniería táctica de Samurai AI.</p>
          </div>
          <Button onClick={() => setIsSaveDialogOpen(true)} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 font-bold px-8 shadow-xl border border-indigo-400/30">
             {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
             GUARDAR SNAPSHOT
          </Button>
        </div>

        <Tabs value={initialTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 mb-6 flex-wrap h-auto w-full justify-start">
             <TabsTrigger value="alma" className="gap-2"><Target className="w-4 h-4"/> 1. Alma</TabsTrigger>
             <TabsTrigger value="identidad" className="gap-2"><User className="w-4 h-4"/> 2. ADN & Cierre</TabsTrigger>
             <TabsTrigger value="versiones" className="gap-2"><GitBranch className="w-4 h-4"/> 3. Snapshots</TabsTrigger>
             <TabsTrigger value="ojo_halcon" className="gap-2"><EyeIcon className="w-4 h-4"/> 4. Ojo de Halcón</TabsTrigger>
             <TabsTrigger value="simulador" className="gap-2"><MessageSquare className="w-4 h-4"/> 5. Simulador</TabsTrigger>
             <TabsTrigger value="tuner" className="gap-2 bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 transition-all"><Sparkles className="w-4 h-4 text-yellow-400"/> 6. Laboratorio IA</TabsTrigger>
             <TabsTrigger value="debug" className="gap-2"><Terminal className="w-4 h-4"/> 7. Kernel Debug</TabsTrigger>
          </TabsList>

          <TabsContent value="alma" className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in-50">
             <PromptCard title="ALMA DE SAMURAI" icon={Bot} value={prompts['prompt_alma_samurai']} onChange={(v:string) => setPrompts({...prompts, prompt_alma_samurai: v})} placeholder="Propósito base..." />
             <Card className="bg-slate-900 border-slate-800 shadow-xl border-l-4 border-l-emerald-500">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><Layers className="w-5 h-5 text-emerald-400" /> Jerarquía de Verdad</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                   <LogicStep num={1} title="Alma & ADN" desc="Propósito y Tono." color="text-indigo-400" />
                   <LogicStep num={2} title="Estrategia" desc="Fases de venta." color="text-blue-400" />
                   <LogicStep num={3} title="Sitio Web" desc="Datos de precios/fechas." color="text-emerald-400" />
                   <LogicStep num={4} title="Bitácora #CIA" desc="Lecciones del chat." color="text-red-500" />
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="identidad" className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <PromptCard title="ADN CORE" icon={Fingerprint} value={prompts['prompt_adn_core']} onChange={(v:string) => setPrompts({...prompts, prompt_adn_core: v})} placeholder="Tono y empatía..." />
             <PromptCard title="ESTRATEGIA DE CIERRE" icon={Target} value={prompts['prompt_estrategia_cierre']} onChange={(v:string) => setPrompts({...prompts, prompt_estrategia_cierre: v})} placeholder="Fases tácticas..." />
          </TabsContent>

          <TabsContent value="versiones">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4">
                   <div><CardTitle className="text-white flex items-center gap-2"><History className="w-5 h-5 text-indigo-400" /> Historial</CardTitle></div>
                   <Button variant="destructive" size="sm" onClick={async () => { if(confirm("¿Purgar todo?")) await supabase.functions.invoke('manage-prompt-versions', { body: { action: 'PURGE' } }); fetchVersions(); }}>Purgar</Button>
                </CardHeader>
                <CardContent className="p-0">
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
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="ojo_halcon">
             <PromptCard title="VISIÓN AI" icon={EyeIcon} value={prompts['prompt_vision_instrucciones']} onChange={(v:string) => setPrompts({...prompts, prompt_vision_instrucciones: v})} placeholder="Instrucciones OCR..." />
          </TabsContent>

          <TabsContent value="simulador" className="h-[600px] flex flex-col">
             <Card className="bg-slate-900 border-slate-800 shadow-2xl flex flex-col h-full border-t-4 border-t-blue-500">
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
                <ScrollArea className="flex-1 p-4 bg-black/20">
                   <div className="space-y-4 max-w-4xl mx-auto">
                      {simMessages.map((msg, i) => (
                          <div key={i} className={cn("flex flex-col gap-2", msg.role === 'user' ? 'items-end' : 'items-start')}>
                             <div className={cn("max-w-[85%] rounded-2xl p-4 text-sm group relative", msg.role === 'user' ? 'bg-indigo-600/20 border border-indigo-500/30' : 'bg-slate-950 border border-slate-800')}>
                                {msg.text}
                                {msg.role === 'assistant' && (
                                   <button 
                                      onClick={() => handleReportSimError(simMessages[i-1]?.text, msg.text)}
                                      className="absolute -right-12 top-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400"
                                      title="Reportar error a #CIA"
                                   >
                                      <AlertTriangle className="w-4 h-4" />
                                   </button>
                                )}
                             </div>
                             {msg.explanation && <div className="text-[9px] text-slate-500 italic ml-4">Raíz: {msg.explanation.reasoning}</div>}
                          </div>
                      ))}
                      <div ref={simScrollRef} />
                   </div>
                </ScrollArea>
                <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
                   <div className="flex gap-2 max-w-4xl mx-auto">
                      <Input value={simInput} onChange={e => setSimInput(e.target.value)} placeholder="Simular mensaje del cliente..." className="bg-slate-950 border-slate-700" onKeyDown={e => e.key === 'Enter' && handleSimulateSubmit()} />
                      <Button onClick={handleSimulateSubmit} disabled={simulating} className="bg-blue-600"><Send className="w-4 h-4" /></Button>
                   </div>
                </div>
             </Card>
          </TabsContent>

          <TabsContent value="tuner" className="h-[600px] flex flex-col">
             <Card className="bg-slate-900 border-slate-800 shadow-2xl flex flex-col h-full border-t-4 border-t-purple-500">
                <CardHeader className="border-b border-slate-800 bg-slate-950/30 py-4 shrink-0">
                   <CardTitle className="text-white text-sm flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-400" /> Laboratorio IA (Tuner)</CardTitle>
                   <CardDescription className="text-[10px]">Pega capturas (Ctrl+V) y pide mejoras. Los prompts se actualizarán solos.</CardDescription>
                </CardHeader>
                <ScrollArea className="flex-1 p-4 bg-black/20">
                   <div className="space-y-4 max-w-4xl mx-auto">
                      {tunerMessages.map((msg, i) => (
                          <div key={i} className={cn("flex", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                             <div className={cn("max-w-[85%] rounded-2xl p-4 text-sm shadow-xl", msg.role === 'user' ? 'bg-indigo-600/20 border border-indigo-500/30' : 'bg-slate-950 border border-slate-800')}>
                                {msg.image && <img src={msg.image} className="max-w-[200px] rounded-lg mb-2" alt="context" />}
                                {msg.text}
                             </div>
                          </div>
                      ))}
                      {tuning && <div className="p-4 text-xs text-slate-500 animate-pulse">Reescribiendo memoria core...</div>}
                      <div ref={tunerScrollRef} />
                   </div>
                </ScrollArea>
                <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
                   {tunerImage && <div className="mb-2 relative inline-block"><img src={tunerImage} className="h-14 rounded" /><button onClick={() => setTunerImage(null)} className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5"><X className="w-3 h-3" /></button></div>}
                   <div className="flex gap-2 max-w-4xl mx-auto items-end">
                      <Textarea value={tunerInput} onChange={e => setTunerInput(e.target.value)} onPaste={handlePasteImage} placeholder="Pega captura o escribe instrucción..." className="bg-slate-950 border-slate-700 min-h-[44px] max-h-32 resize-none py-3" onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTuneSubmit(); }}} />
                      <Button onClick={handleTuneSubmit} disabled={tuning} className="h-11 bg-purple-600"><Send className="w-4 h-4" /></Button>
                   </div>
                </div>
             </Card>
          </TabsContent>

          <TabsContent value="debug">
             <Card className="bg-black border-slate-800 p-6 shadow-inner"><pre className="text-[10px] text-slate-500 font-mono whitespace-pre-wrap">{masterPrompt}</pre></Card>
          </TabsContent>
        </Tabs>

        {/* DIALOGO DE GUARDADO */}
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
  <Card className="bg-slate-900 border-slate-800 h-full hover:border-indigo-500/20 transition-all flex flex-col shadow-2xl">
    <CardHeader className="pb-3 border-b border-slate-800/50 bg-slate-950/20 shrink-0"><CardTitle className="text-xs text-white flex items-center gap-2 uppercase tracking-widest"><Icon className="w-4 h-4 text-indigo-500"/> {title}</CardTitle></CardHeader>
    <CardContent className="p-0 flex-1"><Textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="flex-1 rounded-none border-0 bg-slate-950 font-mono text-xs focus-visible:ring-0 p-4 leading-relaxed h-[400px] custom-scrollbar" /></CardContent>
  </Card>
);

const LogicStep = ({ num, title, desc, color }: any) => (
   <div className="flex gap-3"><div className={`w-5 h-5 rounded-full flex items-center justify-center bg-slate-950 border border-slate-800 text-[9px] font-bold ${color} shrink-0`}>{num}</div><div><p className={`text-xs font-bold ${color}`}>{title}</p><p className="text-[10px] text-slate-500 mt-0.5">{desc}</p></div></div>
);

export default AgentBrain;