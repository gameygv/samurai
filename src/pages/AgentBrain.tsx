import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Save, Bot, Sparkles, AlertTriangle, Eye, Hammer, ScrollText, 
  ShieldAlert, Database, History, MessageSquare, Gift, RefreshCw, Server, 
  CheckCircle2, ScanEye, CheckCheck, ListTodo, Zap, GitBranch, FlaskConical, 
  Play, Archive, RotateCcw, BarChart3, Check, Loader2, Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';
import { triggerMakeWebhook } from '@/utils/makeService';

// Fallbacks locales por si la BD está vacía
const DEFAULTS = {
  'prompt_core': `# 🏯 IDENTIDAD: EL SAMURÁI DEL EQUIPO\nEres el **"Samurái del Equipo"**...`,
  'prompt_technical': `### FÓRMULA UNIVERSAL\n1. Saludo...`,
  'prompt_behavior': `### PROTOCOLOS\n- Sabiduría Calma...`,
  'prompt_objections': `### MATRIZ DE OBJECIONES...`,
  'prompt_data_injection': `# 2.1 INYECCIÓN DE DATOS...`,
  'prompt_memory': `# 2.2 MEMORIA HISTÓRICA...`,
  'prompt_tone': `# 2.3 TONO ADAPTATIVO...`,
  'prompt_recommendations': `# 2.4 RECOMENDACIONES...`,
  'prompt_learning_trigger': `### 3.1 TRIGGER DE APRENDIZAJE...`,
  'prompt_error_storage': `### CUANDO SE ACTIVA #CORREGIRIA...`,
  'prompt_relearning': `### CÓMO LA IA INCORPORA LA CORRECCIÓN...`,
  'prompt_validation_improvement': `### TRACKING DE IMPACTO...`,
  'prompt_vision_analysis': `# OJO DE HALCÓN...`,
  'prompt_match_validation': `# DESPUÉS QUE OJO DE HALCÓN...`,
  'prompt_post_validation': `### 4.3 ACCIÓN POST-VALIDACIÓN...`
};

// Datos simulados para versiones si no hay en DB
const DEMO_VERSIONS = [
  { id: "v2.0", version_numero: "v2.0", created_at: new Date().toISOString(), status: "Active", performance: "58%", user: "Gamey", content: DEFAULTS['prompt_core'] },
  { id: "v1.1", version_numero: "v1.1", created_at: new Date(Date.now() - 86400000).toISOString(), status: "Archive", performance: "42%", user: "Gamey", content: "# 🏯 IDENTIDAD: EL SAMURÁI (v1.1 Legacy)\nEsta es una versión anterior..." },
  { id: "v1.0", version_numero: "v1.0", created_at: new Date(Date.now() - 172800000).toISOString(), status: "Draft", performance: "-", user: "System", content: "# 🏯 IDENTIDAD: EL SAMURÁI (v1.0 Alpha)\nVersión inicial..." },
];

