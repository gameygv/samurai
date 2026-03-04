"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, Eye as EyeIcon, Zap, Loader2, Terminal, BrainCircuit, Target, 
  GitBranch, RefreshCcw, Layers, History, RotateCcw, Send, Sparkles, Fingerprint, MessageSquare, AlertTriangle, Database, ImageIcon, Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PromptEditor } from '@/components/brain/PromptEditor';
import { KernelStep } from '@/components/brain/KernelStep';

const AgentBrain = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'alma';
  
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [masterPrompt, setMasterPrompt] = useState("");
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);

  const simEndRef = useRef<HTMLDivElement>(null);
  const tunerEndRef = useRef<HTMLDivElement>(null);

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

  const handleRefreshMaster = async () => {
    setLoadingMaster(true);
    try {
      const { data } = await supabase.functions.invoke('get-samurai-context');
      if (data) setMasterPrompt(data.system_prompt || "");
    } finally { setLoadingMaster(false); }
  };

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto flex flex-col h-[calc(100vh-140px)] gap-6 overflow-hidden">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
               <BrainCircuit className="w-8 h-8 text-indigo-500" /> Cerebro Core
               <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px]"><Lock className="w-3 h-3 mr-1"/> SOLO LECTURA</Badge>
            </h1>
            <p className="text-slate-400 text-sm">Configuración Maestra protegida contra escritura.</p>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" disabled className="border-slate-800 text-slate-600 cursor-not-allowed">
                <RotateCcw className="w-4 h-4 mr-2"/> RESTAURAR ADN
             </Button>
             <Button disabled className="bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed">
                <Lock className="w-4 h-4 mr-2" /> GUARDAR BLOQUEADO
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
                  <PromptEditor title="Alma de Samurai" icon={Bot} value={prompts['prompt_alma_samurai']} onChange={() => {}} />
                  <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-emerald-500 flex flex-col h-full overflow-hidden">
                    <CardHeader className="shrink-0 py-3 border-b border-slate-800 bg-slate-950/20"><CardTitle className="text-white text-[10px] uppercase tracking-widest flex items-center gap-2"><Layers className="w-3 h-3 text-emerald-400" /> Jerarquía Técnica</CardTitle></CardHeader>
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-3">
                          <KernelStep num={1} title="Alma & ADN Core" desc="Propósito supremo." color="text-indigo-400" icon={Bot}/>
                          <KernelStep num={2} title="Estrategia de Cierre" desc="Protocolo de ventas." color="text-blue-400" icon={Target}/>
                          <KernelStep num={3} title="Media Manager" desc="Pósters y disparadores." color="text-yellow-500" icon={ImageIcon}/>
                          <KernelStep num={4} title="Verdad Maestra" desc="Datos oficiales web." color="text-emerald-400" icon={Database}/>
                          <KernelStep num={6} title="Bitácora #CIA" desc="Correcciones críticas." color="text-red-500" icon={AlertTriangle}/>
                      </div>
                    </ScrollArea>
                  </Card>
                </div>
            </TabsContent>

            <TabsContent value="identidad" className="absolute inset-0 m-0 h-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                  <PromptEditor title="ADN Core (Personalidad)" icon={Fingerprint} value={prompts['prompt_adn_core']} onChange={() => {}} />
                  <PromptEditor title="Estrategia de Cierre" icon={Target} value={prompts['prompt_estrategia_cierre']} onChange={() => {}} color="text-blue-400" />
                </div>
            </TabsContent>

            <TabsContent value="versiones" className="absolute inset-0 m-0 h-full">
               <Card className="bg-slate-900 border-slate-800 h-full flex flex-col overflow-hidden">
                  <CardHeader className="shrink-0 border-b border-slate-800 pb-3"><CardTitle className="text-white text-xs flex items-center gap-2 uppercase tracking-widest"><History className="w-5 h-5 text-indigo-400" /> Historial Maestro (Protegido)</CardTitle></CardHeader>
                  <ScrollArea className="flex-1">
                     <Table>
                        <TableHeader><TableRow className="border-slate-800 bg-slate-950/20"><TableHead className="pl-6 text-[10px]">Snapshot</TableHead><TableHead className="text-[10px]">Fecha</TableHead><TableHead className="text-right pr-6 text-[10px]">Acción</TableHead></TableRow></TableHeader>
                        <TableBody>
                           {versions.map(v => (
                              <TableRow key={v.id} className="border-slate-800">
                                 <TableCell className="font-mono text-slate-500 text-xs pl-6">{v.version_name}</TableCell>
                                 <TableCell className="text-slate-600 text-[10px]">{new Date(v.created_at).toLocaleString()}</TableCell>
                                 <TableCell className="text-right pr-6"><Button variant="ghost" disabled className="h-7 text-[9px] cursor-not-allowed text-slate-700">BLOQUEADO</Button></TableCell>
                              </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                  </ScrollArea>
               </Card>
            </TabsContent>

            <TabsContent value="vision" className="absolute inset-0 m-0 h-full">
                <PromptEditor title="Ojo de Halcón (Instrucciones OCR)" icon={EyeIcon} value={prompts['prompt_vision_instrucciones']} onChange={() => {}} color="text-red-400" />
            </TabsContent>

            <TabsContent value="simulador" className="absolute inset-0 m-0 flex flex-col h-full overflow-hidden">
                <Card className="bg-slate-950 border-slate-800 flex-1 flex flex-col overflow-hidden opacity-70">
                    <CardHeader className="border-b border-slate-800 bg-slate-900/50 py-3 flex items-center justify-between shrink-0 px-6">
                        <CardTitle className="text-white text-xs flex items-center gap-2 uppercase tracking-widest"><MessageSquare className="w-4 h-4 text-blue-400" /> Simulador Deshabilitado</CardTitle>
                    </CardHeader>
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 italic gap-4">
                       <Lock className="w-12 h-12 opacity-20" />
                       <p>La simulación no está disponible en este momento.</p>
                    </div>
                    <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0 flex gap-3">
                       <Input disabled placeholder="Entrada bloqueada..." className="bg-slate-950 border-slate-800 cursor-not-allowed" />
                       <Button disabled className="bg-slate-800 text-slate-600"><Send className="w-5 h-5" /></Button>
                    </div>
                </Card>
            </TabsContent>

            <TabsContent value="tuner" className="absolute inset-0 m-0 flex flex-col h-full overflow-hidden">
                <Card className="bg-slate-950 border-slate-800 flex-1 flex flex-col overflow-hidden opacity-70">
                    <CardHeader className="border-b border-slate-800 bg-slate-900/50 py-3 shrink-0 px-6">
                        <CardTitle className="text-white text-xs flex items-center gap-2 uppercase tracking-widest"><Sparkles className="w-5 h-5 text-purple-400" /> Laboratorio Bloqueado</CardTitle>
                    </CardHeader>
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-600 italic gap-4">
                       <Lock className="w-12 h-12 opacity-20" />
                       <p>El Laboratorio IA requiere permisos de edición.</p>
                    </div>
                    <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0 flex gap-3 items-end">
                       <Textarea disabled placeholder="Entrada bloqueada..." className="bg-slate-950 border-slate-800 cursor-not-allowed min-h-[50px]" />
                       <Button disabled className="h-12 w-14 bg-slate-800 text-slate-600"><Send className="w-5 h-5" /></Button>
                    </div>
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