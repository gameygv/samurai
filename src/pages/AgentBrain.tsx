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
  Play, Archive, RotateCcw, BarChart3, Check, Loader2, Copy, ArrowLeft,
  Terminal
} from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';
import { triggerMakeWebhook } from '@/utils/makeService';

// Fallbacks locales por si la BD está vacía
const DEFAULTS = {
  'prompt_core': `# 🏯 IDENTIDAD: EL SAMURÁI DEL EQUIPO\nEres el **"Samurái del Equipo"** (Versión LIVE Actual)...`,
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

const AgentBrain = () => {
  const [prompts, setPrompts] = useState<Record<string, string>>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // States Part 5 (Versionado & Test)
  const [historyVersions, setHistoryVersions] = useState<any[]>([]);
  const [activeVersionId, setActiveVersionId] = useState<string>("live");
  const [editorContent, setEditorContent] = useState("");
  
  // Test Runner
  const [testing, setTesting] = useState(false);
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState<string | null>(null);
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
    const { data } = await supabase
        .from('versiones_prompts_aprendidas')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (data && data.length > 0) {
        const mapped = data.map(v => ({
            id: v.version_id,
            version_numero: v.version_numero,
            created_at: v.created_at,
            status: 'Archive',
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
      await logActivity({ action: 'UPDATE', resource: 'BRAIN', description: 'Actualización masiva de prompts', status: 'OK' });
      toast.success('Cerebro actualizado y guardado.');
    } catch (error: any) {
      toast.error(`Error al guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectVersion = (version: any) => {
      setActiveVersionId(version.id);
      setEditorContent(version.content || "");
      toast.info(`Previsualizando versión: ${version.version_numero}`);
  };

  const handleRestore = async () => {
      if (activeVersionId === 'live') return;
      if (!confirm('¿CONFIRMAR RESTAURACIÓN?')) return;
      setSaving(true);
      try {
          const contentToRestore = editorContent;
          const { error } = await supabase.from('app_config').upsert({
              key: 'prompt_core',
              value: contentToRestore,
              category: 'PROMPT',
              updated_at: new Date().toISOString()
          });
          if (error) throw error;
          setPrompts(prev => ({ ...prev, 'prompt_core': contentToRestore }));
          await logActivity({ action: 'UPDATE', resource: 'BRAIN', description: `Restaurada versión ${activeVersionId}`, status: 'OK' });
          toast.success('Versión restaurada correctamente');
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
    setTestOutput(null);
    
    // Enviamos el webhook y esperamos respuesta
    const response = await triggerMakeWebhook('webhook_make_test', {
      input: testInput,
      version: activeVersionId, // Enviamos el ID de la versión
      system_prompt: editorContent, // Enviamos el contenido exacto que está en el editor (sea live o backup)
      context: contextToggles
    });

    if (response) {
      // Si Make responde con { "reply": "Hola..." } o { "text": "Hola..." }
      const reply = response.reply || response.text || response.message || JSON.stringify(response);
      setTestOutput(reply);
      toast.success('Respuesta recibida del Agente');
    } else {
        setTestOutput("Error: No se recibió respuesta de Make. Verifica el Webhook.");
    }
    setTesting(false);
  };

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Cerebro del Agente</h1>
            <p className="text-slate-400">Configuración maestra sincronizada con Base de Datos.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar Todo
          </Button>
        </div>

        <Tabs defaultValue="part1" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 overflow-x-auto w-full justify-start">
             <TabsTrigger value="part1"><Bot className="w-4 h-4 mr-2" /> Sistema</TabsTrigger>
             <TabsTrigger value="part2"><Sparkles className="w-4 h-4 mr-2" /> Contexto</TabsTrigger>
             <TabsTrigger value="part3"><AlertTriangle className="w-4 h-4 mr-2" /> Corrección</TabsTrigger>
             <TabsTrigger value="part4"><Eye className="w-4 h-4 mr-2" /> Visión</TabsTrigger>
             <TabsTrigger value="part5" className="data-[state=active]:bg-indigo-600"><FlaskConical className="w-4 h-4 mr-2" /> Laboratorio & Tests</TabsTrigger>
          </TabsList>

          {/* PARTS 1-4 (Standard) */}
          <TabsContent value="part1" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PromptCard title="1.1 ADN Core" icon={Bot} color="text-red-500" bg="bg-red-500/10" value={prompts['prompt_core']} onChange={(v: string) => handlePromptChange('prompt_core', v)} />
              <PromptCard title="1.2 Técnico" icon={Hammer} color="text-orange-500" bg="bg-orange-500/10" value={prompts['prompt_technical']} onChange={(v: string) => handlePromptChange('prompt_technical', v)} />
              <PromptCard title="1.3 Protocolos" icon={ScrollText} color="text-blue-500" bg="bg-blue-500/10" value={prompts['prompt_behavior']} onChange={(v: string) => handlePromptChange('prompt_behavior', v)} />
              <PromptCard title="1.4 Objeciones" icon={ShieldAlert} color="text-yellow-500" bg="bg-yellow-500/10" value={prompts['prompt_objections']} onChange={(v: string) => handlePromptChange('prompt_objections', v)} />
            </div>
          </TabsContent>

          <TabsContent value="part2" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PromptCard title="2.1 Datos" icon={Database} color="text-cyan-500" bg="bg-cyan-500/10" value={prompts['prompt_data_injection']} onChange={(v: string) => handlePromptChange('prompt_data_injection', v)} />
              <PromptCard title="2.2 Memoria" icon={History} color="text-teal-500" bg="bg-teal-500/10" value={prompts['prompt_memory']} onChange={(v: string) => handlePromptChange('prompt_memory', v)} />
              <PromptCard title="2.3 Tono" icon={MessageSquare} color="text-indigo-500" bg="bg-indigo-500/10" value={prompts['prompt_tone']} onChange={(v: string) => handlePromptChange('prompt_tone', v)} />
              <PromptCard title="2.4 Recomendaciones" icon={Gift} color="text-amber-500" bg="bg-amber-500/10" value={prompts['prompt_recommendations']} onChange={(v: string) => handlePromptChange('prompt_recommendations', v)} />
            </div>
          </TabsContent>

          <TabsContent value="part3" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PromptCard title="3.1 Trigger" icon={AlertTriangle} color="text-pink-500" bg="bg-pink-500/10" value={prompts['prompt_learning_trigger']} onChange={(v: string) => handlePromptChange('prompt_learning_trigger', v)} />
              <PromptCard title="3.2 Storage" icon={Server} color="text-purple-500" bg="bg-purple-500/10" value={prompts['prompt_error_storage']} onChange={(v: string) => handlePromptChange('prompt_error_storage', v)} />
              <PromptCard title="3.3 Relearning" icon={RefreshCw} color="text-green-500" bg="bg-green-500/10" value={prompts['prompt_relearning']} onChange={(v: string) => handlePromptChange('prompt_relearning', v)} />
              <PromptCard title="3.4 Validación" icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" value={prompts['prompt_validation_improvement']} onChange={(v: string) => handlePromptChange('prompt_validation_improvement', v)} />
            </div>
          </TabsContent>

          <TabsContent value="part4" className="mt-6 space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                 <PromptCard title="4.1 Visión (Comprobantes)" icon={ScanEye} color="text-sky-500" bg="bg-sky-500/10" value={prompts['prompt_vision_analysis']} onChange={(v: string) => handlePromptChange('prompt_vision_analysis', v)} height="h-[200px]" />
              </div>
              <PromptCard title="4.2 Validación Match" icon={CheckCheck} color="text-lime-500" bg="bg-lime-500/10" value={prompts['prompt_match_validation']} onChange={(v: string) => handlePromptChange('prompt_match_validation', v)} />
              <PromptCard title="4.3 Acción Post" icon={Zap} color="text-yellow-500" bg="bg-yellow-500/10" value={prompts['prompt_post_validation']} onChange={(v: string) => handlePromptChange('prompt_post_validation', v)} />
            </div>
          </TabsContent>

          {/* PART 5: LABORATORY (Updated) */}
          <TabsContent value="part5" className="mt-6 space-y-6">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[800px]">
                
                {/* LEFT: VERSION HISTORY */}
                <Card className="lg:col-span-2 bg-slate-900 border-slate-800 flex flex-col overflow-hidden">
                   <CardHeader className="py-4">
                      <CardTitle className="text-sm font-medium text-slate-400">Versiones</CardTitle>
                   </CardHeader>
                   <CardContent className="p-0 flex-1 overflow-y-auto">
                      <div 
                         className={`p-3 border-b border-slate-800 cursor-pointer hover:bg-slate-800 ${activeVersionId === 'live' ? 'bg-indigo-900/20 border-l-2 border-l-indigo-500' : ''}`}
                         onClick={() => { setActiveVersionId('live'); setEditorContent(prompts['prompt_core'] || ''); }}
                      >
                         <div className="font-bold text-white text-sm">LIVE</div>
                         <div className="text-[10px] text-green-400">● En Producción</div>
                      </div>
                      {historyVersions.map((v) => (
                         <div 
                            key={v.id} 
                            className={`p-3 border-b border-slate-800 cursor-pointer hover:bg-slate-800 ${activeVersionId === v.id ? 'bg-indigo-900/20 border-l-2 border-l-indigo-500' : ''}`}
                            onClick={() => handleSelectVersion(v)}
                         >
                            <div className="font-mono text-slate-300 text-xs">{v.version_numero}</div>
                            <div className="text-[10px] text-slate-500">{new Date(v.created_at).toLocaleDateString()}</div>
                         </div>
                      ))}
                   </CardContent>
                </Card>

                {/* CENTER: EDITOR */}
                <Card className="lg:col-span-6 bg-slate-900 border-slate-800 flex flex-col">
                   <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                      <div>
                         <h3 className="text-white font-bold flex items-center gap-2">
                            {activeVersionId === 'live' ? 'EDITOR LIVE (Prompt Core)' : `VISOR HISTÓRICO: ${historyVersions.find(v => v.id === activeVersionId)?.version_numero}`}
                            {activeVersionId === 'live' && <Badge className="bg-green-600 h-5">Live</Badge>}
                         </h3>
                      </div>
                      {activeVersionId !== 'live' && (
                         <Button size="sm" onClick={handleRestore} disabled={saving} className="bg-indigo-600 h-7 text-xs">
                            <RotateCcw className="w-3 h-3 mr-1" /> Restaurar
                         </Button>
                      )}
                   </div>
                   <div className="flex-1 relative">
                      <Textarea 
                         className="absolute inset-0 w-full h-full bg-slate-950/50 border-0 text-slate-300 font-mono text-sm p-4 resize-none focus-visible:ring-0"
                         value={editorContent}
                         onChange={(e) => {
                            setEditorContent(e.target.value);
                            if (activeVersionId === 'live') handlePromptChange('prompt_core', e.target.value);
                         }}
                         readOnly={activeVersionId !== 'live'}
                      />
                   </div>
                </Card>

                {/* RIGHT: TEST RUNNER */}
                <Card className="lg:col-span-4 bg-black border-l border-slate-800 flex flex-col shadow-2xl">
                   <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                      <h3 className="text-white font-bold flex items-center gap-2">
                         <Terminal className="w-4 h-4 text-green-500" />
                         Test Runner
                      </h3>
                      <p className="text-xs text-slate-500">Prueba el prompt seleccionado sin usar WhatsApp.</p>
                   </div>
                   
                   <div className="flex-1 p-4 overflow-y-auto space-y-4">
                      {/* Output Area */}
                      {testOutput ? (
                         <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                            <div className="flex items-center gap-2 mb-2 text-xs text-indigo-400 font-bold uppercase">
                               <Bot className="w-3 h-3" /> Samurai Response
                            </div>
                            <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{testOutput}</p>
                         </div>
                      ) : (
                         <div className="h-40 flex items-center justify-center text-slate-600 text-sm italic border border-dashed border-slate-800 rounded">
                            El resultado aparecerá aquí...
                         </div>
                      )}
                   </div>

                   <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
                      <div className="space-y-1">
                         <Label className="text-xs text-slate-400">Mensaje de Usuario (Input)</Label>
                         <Input 
                            value={testInput}
                            onChange={e => setTestInput(e.target.value)}
                            className="bg-slate-950 border-slate-700 text-white"
                            placeholder="Ej: Hola, ¿qué precio tiene?"
                         />
                      </div>
                      
                      <div className="flex items-center gap-4 py-2">
                         <div className="flex items-center gap-2">
                            <Switch checked={contextToggles.geoffrey} onCheckedChange={v => setContextToggles(prev => ({...prev, geoffrey: v}))} id="geo" />
                            <Label htmlFor="geo" className="text-xs text-slate-400">Geoffrey</Label>
                         </div>
                         <div className="flex items-center gap-2">
                            <Switch checked={contextToggles.emotional} onCheckedChange={v => setContextToggles(prev => ({...prev, emotional: v}))} id="emo" />
                            <Label htmlFor="emo" className="text-xs text-slate-400">Emocional</Label>
                         </div>
                      </div>

                      <Button 
                         onClick={handleRunTest} 
                         disabled={testing} 
                         className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
                      >
                         {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                         Ejecutar Test
                      </Button>
                   </div>
                </Card>

             </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

// Helper (sin cambios)
const PromptCard = ({ title, icon: Icon, color, bg, value, onChange, height = "min-h-[300px]" }: any) => (
  <Card className="bg-slate-900 border-slate-800 shadow-xl group h-full flex flex-col">
    <CardHeader className="border-b border-slate-800 pb-3">
      <CardTitle className="text-white flex items-center gap-2 text-sm">
        <div className={`w-7 h-7 rounded ${bg} flex items-center justify-center ${color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-3 flex-1">
      <Textarea 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${height} w-full h-full bg-slate-950/50 border-slate-800 font-mono text-xs text-slate-300 focus:border-opacity-50 resize-none p-3 custom-scrollbar`}
      />
    </CardContent>
  </Card>
);

export default AgentBrain;