const AgentBrain = () => {
  const [prompts, setPrompts] = useState<Record<string, string>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // States Part 5 (Versionado)
  const [historyVersions, setHistoryVersions] = useState<any[]>(DEMO_VERSIONS);
  const [activeVersionId, setActiveVersionId] = useState<string>("live");
  const [editorContent, setEditorContent] = useState("");
  
  // Test Runner
  const [testInput, setTestInput] = useState("");
  const [contextToggles, setContextToggles] = useState({
    history: true,
    emotional: true,
    geoffrey: true,
    corrections: false
  });

  useEffect(() => {
    fetchPrompts();
    fetchHistory();
  }, []);

  // Sincronizar editor con prompt actual cuando carga
  useEffect(() => {
    if (activeVersionId === 'live') {
        setEditorContent(prompts['prompt_core'] || '');
    }
  }, [prompts, activeVersionId]);

  const fetchPrompts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')
      .eq('category', 'PROMPT');

    if (!error && data && data.length > 0) {
      const dbPrompts: Record<string, string> = {};
      data.forEach((item: any) => {
        dbPrompts[item.key] = item.value;
      });
      setPrompts(prev => ({ ...prev, ...dbPrompts }));
    }
    setLoading(false);
  };

  const fetchHistory = async () => {
    // Intentar buscar versiones reales
    const { data } = await supabase
        .from('versiones_prompts_aprendidas')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (data && data.length > 0) {
        // Mapear a formato UI
        const mapped = data.map(v => ({
            id: v.version_id,
            version_numero: v.version_numero,
            created_at: v.created_at,
            status: 'Archive', // Asumimos archivo por defecto
            performance: v.test_accuracy_nuevo ? `${v.test_accuracy_nuevo}%` : '-',
            user: 'System',
            content: v.contenido_nuevo
        }));
        setHistoryVersions(mapped);
    }
  };

  const handlePromptChange = (key: string, value: string) => {
    setPrompts(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(prompts).map(([key, value]) => ({
        key,
        value,
        category: 'PROMPT',
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase.from('app_config').upsert(updates);

      if (error) throw error;

      await logActivity({
        action: 'UPDATE',
        resource: 'BRAIN',
        description: 'Actualización masiva de prompts del cerebro',
        status: 'OK'
      });

      toast.success('Cerebro actualizado y guardado en base de datos.');
    } catch (error: any) {
      toast.error(`Error al guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectVersion = (version: any) => {
      setActiveVersionId(version.id);
      setEditorContent(version.content || "");
      toast.info(`Visualizando versión ${version.version_numero}`);
  };

  const handleRestore = async () => {
      if (activeVersionId === 'live') return;

      if (!confirm('¿Estás seguro de restaurar esta versión? Sobrescribirá el prompt actual.')) return;

      setSaving(true);
      try {
          // 1. Update DB
          const { error } = await supabase.from('app_config').upsert({
              key: 'prompt_core',
              value: editorContent,
              category: 'PROMPT',
              updated_at: new Date().toISOString()
          });

          if (error) throw error;

          // 2. Update Local State
          handlePromptChange('prompt_core', editorContent);
          
          await logActivity({
              action: 'UPDATE',
              resource: 'BRAIN',
              description: `Restaurada versión histórica ID: ${activeVersionId}`,
              status: 'OK'
          });

          toast.success('Versión restaurada correctamente. Ahora es la versión LIVE.');
          setActiveVersionId('live');

      } catch (err: any) {
          toast.error(err.message);
      } finally {
          setSaving(false);
      }
  };

  const handleRunTest = async () => {
    if (!testInput) return toast.warning('Escribe un input para probar');
    setTesting(true);
    
    const success = await triggerMakeWebhook('webhook_make_test', {
      input: testInput,
      version: activeVersionId,
      context: contextToggles,
      current_core_prompt: editorContent // Enviamos lo que se ve en el editor
    });

    if (success) {
      toast.success('Test enviado a Make.com.');
    }
    setTesting(false);
  };

  if (loading) {
    return (
       <Layout>
          <div className="flex h-[80vh] items-center justify-center">
             <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
       </Layout>
    );
 }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Cerebro del Agente</h1>
            <p className="text-slate-400">Configuración maestra sincronizada con Base de Datos.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar Todo
          </Button>
        </div>

        <Tabs defaultValue="part1" className="w-full">
          <div className="overflow-x-auto pb-2">
            <TabsList className="bg-slate-900 border border-slate-800 p-1 inline-flex min-w-full md:min-w-0">
              <TabsTrigger value="part1" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white whitespace-nowrap">
                <Bot className="w-4 h-4 mr-2" /> Parte 1: Sistema
              </TabsTrigger>
              <TabsTrigger value="part2" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white whitespace-nowrap">
                <Sparkles className="w-4 h-4 mr-2" /> Parte 2: Contexto
              </TabsTrigger>
              <TabsTrigger value="part3" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white whitespace-nowrap">
                <AlertTriangle className="w-4 h-4 mr-2" /> Parte 3: Corrección
              </TabsTrigger>
              <TabsTrigger value="part4" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white whitespace-nowrap">
                <Eye className="w-4 h-4 mr-2" /> Parte 4: Visión
              </TabsTrigger>
              <TabsTrigger value="part5" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white whitespace-nowrap">
                <GitBranch className="w-4 h-4 mr-2" /> Parte 5: Versionado
              </TabsTrigger>
            </TabsList>
          </div>

          {/* PARTE 1: SISTEMA PRINCIPAL */}
          <TabsContent value="part1" className="mt-6 space-y-6 animate-in fade-in-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PromptCard title="1.1 ADN Core del Samurai" icon={Bot} color="text-red-500" bg="bg-red-500/10" value={prompts['prompt_core']} onChange={(v: string) => handlePromptChange('prompt_core', v)} />
              <PromptCard title="1.2 Instrucciones Técnicas" icon={Hammer} color="text-orange-500" bg="bg-orange-500/10" value={prompts['prompt_technical']} onChange={(v: string) => handlePromptChange('prompt_technical', v)} />
              <PromptCard title="1.3 Protocolos de Comportamiento" icon={ScrollText} color="text-blue-500" bg="bg-blue-500/10" value={prompts['prompt_behavior']} onChange={(v: string) => handlePromptChange('prompt_behavior', v)} />
              <PromptCard title="1.4 Manejo de Objeciones" icon={ShieldAlert} color="text-yellow-500" bg="bg-yellow-500/10" value={prompts['prompt_objections']} onChange={(v: string) => handlePromptChange('prompt_objections', v)} />
            </div>
          </TabsContent>

          {/* PARTE 2: CONTEXTO DINÁMICO */}
          <TabsContent value="part2" className="mt-6 space-y-6 animate-in fade-in-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PromptCard title="2.1 Inyección de Datos" icon={Database} color="text-cyan-500" bg="bg-cyan-500/10" value={prompts['prompt_data_injection']} onChange={(v: string) => handlePromptChange('prompt_data_injection', v)} />
              <PromptCard title="2.2 Memoria Histórica" icon={History} color="text-teal-500" bg="bg-teal-500/10" value={prompts['prompt_memory']} onChange={(v: string) => handlePromptChange('prompt_memory', v)} />
              <PromptCard title="2.3 Tono Adaptativo" icon={MessageSquare} color="text-indigo-500" bg="bg-indigo-500/10" value={prompts['prompt_tone']} onChange={(v: string) => handlePromptChange('prompt_tone', v)} />
              <PromptCard title="2.4 Recomendaciones" icon={Gift} color="text-amber-500" bg="bg-amber-500/10" value={prompts['prompt_recommendations']} onChange={(v: string) => handlePromptChange('prompt_recommendations', v)} />
            </div>
          </TabsContent>

          {/* PARTE 3: CORRECCIÓN (#CORREGIRIA) */}
          <TabsContent value="part3" className="mt-6 space-y-6 animate-in fade-in-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PromptCard title="3.1 Trigger de Aprendizaje" icon={AlertTriangle} color="text-pink-500" bg="bg-pink-500/10" value={prompts['prompt_learning_trigger']} onChange={(v: string) => handlePromptChange('prompt_learning_trigger', v)} />
              <PromptCard title="3.2 Almacenamiento de Error" icon={Server} color="text-purple-500" bg="bg-purple-500/10" value={prompts['prompt_error_storage']} onChange={(v: string) => handlePromptChange('prompt_error_storage', v)} />
              <PromptCard title="3.3 Reaprendizaje Automático" icon={RefreshCw} color="text-green-500" bg="bg-green-500/10" value={prompts['prompt_relearning']} onChange={(v: string) => handlePromptChange('prompt_relearning', v)} />
              <PromptCard title="3.4 Validación de Mejora" icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" value={prompts['prompt_validation_improvement']} onChange={(v: string) => handlePromptChange('prompt_validation_improvement', v)} />
            </div>
          </TabsContent>

          {/* PARTE 4: VISIÓN (OJO DE HALCÓN) */}
          <TabsContent value="part4" className="mt-6 space-y-6 animate-in fade-in-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                 <PromptCard title="4.1 Análisis de Comprobantes" icon={ScanEye} color="text-sky-500" bg="bg-sky-500/10" value={prompts['prompt_vision_analysis']} onChange={(v: string) => handlePromptChange('prompt_vision_analysis', v)} height="h-[200px]" />
              </div>
              <PromptCard title="4.2 Validación de Match (Lógica)" icon={CheckCheck} color="text-lime-500" bg="bg-lime-500/10" value={prompts['prompt_match_validation']} onChange={(v: string) => handlePromptChange('prompt_match_validation', v)} />
              <PromptCard title="4.3 Acción Post-Validación" icon={Zap} color="text-yellow-500" bg="bg-yellow-500/10" value={prompts['prompt_post_validation']} onChange={(v: string) => handlePromptChange('prompt_post_validation', v)} />
            </div>
          </TabsContent>

           {/* PARTE 5: VERSIONADO Y CONTROL */}
           <TabsContent value="part5" className="mt-6 space-y-6 animate-in fade-in-50">
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* COLUMNA IZQUIERDA: HISTORIAL */}
              <div className="lg:col-span-1 space-y-6">
                <Card className="bg-slate-900 border-slate-800 h-full">
                  <CardHeader>
                     <CardTitle className="text-white flex items-center gap-2 text-base">
                        <History className="w-4 h-4 text-slate-400" />
                        Historial de Versiones
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-800 hover:bg-slate-900/50">
                          <TableHead className="text-slate-400 h-9">Versión</TableHead>
                          <TableHead className="text-slate-400 h-9">Status</TableHead>
                          <TableHead className="text-slate-400 h-9 text-right">Perf</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                         <TableRow 
                            className={`border-slate-800 hover:bg-slate-800/50 cursor-pointer ${activeVersionId === 'live' ? 'bg-indigo-500/10' : ''}`}
                            onClick={() => {
                                setActiveVersionId('live');
                                setEditorContent(prompts['prompt_core'] || '');
                            }}
                         >
                            <TableCell className="font-mono font-medium text-white">LIVE</TableCell>
                            <TableCell><Badge className="bg-green-500/20 text-green-400">Actual</Badge></TableCell>
                            <TableCell className="text-right text-xs text-slate-400">-</TableCell>
                         </TableRow>
                        {historyVersions.map((v) => (
                          <TableRow 
                            key={v.id} 
                            className={`border-slate-800 hover:bg-slate-800/50 cursor-pointer ${activeVersionId === v.id ? 'bg-indigo-500/10' : ''}`}
                            onClick={() => handleSelectVersion(v)}
                          >
                            <TableCell className="font-mono font-medium text-slate-300">
                              <div className="flex flex-col">
                                <span>{v.version_numero}</span>
                                <span className="text-[10px] text-slate-500">{new Date(v.created_at).toLocaleDateString()}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="bg-slate-800 text-slate-500">Archive</Badge>
                            </TableCell>
                            <TableCell className="text-right text-slate-400 font-mono text-xs">{v.performance}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                  <CardFooter className="border-t border-slate-800 pt-4 flex gap-2">
                    <Button variant="outline" size="sm" className="w-full border-slate-700 hover:bg-slate-800 text-slate-300">
                      <BarChart3 className="w-3 h-3 mr-2" /> Comparar
                    </Button>
                  </CardFooter>
                </Card>

                {/* TEST RUNNER CARD */}
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white flex items-center gap-2 text-base">
                      <FlaskConical className="w-4 h-4 text-purple-400" />
                      Test Runner (Make)
                    </CardTitle>
                    <CardDescription>
                        Prueba con versión: <span className="text-indigo-400 font-mono">{activeVersionId === 'live' ? 'LIVE' : activeVersionId}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-400">Input Cliente (Simulado)</Label>
                      <Input 
                        className="bg-slate-950 border-slate-800 text-slate-200" 
                        placeholder="Ej: Es muy caro..." 
                        value={testInput}
                        onChange={(e) => setTestInput(e.target.value)}
                      />
                    </div>
                    
                    <div className="p-3 bg-black/40 rounded border border-slate-800 min-h-[100px]">
                      <span className="text-xs font-mono text-purple-400 block mb-2">// Output Preview</span>
                      <p className="text-sm text-slate-400 italic">
                        {testing ? "Ejecutando webhook en Make..." : "Esperando ejecución..."}
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter>
                     <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={handleRunTest} disabled={testing}>
                        {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                        Ejecutar Test
                     </Button>
                  </CardFooter>
                </Card>
              </div>

              {/* COLUMNA DERECHA: EDITOR */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* HEADER EDITOR */}
                <div className="flex items-center justify-between bg-slate-900 p-4 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                      <GitBranch className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium flex items-center gap-2">
                        Visualizando: <span className="text-indigo-400 font-mono">{activeVersionId === 'live' ? 'VERSION ACTUAL (LIVE)' : `VERSION HISTÓRICA`}</span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        {activeVersionId === 'live' 
                           ? "Cualquier cambio aquí se guardará directamente en producción al dar 'Guardar Todo'." 
                           : "Estás viendo una versión antigua. Puedes restaurarla para que sea la Live."}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                     <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-slate-400 hover:text-white"
                        onClick={() => {
                            if(activeVersionId !== 'live') {
                                navigator.clipboard.writeText(editorContent);
                                toast.success('Contenido copiado');
                            }
                        }}
                     >
                        <Copy className="w-4 h-4" />
                     </Button>
                     
                     {activeVersionId !== 'live' && (
                        <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={handleRestore}
                            disabled={saving}
                        >
                            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                            Restaurar esta Versión
                        </Button>
                     )}
                     
                     {activeVersionId === 'live' && (
                         <Badge variant="outline" className="border-green-500 text-green-500">
                             EDICIÓN ACTIVA
                         </Badge>
                     )}
                  </div>
                </div>

                {/* SECCIÓN 1: EDITOR */}
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="pb-2">
                     <CardTitle className="text-sm text-slate-400 uppercase tracking-wider font-semibold">
                        {activeVersionId === 'live' ? 'Contenido ADN Core (Editable)' : 'Contenido Archivado (Solo Lectura)'}
                     </CardTitle>
                  </CardHeader>
                  <CardContent>
                     <Textarea 
                        className={`bg-slate-950 border-slate-800 text-slate-300 font-mono text-sm min-h-[500px] ${activeVersionId !== 'live' ? 'opacity-80' : ''}`}
                        value={editorContent}
                        onChange={(e) => {
                            setEditorContent(e.target.value);
                            // Si estamos en live, actualizamos el state global también para que el botón Guardar Todo funcione
                            if (activeVersionId === 'live') {
                                handlePromptChange('prompt_core', e.target.value);
                            }
                        }}
                        readOnly={activeVersionId !== 'live'}
                     />
                  </CardContent>
                </Card>

              </div>

            </div>
          </TabsContent>

        </Tabs>
      </div>
    </Layout>
  );
};

// Componente Helper para tarjetas de prompt
const PromptCard = ({ title, icon: Icon, color, bg, value, onChange, height = "min-h-[300px]" }: any) => (
  <Card className="bg-slate-900 border-slate-800 shadow-xl hover:border-slate-700 transition-all duration-300 group">
    <CardHeader className="border-b border-slate-800 pb-4">
      <CardTitle className="text-white flex items-center gap-2 text-base">
        <div className={`w-8 h-8 rounded ${bg} flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
          <Icon className="w-4 h-4" />
        </div>
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-4">
      <Textarea 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${height} bg-slate-950/50 border-slate-800 font-mono text-xs md:text-sm text-slate-300 focus:border-opacity-50 focus:ring-opacity-20 resize-none p-4 leading-relaxed custom-scrollbar`}
      />
    </CardContent>
  </Card>
);

export default AgentBrain;