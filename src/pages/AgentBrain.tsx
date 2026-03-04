import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Save, Bot, Eye as EyeIcon, Zap, Loader2, Terminal, BrainCircuit, Target, 
  GitBranch, User, RefreshCcw, Layers, History, RotateCcw, Quote, Fingerprint, Image, Trash2, ShieldCheck, Database
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

  // Defaults sugeridos si está vacío
  const defaultAlma = "Eres el asistente digital del equipo de The Elephant Bowl, la inteligencia avanzada y guardián de la sabiduría de Geoffrey Torkington. Tu propósito no es solo responder dudas, sino guiar a los prospectos en un viaje de transformación a través del sonido.\n\nTe presentas amablemente como 'Sam'. La idea es llevar al cliente al link de compra, vendiendo una reservación de $1500 MXN.";
  const defaultEstrategia = "FASE 1 (DATA HUNTING):\nNo sueltes precios sin pedir antes el Nombre y la Ciudad de la persona.\n\nFASE 2 (SEDUCCIÓN):\nUsa la ciudad para enviar el póster más cercano del Media Manager.\n\nFASE 3 (CIERRE):\nEl anticipo es de $1,500 MXN. Ofrece el link de pago o los datos bancarios. REGLA ABSOLUTA: Solo da el link o datos si ya tienes el EMAIL del cliente.\n\nREACTIVACIÓN:\nSi el cliente dejó de responder, pregúntale amablemente si pudo revisar la información y si tiene dudas.";

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
        
        // Inyectar defaults si no existen
        if (!p['prompt_alma_samurai']) p['prompt_alma_samurai'] = defaultAlma;
        if (!p['prompt_estrategia_cierre']) p['prompt_estrategia_cierre'] = defaultEstrategia;
        if (!p['prompt_vision_instrucciones']) p['prompt_vision_instrucciones'] = ""; // Limpio por defecto
        
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
        notes: 'Snapshot Manual'
      });

      toast.success('Jerarquía guardada en Base de Datos y Kernel actualizado.');
      handleRefreshMaster();
      fetchVersions();
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreVersion = async (version: any) => {
    if (!confirm(`¿Restaurar la versión ${version.version_name}?`)) return;
    setPrompts(version.prompts_snapshot);
    toast.info("Versión cargada en los paneles. Dale a 'GUARDAR SNAPSHOT' para aplicarla al bot.");
  };

  const handleDeleteVersion = async (id: string) => {
     if (!confirm("¿Eliminar este Snapshot del historial?")) return;
     try {
        await supabase.from('prompt_versions').delete().eq('id', id);
        toast.success("Snapshot eliminado");
        fetchVersions();
     } catch (err) { toast.error("Error al eliminar"); }
  };

  const handlePurgeHistory = async () => {
     if (!confirm("⚠️ ADVERTENCIA: Esto borrará TODOS los snapshots de la base de datos. La configuración actual NO se perderá. ¿Continuar?")) return;
     try {
        // Obtenemos todos los IDs y los borramos
        const ids = versions.map(v => v.id);
        if(ids.length > 0) {
            await supabase.from('prompt_versions').delete().in('id', ids);
        }
        toast.success("Historial purgado desde cero.");
        fetchVersions();
     } catch (err) { toast.error("Error al limpiar historial"); }
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
             <TabsTrigger value="debug" className="gap-2"><Terminal className="w-4 h-4"/> 5. Kernel Debug</TabsTrigger>
          </TabsList>

          <TabsContent value="alma" className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in-50">
             <PromptCard 
                title="ALMA DE SAMURAI (PROPÓSITO BASE)" 
                icon={Bot} 
                value={prompts['prompt_alma_samurai']} 
                onChange={(v:string) => setPrompts({...prompts, prompt_alma_samurai: v})} 
                placeholder="Instrucciones iniciales, propósito y presentación base..." 
             />
             
             <Card className="bg-slate-900 border-slate-800 shadow-xl h-full border-l-4 border-l-emerald-500">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><Layers className="w-5 h-5 text-emerald-400" /> Cómo lee Samurai tus Prompts</CardTitle>
                   <CardDescription>El Kernel ensambla tu configuración exactamente en este orden para evitar confusiones.</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="space-y-4">
                      <LogicStep num={1} title="Alma de Samurai" desc="El propósito general y su presentación (ej. Soy Sam, asistente digital)." color="text-indigo-400" />
                      <LogicStep num={2} title="ADN Core" desc="Rasgos de personalidad, tono (calma, sabiduría, empatía)." color="text-blue-400" />
                      <LogicStep num={3} title="Estrategia de Cierre" desc="Instrucciones tácticas para vender (Fases 1, 2, 3, 4 y Reactivación)." color="text-emerald-400" />
                      <LogicStep num={4} title="Media Manager (Automático)" desc="El sistema inyecta reglas estrictas: Sugerir sedes cercanas, usar OCR, no ofrecer fechas pasadas." color="text-yellow-500" />
                      <LogicStep num={5} title="Verdad Maestra & Base Conocimiento" desc="Inyecta los textos leídos de tu sitio web y PDFs." color="text-orange-400" />
                      <LogicStep num={6} title="Bitácora #CIA" desc="Correcciones prioritarias reportadas desde el chat." color="text-red-500" />
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="identidad" className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in-50">
             <PromptCard title="ADN CORE (PERSONALIDAD)" icon={Fingerprint} value={prompts['prompt_adn_core']} onChange={(v:string) => setPrompts({...prompts, prompt_adn_core: v})} placeholder="Rasgos de personalidad, empatía, cómo manejar objeciones..." />
             <PromptCard title="ESTRATEGIA DE CIERRE Y FASES" icon={Target} value={prompts['prompt_estrategia_cierre']} onChange={(v:string) => setPrompts({...prompts, prompt_estrategia_cierre: v})} placeholder="Detalla cómo actuar en Fase 1, Fase 2, Fase 3 y Reactivación..." />
          </TabsContent>

          <TabsContent value="versiones" className="animate-in fade-in-50">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4">
                   <div>
                      <CardTitle className="text-white flex items-center gap-2"><History className="w-5 h-5 text-indigo-400" /> Puntos de Restauración</CardTitle>
                      <CardDescription>Cada vez que guardas, se crea una copia exacta de todos los prompts.</CardDescription>
                   </div>
                   <Button variant="destructive" size="sm" onClick={handlePurgeHistory}>
                      <Trash2 className="w-4 h-4 mr-2" /> Empezar de Cero (Purgar Historial)
                   </Button>
                </CardHeader>
                <CardContent className="p-0">
                   <Table>
                      <TableHeader><TableRow className="border-slate-800"><TableHead className="pl-6">Snapshot</TableHead><TableHead>Fecha</TableHead><TableHead className="text-right pr-6">Acción</TableHead></TableRow></TableHeader>
                      <TableBody>
                         {loadingVersions ? <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow> : 
                          versions.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-10 text-slate-500 italic">No hay historial. Guarda un snapshot para empezar.</TableCell></TableRow> :
                          versions.map(v => (
                            <TableRow key={v.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                               <TableCell className="font-mono text-indigo-400 text-xs pl-6">{v.version_name}</TableCell>
                               <TableCell className="text-slate-500 text-xs">{new Date(v.created_at).toLocaleString()}</TableCell>
                               <TableCell className="text-right pr-6">
                                  <div className="flex justify-end gap-2">
                                     <Button variant="outline" size="sm" className="h-8 text-[10px] border-slate-700" onClick={() => handleRestoreVersion(v)}><RotateCcw className="w-3 h-3 mr-1" /> RESTAURAR</Button>
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
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-red-600 shadow-2xl">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><EyeIcon className="w-5 h-5 text-red-600" /> Capa 5: Ojo de Halcón (Visión AI)</CardTitle><CardDescription>Protocolos para auditar fotos de comprobantes bancarios.</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                   <Textarea value={prompts['prompt_vision_instrucciones'] || ''} onChange={e => setPrompts({...prompts, prompt_vision_instrucciones: e.target.value})} className="min-h-[350px] bg-slate-950 border-slate-800 font-mono text-xs focus:border-red-600 leading-relaxed" placeholder="(Opcional) Puedes dejar esto en blanco. Si está en blanco, usará el prompt estándar de extracción financiera." />
                </CardContent>
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
  <Card className="bg-slate-900 border-slate-800 h-full hover:border-indigo-500/30 transition-colors shadow-lg">
    <CardHeader className="pb-3 border-b border-slate-800/50 bg-slate-950/30"><CardTitle className="text-xs text-white flex items-center gap-2 uppercase tracking-widest"><Icon className="w-4 h-4 text-indigo-500"/> {title}</CardTitle></CardHeader>
    <CardContent className="pt-4"><Textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="min-h-[400px] bg-slate-950 border-slate-800 font-mono text-xs focus:border-indigo-500 leading-relaxed" /></CardContent>
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