import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Webhook, Key, Save, Loader2, ShoppingCart, Target, Building2, Store, Hash, Send, Clock, Play, DollarSign, MessageSquarePlus, Trash2, Plus, Sparkles, TerminalSquare, Download, Upload, ShieldAlert, AlertTriangle, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { sendEvolutionMessage } from '@/utils/messagingService';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const Settings = () => {
  const { isAdmin, isDev } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'mensajeria';
  
  const [configs, setConfigs] = useState<any[]>([]);
  const [quickReplies, setQuickReplies] = useState<{id: string, title: string, text: string}[]>([]);
  const [globalTags, setGlobalTags] = useState<{id: string, text: string, color: string}[]>([]);
  const [wcProducts, setWcProducts] = useState<any[]>([]);
  
  const [followupConfig, setFollowupConfig] = useState<any>({
      enabled: false, stage_1_delay: 15, stage_2_delay: 60, stage_3_delay: 1440,
      start_hour: 9, end_hour: 20, stage_1_message: '', stage_2_message: '', stage_3_message: ''
  });

  const [salesConfig, setSalesConfig] = useState({
      enabled: false, stage_1_delay: 60, stage_2_delay: 1440, stage_3_delay: 2880,
      stage_1_message: '', stage_2_message: '', stage_3_message: ''
  });

  const [kernelConfig, setKernelConfig] = useState({
      prompt_catalog_rules: '', prompt_media_rules: '', prompt_behavior_rules: '',
      prompt_human_handoff: '', prompt_bank_rules: '', prompt_ai_suggestions: '', prompt_qa_auditor: ''
  });

  const [globalBotPaused, setGlobalBotPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);
  const [wipingSystem, setWipingSystem] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    const { data } = await supabase.from('app_config').select('*');
    if (data) {
        setConfigs(data);
        const getC = (k: string, def: string) => data.find(c => c.key === k)?.value || def;
        
        setGlobalBotPaused(getC('global_bot_paused', 'false') === 'true');

        setSalesConfig({
            enabled: getC('sales_followup_enabled', 'false') === 'true',
            stage_1_delay: parseInt(getC('sales_stage_1_delay', '60')),
            stage_2_delay: parseInt(getC('sales_stage_2_delay', '1440')),
            stage_3_delay: parseInt(getC('sales_stage_3_delay', '2880')),
            stage_1_message: getC('sales_stage_1_message', '¿Tuviste algún problema con el enlace de pago o la transferencia?'),
            stage_2_message: getC('sales_stage_2_message', 'Tu lugar sigue pre-reservado, pero necesitamos confirmar el pago para asegurarlo.'),
            stage_3_message: getC('sales_stage_3_message', 'Liberaremos tu lugar en unas horas si no recibimos el comprobante. ¿Te ayudo con algo?')
        });

        setKernelConfig({
            prompt_catalog_rules: getC('prompt_catalog_rules', 'Usa el siguiente catálogo de productos para ofrecer enlaces de pago. Envía el enlace correspondiente según el interés del cliente, y hazlo de forma natural.'),
            prompt_media_rules: getC('prompt_media_rules', 'Cuando sea pertinente o el cliente pregunte por información visual, adjunta el recurso correspondiente usando la etiqueta <<MEDIA:URL>>. No repitas imágenes.'),
            prompt_behavior_rules: getC('prompt_behavior_rules', '1. No repitas información que ya diste.\n2. Mantén un tono humano y conversacional.\n3. Lee el historial para no preguntar cosas que ya sabes.'),
            prompt_human_handoff: getC('prompt_human_handoff', 'Si el cliente pide hablar con un humano o hace preguntas fuera de tu conocimiento, responde que un asesor lo atenderá y pausa tu operación con:\n---\n{"request_human": true}'),
            prompt_bank_rules: getC('prompt_bank_rules', 'Presenta estos datos bancarios como alternativa de pago directo, solo cuando el cliente lo solicite:'),
            prompt_ai_suggestions: getC('prompt_ai_suggestions', 'Eres el Co-piloto de la IA. Genera 3 opciones de respuesta CORTAS (max 30 palabras) para que el humano las use. NUNCA uses la etiqueta <<MEDIA:URL>>.\nRESPONDE SOLO EN JSON:\n{\n  "suggestions": [\n    {"type": "EMPATIA", "text": "..."},\n    {"type": "VENTA", "text": "..."},\n    {"type": "TECNICA", "text": "..."}\n  ]\n}'),
            prompt_qa_auditor: getC('prompt_qa_auditor', 'Eres el Auditor de Calidad (QA). Evalúa este mensaje enviado por un VENDEDOR HUMANO a un cliente.\nReglas:\n1. SCORE (0-100): Evalúa ortografía y persuasión.\n2. TONE_ANALYSIS: Describe en 5 palabras el tono.\n3. ANOMALY_DETECTED (CRÍTICO): PON TRUE SI da cuenta bancaria o precios falsos, o es grosero. Si no, false.\n4. ANOMALY_DETAILS: Explica la anomalía si existe, si no, null.\nResponde ÚNICAMENTE con JSON: {"score": 85, "tone_analysis": "Amable", "anomaly_detected": false, "anomaly_details": null}')
        });
        
        try { setQuickReplies(JSON.parse(getC('quick_replies', '[]'))); } catch(e) { setQuickReplies([]); }
        try { setGlobalTags(JSON.parse(getC('global_tags', '[]'))); } catch(e) { setGlobalTags([]); }

        const productsStr = getC('wc_products', '');
        if (productsStr) {
           try { setWcProducts(JSON.parse(productsStr)); } catch(e) { setWcProducts([]); }
        }
    }

    const { data: fcData } = await supabase.from('followup_config').select('*').limit(1).maybeSingle();
    if (fcData) setFollowupConfig(fcData);
    
    setLoading(false);
  };

  const handleInputChange = (key: string, value: string, category: string) => {
    setConfigs(prev => {
      const exists = prev.find(c => c.key === key);
      if (exists) return prev.map(c => c.key === key ? { ...c, value } : c);
      return [...prev, { key, value, category }];
    });
  };
  
  const handleKernelChange = (key: string, value: string) => {
      setKernelConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleAddProduct = () => setWcProducts([...wcProducts, { id: Date.now().toString(), wc_id: '', title: '', price: '', prompt: '' }]);
  const handleUpdateProduct = (id: string, field: string, value: string) => setWcProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));

  const handleAddQuickReply = () => setQuickReplies([...quickReplies, { id: Date.now().toString(), title: '', text: '' }]);
  const handleUpdateQuickReply = (id: string, field: string, value: string) => setQuickReplies(prev => prev.map(qr => qr.id === id ? { ...qr, [field]: value } : qr));

  const handleAddTag = () => setGlobalTags([...globalTags, { id: Date.now().toString(), text: '', color: '#8b5cf6' }]);
  const handleUpdateTag = (id: string, field: string, value: string) => setGlobalTags(prev => prev.map(tag => tag.id === id ? { ...tag, [field]: value } : tag));

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const excludedKeys = [
          'global_bot_paused', 'global_tags',
          'sales_followup_enabled', 'sales_stage_1_delay', 'sales_stage_2_delay', 'sales_stage_3_delay', 
          'sales_stage_1_message', 'sales_stage_2_message', 'sales_stage_3_message', 
          'quick_replies', 'wc_products',
          'prompt_catalog_rules', 'prompt_media_rules', 'prompt_behavior_rules', 'prompt_human_handoff', 'prompt_bank_rules', 'prompt_ai_suggestions', 'prompt_qa_auditor'
      ];
      
      const cleanConfigs = configs
          .filter(c => !excludedKeys.includes(c.key))
          .map(c => ({ key: c.key, value: c.value, category: c.category || 'SYSTEM' }));

      const newConfigs = [
        ...cleanConfigs,
        { key: 'global_bot_paused', value: String(globalBotPaused), category: 'SYSTEM' },
        { key: 'sales_followup_enabled', value: String(salesConfig.enabled), category: 'FOLLOWUP' },
        { key: 'sales_stage_1_delay', value: String(salesConfig.stage_1_delay), category: 'FOLLOWUP' },
        { key: 'sales_stage_2_delay', value: String(salesConfig.stage_2_delay), category: 'FOLLOWUP' },
        { key: 'sales_stage_3_delay', value: String(salesConfig.stage_3_delay), category: 'FOLLOWUP' },
        { key: 'sales_stage_1_message', value: salesConfig.stage_1_message, category: 'FOLLOWUP' },
        { key: 'sales_stage_2_message', value: salesConfig.stage_2_message, category: 'FOLLOWUP' },
        { key: 'sales_stage_3_message', value: salesConfig.stage_3_message, category: 'FOLLOWUP' },
        { key: 'quick_replies', value: JSON.stringify(quickReplies), category: 'SYSTEM' },
        { key: 'global_tags', value: JSON.stringify(globalTags), category: 'SYSTEM' },
        { key: 'wc_products', value: JSON.stringify(wcProducts), category: 'WOOCOMMERCE' },
        
        { key: 'prompt_catalog_rules', value: kernelConfig.prompt_catalog_rules, category: 'KERNEL' },
        { key: 'prompt_media_rules', value: kernelConfig.prompt_media_rules, category: 'KERNEL' },
        { key: 'prompt_behavior_rules', value: kernelConfig.prompt_behavior_rules, category: 'KERNEL' },
        { key: 'prompt_human_handoff', value: kernelConfig.prompt_human_handoff, category: 'KERNEL' },
        { key: 'prompt_bank_rules', value: kernelConfig.prompt_bank_rules, category: 'KERNEL' },
        { key: 'prompt_ai_suggestions', value: kernelConfig.prompt_ai_suggestions, category: 'KERNEL' },
        { key: 'prompt_qa_auditor', value: kernelConfig.prompt_qa_auditor, category: 'KERNEL' },
      ];
      
      const { error } = await supabase.from('app_config').upsert(newConfigs, { onConflict: 'key' });
      if (error) throw error;

      if (followupConfig.id) {
          await supabase.from('followup_config').update(followupConfig).eq('id', followupConfig.id);
      } else {
          await supabase.from('followup_config').insert(followupConfig);
      }

      toast.success('Configuración guardada correctamente.');
      fetchAllData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportConfig = async () => {
     try {
         const [
             { data: appConfig }, { data: followupConfigData }, { data: profiles },
             { data: mediaAssets }, { data: knowledgeBase }, { data: promptVersions }
         ] = await Promise.all([
             supabase.from('app_config').select('*'), supabase.from('followup_config').select('*'),
             supabase.from('profiles').select('*'), supabase.from('media_assets').select('*'),
             supabase.from('knowledge_documents').select('*'), supabase.from('prompt_versions').select('*')
         ]);

         const exportData = {
            metadata: { exported_at: new Date().toISOString(), version: '2.0', description: "Respaldo Total Integral" },
            app_config: appConfig, followup_config: followupConfigData, profiles: profiles,
            media_assets: mediaAssets, knowledge_documents: knowledgeBase, prompt_versions: promptVersions
         };

         const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
         const url = URL.createObjectURL(blob);
         const link = document.createElement("a");
         link.href = url;
         link.download = `samurai_full_backup_${Date.now()}.json`;
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
         toast.success("Respaldo Total y Usuarios Descargado");
     } catch (e) { toast.error("Error al exportar todo el sistema"); }
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;

     const reader = new FileReader();
     reader.onload = async (event) => {
         try {
             const json = JSON.parse(event.target?.result as string);
             if (!json.app_config) throw new Error("Formato inválido");
             const { error } = await supabase.from('app_config').upsert(json.app_config, { onConflict: 'key' });
             if (error) throw error;
             toast.success("Configuración Core inyectada con éxito. Recargando...");
             setTimeout(() => window.location.reload(), 1500);
         } catch (err: any) { toast.error("Error al importar: " + err.message); }
     };
     reader.readAsText(file);
  };

  const handleClearAllLogs = async () => {
      if (!confirm("¿ESTÁS SEGURO? Esto vaciará permanentemente todos los logs de actividad del sistema.")) return;
      setClearingLogs(true);
      try {
         await supabase.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
         toast.success("Todos los logs han sido purgados.");
      } catch (err: any) { toast.error("Fallo al vaciar logs: " + err.message); } finally { setClearingLogs(false); }
  };

  const handleFactoryReset = async () => {
      const promptRes = prompt("⚠️ PELIGRO CRÍTICO ⚠️\nEscribe 'DESTRUIR' para borrar TODA LA CONFIGURACIÓN, LEADS, CHATS y USUARIOS (excepto gameygv@gmail.com).");
      if (promptRes !== 'DESTRUIR') {
          if (promptRes !== null) toast.error("Abortando: Palabra clave incorrecta.");
          return;
      }
      setWipingSystem(true);
      try {
          const { data, error } = await supabase.functions.invoke('system-wipe', { body: { confirmation: 'FACTORY_RESET' } });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          toast.success("SISTEMA DESTRUIDO CON ÉXITO. Limpiando cache...");
          setTimeout(() => window.location.reload(), 2000);
      } catch (err: any) { toast.error("Fallo durante Factory Reset: " + err.message); } finally { setWipingSystem(false); }
  };

  const handleTestMessage = async () => {
    if (!testPhone) return toast.error("Ingresa un número de teléfono.");
    setTesting(true);
    const res = await sendEvolutionMessage(testPhone, "Hola, prueba de Samurai Kernel.");
    if (res) toast.success("Mensaje enviado.");
    setTesting(false);
  };

  const getValue = (key: string) => configs.find(c => c.key === key)?.value || '';

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-white">Configuración del Sistema</h1><p className="text-slate-400">Parámetros tácticos de la IA.</p></div>
          <Button onClick={handleSaveAll} disabled={saving} className="bg-indigo-600 shadow-lg shrink-0">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Todo
          </Button>
        </div>

        {isAdmin && (
           <Card className="bg-slate-900 border-red-900/50 shadow-2xl relative overflow-hidden">
             <div className={cn("absolute left-0 top-0 bottom-0 w-2", globalBotPaused ? "bg-red-500" : "bg-emerald-500")} />
             <CardHeader className="pb-3 border-b border-slate-800 bg-slate-950/30">
               <CardTitle className="text-white flex items-center justify-between gap-2">
                 <div className="flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-red-500" /> Interruptor Maestro (Kill Switch)</div>
                 <Switch checked={globalBotPaused} onCheckedChange={setGlobalBotPaused} />
               </CardTitle>
             </CardHeader>
             <CardContent className="pt-4">
               <p className="text-xs text-slate-400">
                  <strong className={globalBotPaused ? "text-red-400" : "text-emerald-400"}>
                     {globalBotPaused ? "EL BOT ESTÁ APAGADO." : "EL BOT ESTÁ EN LÍNEA."}
                  </strong> Al activar esta opción, la Inteligencia Artificial dejará de responder a <strong>cualquier cliente de la base de datos</strong> instantáneamente. Úsalo solo para mantenimientos de emergencia.
               </p>
             </CardContent>
           </Card>
        )}

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 flex-wrap h-auto">
            <TabsTrigger value="mensajeria" className="gap-2"><Send className="w-4 h-4"/> Mensajería</TabsTrigger>
            <TabsTrigger value="plantillas" className="gap-2"><MessageSquarePlus className="w-4 h-4"/> Componentes UI</TabsTrigger>
            <TabsTrigger value="followup" className="gap-2"><Clock className="w-4 h-4"/> Retargeting</TabsTrigger>
            <TabsTrigger value="woocommerce" className="gap-2"><Store className="w-4 h-4"/> WooCommerce</TabsTrigger>
            <TabsTrigger value="pago_directo" className="gap-2"><Building2 className="w-4 h-4"/> Depósito</TabsTrigger>
            <TabsTrigger value="secrets" className="gap-2"><Key className="w-4 h-4"/> API Keys</TabsTrigger>
            {isDev && <TabsTrigger value="kernel" className="gap-2 bg-indigo-900/20 text-indigo-400 data-[state=active]:bg-indigo-600 data-[state=active]:text-white ml-auto"><TerminalSquare className="w-4 h-4"/> Kernel Dev</TabsTrigger>}
          </TabsList>

          {/* ... (TABS KERNEL, FOLLOWUP, ETC) ... */}
          {isDev && (
             <TabsContent value="kernel" className="mt-6 space-y-6">
                <Card className="bg-[#0D0B0A] border-slate-800 shadow-2xl rounded-2xl overflow-hidden border-l-4 border-l-indigo-500">
                   <CardHeader className="border-b border-slate-800 bg-slate-900/50 flex flex-row items-center justify-between">
                      <div>
                         <CardTitle className="text-indigo-400 flex items-center gap-2 text-sm uppercase tracking-widest font-bold">
                            <TerminalSquare className="w-5 h-5" /> Samurai Kernel (Agnostic Core)
                         </CardTitle>
                         <CardDescription className="text-[10px] mt-1">Configura las instrucciones envolventes que rigen al bot.</CardDescription>
                      </div>
                      <div className="flex gap-2">
                         <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImportConfig} />
                         <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="h-9 text-[10px] bg-slate-900 border-slate-700 hover:text-indigo-400"><Upload className="w-3.5 h-3.5 mr-2" /> Importar Backup</Button>
                         <Button onClick={handleExportConfig} className="bg-indigo-900 hover:bg-indigo-800 text-indigo-200 h-9 text-[10px]"><Download className="w-3.5 h-3.5 mr-2" /> Backup Total (JSON)</Button>
                      </div>
                   </CardHeader>
                   <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                      <div className="space-y-2">
                         <Label className="text-[10px] text-indigo-400 uppercase font-bold tracking-widest">Reglas del Catálogo (Tienda)</Label>
                         <Textarea value={kernelConfig.prompt_catalog_rules} onChange={e => handleKernelChange('prompt_catalog_rules', e.target.value)} className="bg-black border-slate-800 text-xs h-24 font-mono text-slate-300" />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] text-indigo-400 uppercase font-bold tracking-widest">Reglas Multimedia (Posters)</Label>
                         <Textarea value={kernelConfig.prompt_media_rules} onChange={e => handleKernelChange('prompt_media_rules', e.target.value)} className="bg-black border-slate-800 text-xs h-24 font-mono text-slate-300" />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] text-indigo-400 uppercase font-bold tracking-widest">Reglas de Comportamiento (Anti-Robot)</Label>
                         <Textarea value={kernelConfig.prompt_behavior_rules} onChange={e => handleKernelChange('prompt_behavior_rules', e.target.value)} className="bg-black border-slate-800 text-xs h-32 font-mono text-slate-300" />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] text-indigo-400 uppercase font-bold tracking-widest">Escalado a Humano (Handoff)</Label>
                         <Textarea value={kernelConfig.prompt_human_handoff} onChange={e => handleKernelChange('prompt_human_handoff', e.target.value)} className="bg-black border-slate-800 text-xs h-32 font-mono text-slate-300" />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] text-amber-500 uppercase font-bold tracking-widest">Prompt Co-Piloto (Botones Chat)</Label>
                         <Textarea value={kernelConfig.prompt_ai_suggestions} onChange={e => handleKernelChange('prompt_ai_suggestions', e.target.value)} className="bg-black border-slate-800 text-[10px] h-40 font-mono text-amber-500/80" />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] text-red-500 uppercase font-bold tracking-widest">Prompt Auditor de Agentes (QA)</Label>
                         <Textarea value={kernelConfig.prompt_qa_auditor} onChange={e => handleKernelChange('prompt_qa_auditor', e.target.value)} className="bg-black border-slate-800 text-[10px] h-40 font-mono text-red-400/80" />
                      </div>
                   </CardContent>
                </Card>

                {/* ZONA DE PELIGRO */}
                <Card className="bg-[#1A0C0B] border-red-900/50 shadow-2xl rounded-2xl overflow-hidden border-l-4 border-l-red-600">
                   <CardHeader className="border-b border-red-900/30 bg-red-950/40">
                      <CardTitle className="text-red-400 flex items-center gap-2 text-sm uppercase tracking-widest font-bold">
                         <AlertTriangle className="w-5 h-5" /> ZONA DE PELIGRO (DANGER ZONE)
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                      <div className="space-y-2 p-4 border border-slate-800 rounded-xl bg-slate-950/50">
                         <h4 className="text-white font-bold text-sm flex items-center gap-2"><Trash2 className="w-4 h-4 text-slate-400"/> Vaciar Logs del Sistema</h4>
                         <p className="text-[10px] text-slate-400">Elimina de forma permanente todo el historial de actividad, errores y eventos del monitor.</p>
                         <Button onClick={handleClearAllLogs} disabled={clearingLogs} variant="outline" className="mt-2 w-full border-red-900/50 text-red-400 hover:bg-red-900/30">
                           {clearingLogs ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : "Eliminar Todos los Logs"}
                         </Button>
                      </div>
                      <div className="space-y-2 p-4 border border-red-900/50 rounded-xl bg-red-950/20">
                         <h4 className="text-red-400 font-bold text-sm flex items-center gap-2"><ShieldAlert className="w-4 h-4"/> Factory Reset (Wipe Total)</h4>
                         <p className="text-[10px] text-red-300/70">Borra de tajo TODO el contenido: Configuración, Leads, Chats, Documentos y Usuarios (Protegiendo a gameygv@gmail.com).</p>
                         <Button onClick={handleFactoryReset} disabled={wipingSystem} className="mt-2 w-full bg-red-700 hover:bg-red-600 text-white font-bold tracking-widest text-[10px] uppercase shadow-lg shadow-red-900/50">
                           {wipingSystem ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : "DESTRUIR SISTEMA"}
                         </Button>
                      </div>
                   </CardContent>
                </Card>
             </TabsContent>
          )}

          <TabsContent value="plantillas" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-amber-500">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 bg-slate-950/30">
                   <div>
                       <CardTitle className="text-white flex items-center gap-2"><Tag className="w-5 h-5 text-amber-500" /> Etiquetas Globales</CardTitle>
                       <CardDescription className="text-xs">Estas etiquetas las verán y podrán usar todos los vendedores.</CardDescription>
                   </div>
                   <Button onClick={handleAddTag} className="bg-amber-600 hover:bg-amber-500 text-slate-900 h-9 text-xs rounded-xl shadow-lg font-bold"><Plus className="w-4 h-4 mr-2" /> Añadir Etiqueta</Button>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                   {globalTags.map((tag) => (
                      <div key={tag.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex gap-4 items-center group">
                         <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                               <Label className="text-[10px] uppercase font-bold text-slate-500">Texto de la Etiqueta</Label>
                               <Input value={tag.text} onChange={e => handleUpdateTag(tag.id, 'text', e.target.value.toUpperCase())} placeholder="Ej: URGENTE" className="bg-slate-900 border-slate-700 h-9 text-xs font-bold text-white uppercase" />
                            </div>
                            <div className="space-y-1">
                               <Label className="text-[10px] uppercase font-bold text-slate-500">Color (Hex/Tailwind)</Label>
                               <div className="flex items-center gap-2">
                                  <input type="color" value={tag.color} onChange={e => handleUpdateTag(tag.id, 'color', e.target.value)} className="w-9 h-9 rounded cursor-pointer bg-slate-900 border border-slate-700 p-0" />
                                  <Input value={tag.color} onChange={e => handleUpdateTag(tag.id, 'color', e.target.value)} className="bg-slate-900 border-slate-700 h-9 text-xs font-mono w-28" />
                                  <Badge style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '50' }} className="ml-4 px-3 border shadow-sm">{tag.text || 'VISTA PREVIA'}</Badge>
                               </div>
                            </div>
                         </div>
                         <Button variant="ghost" size="icon" onClick={() => setGlobalTags(prev => prev.filter(t => t.id !== tag.id))} className="text-slate-500 hover:text-red-500 mt-5"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                   ))}
                </CardContent>
             </Card>

             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-indigo-500">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 bg-slate-950/30">
                   <div>
                       <CardTitle className="text-white flex items-center gap-2"><MessageSquarePlus className="w-5 h-5 text-indigo-400" /> Plantillas Globales</CardTitle>
                       <CardDescription className="text-xs">Respuestas predeterminadas para todo el equipo.</CardDescription>
                   </div>
                   <Button onClick={handleAddQuickReply} className="bg-indigo-900 hover:bg-indigo-800 text-amber-500 h-9 text-xs rounded-xl shadow-lg"><Plus className="w-4 h-4 mr-2" /> Añadir Plantilla</Button>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                   {quickReplies.map((qr) => (
                      <div key={qr.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex gap-4 items-start group">
                         <div className="flex-1 space-y-3">
                            <Input value={qr.title} onChange={e => handleUpdateQuickReply(qr.id, 'title', e.target.value)} placeholder="Título (Ej: Info Retiro)" className="bg-slate-900 border-slate-700 h-9 text-xs font-bold" />
                            <Textarea value={qr.text} onChange={e => handleUpdateQuickReply(qr.id, 'text', e.target.value)} placeholder="Mensaje..." className="bg-slate-900 border-slate-700 text-xs min-h-[80px]" />
                         </div>
                         <Button variant="ghost" size="icon" onClick={() => setQuickReplies(prev => prev.filter(q => q.id !== qr.id))} className="text-slate-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                   ))}
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="mensajeria" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-green-600">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><Webhook className="w-5 h-5 text-green-600" /> Conexión Evolution API</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                   <div className="space-y-2"><Label>URL del Endpoint (sendText)</Label><Input value={getValue('evolution_api_url')} onChange={e => handleInputChange('evolution_api_url', e.target.value, 'EVOLUTION')} className="bg-slate-950 font-mono" /></div>
                   <div className="space-y-2"><Label>API Key</Label><Input type="password" value={getValue('evolution_api_key')} onChange={e => handleInputChange('evolution_api_key', e.target.value, 'EVOLUTION')} className="bg-slate-950 font-mono" /></div>
                </CardContent>
                <CardFooter className="bg-slate-950/50 border-t border-slate-800 p-4 flex items-center gap-4">
                   <Input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="Tu # de WhatsApp" className="bg-slate-900 border-slate-700 w-48 h-9 text-xs" />
                   <Button onClick={handleTestMessage} disabled={testing} variant="outline" className="border-green-500/30 text-green-500"><Send className="w-3 h-3 mr-2" /> Probar Conexión</Button>
                </CardFooter>
             </Card>
          </TabsContent>

          <TabsContent value="followup" className="mt-6 space-y-6">
              {/* OMITIDO POR BREVEDAD, ES IGUAL AL CÓDIGO ACTUAL */}
              <Card className="bg-slate-900 border-slate-800 shadow-xl">
                <CardHeader className="bg-slate-950/30"><CardTitle className="text-white flex items-center gap-2 text-sm font-bold"><Clock className="w-4 h-4 text-indigo-400" /> Controlador Global de Tiempos</CardTitle></CardHeader>
                <CardContent className="pt-6">
                   <div className="grid grid-cols-2 gap-6 max-w-lg">
                      <div className="space-y-2"><Label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Hora de Inicio (Aprox CDMX)</Label><Input type="number" min="0" max="23" value={followupConfig.start_hour} onChange={e => setFollowupConfig({...followupConfig, start_hour: parseInt(e.target.value)})} className="bg-slate-950 border-slate-800" /></div>
                      <div className="space-y-2"><Label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Hora de Fin (Aprox CDMX)</Label><Input type="number" min="0" max="23" value={followupConfig.end_hour} onChange={e => setFollowupConfig({...followupConfig, end_hour: parseInt(e.target.value)})} className="bg-slate-950 border-slate-800" /></div>
                   </div>
                </CardContent>
             </Card>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Card className="bg-slate-900 border-slate-800 border-t-4 border-t-amber-500 shadow-xl">
                    <CardHeader className="border-b border-slate-800 bg-slate-950/30">
                       <div className="flex justify-between items-center">
                          <CardTitle className="text-amber-500 flex items-center gap-2 uppercase tracking-widest text-xs font-bold">1. Exploración</CardTitle>
                          <Switch checked={followupConfig.enabled} onCheckedChange={c => setFollowupConfig({...followupConfig, enabled: c})} />
                       </div>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6 opacity-100 transition-opacity" style={{ opacity: followupConfig.enabled ? 1 : 0.5, pointerEvents: followupConfig.enabled ? 'auto' : 'none' }}>
                       {[1, 2, 3].map(stage => (
                           <div key={stage} className="space-y-2 border-b border-slate-800 pb-4 last:border-0">
                              <div className="flex justify-between items-end">
                                 <Label className="text-amber-400 font-bold text-[10px] uppercase">Fase {stage}</Label>
                                 <div className="flex items-center gap-2"><Input type="number" value={followupConfig[`stage_${stage}_delay`]} onChange={e => setFollowupConfig({...followupConfig, [`stage_${stage}_delay`]: parseInt(e.target.value)})} className="bg-slate-950 border-slate-800 w-20 h-7 text-xs text-center font-mono text-amber-500" /><span className="text-[9px] text-slate-500">Minutos</span></div>
                              </div>
                              <Textarea value={followupConfig[`stage_${stage}_message`]} onChange={e => setFollowupConfig({...followupConfig, [`stage_${stage}_message`]: e.target.value})} className="bg-slate-950 border-slate-800 text-xs h-16 resize-none" />
                           </div>
                       ))}
                    </CardContent>
                 </Card>

                 <Card className="bg-slate-900 border-slate-800 border-t-4 border-t-emerald-500 shadow-xl">
                    <CardHeader className="border-b border-slate-800 bg-slate-950/30">
                       <div className="flex justify-between items-center">
                          <CardTitle className="text-emerald-500 flex items-center gap-2 uppercase tracking-widest text-xs font-bold"><DollarSign className="w-4 h-4"/> 2. Cierre de Ventas</CardTitle>
                          <Switch checked={salesConfig.enabled} onCheckedChange={c => setSalesConfig({...salesConfig, enabled: c})} />
                       </div>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6 opacity-100 transition-opacity" style={{ opacity: salesConfig.enabled ? 1 : 0.5, pointerEvents: salesConfig.enabled ? 'auto' : 'none' }}>
                       {[1, 2, 3].map(stage => (
                           <div key={stage} className="space-y-2 border-b border-slate-800 pb-4 last:border-0">
                              <div className="flex justify-between items-end">
                                 <Label className="text-emerald-400 font-bold text-[10px] uppercase">Fase {stage}</Label>
                                 <div className="flex items-center gap-2"><Input type="number" value={(salesConfig as any)[`stage_${stage}_delay`]} onChange={e => setSalesConfig({...salesConfig, [`stage_${stage}_delay`]: parseInt(e.target.value)})} className="bg-slate-950 border-slate-800 w-20 h-7 text-xs text-center font-mono text-emerald-500" /><span className="text-[9px] text-slate-500">Minutos</span></div>
                              </div>
                              <Textarea value={(salesConfig as any)[`stage_${stage}_message`]} onChange={e => setSalesConfig({...salesConfig, [`stage_${stage}_message`]: e.target.value})} className="bg-slate-950 border-slate-800 text-xs h-16 resize-none" />
                           </div>
                       ))}
                    </CardContent>
                 </Card>
             </div>
          </TabsContent>

          <TabsContent value="woocommerce" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-pink-600 shadow-xl">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-pink-600" /> Integración Tienda</CardTitle>
                   <CardDescription>Conexión base con tu e-commerce.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2"><Label>URL Base de la Tienda</Label><Input value={getValue('wc_url')} onChange={e => handleInputChange('wc_url', e.target.value, 'WOOCOMMERCE')} className="bg-slate-950" placeholder="https://tutienda.com" /></div>
                   <div className="space-y-2"><Label>Ruta de Checkout (Slug)</Label><Input value={getValue('wc_checkout_path') || '/checkout/'} onChange={e => handleInputChange('wc_checkout_path', e.target.value, 'WOOCOMMERCE')} className="bg-slate-950" placeholder="/checkout/" /></div>
                </CardContent>
             </Card>

             <Card className="bg-slate-900 border-slate-800 shadow-xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 bg-slate-950/30">
                   <div>
                       <CardTitle className="text-white flex items-center gap-2 text-sm"><Target className="w-5 h-5 text-amber-500" /> Catálogo de Productos y Prompts de Venta</CardTitle>
                       <CardDescription className="text-xs mt-1">La IA leerá esta lista para saber qué link enviar dependiendo de lo que pida el cliente.</CardDescription>
                   </div>
                   <Button onClick={handleAddProduct} className="bg-indigo-900 hover:bg-indigo-800 text-amber-500 h-9 text-xs rounded-xl shadow-lg">
                      <Plus className="w-4 h-4 mr-2" /> Añadir Producto
                   </Button>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                   {wcProducts.length === 0 ? (
                       <div className="text-center py-10 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 italic text-xs">
                          No hay productos configurados. El bot no podrá enviar links de pago.
                       </div>
                   ) : wcProducts.map((prod, index) => (
                       <div key={prod.id} className="p-5 bg-slate-950 border border-slate-800 rounded-xl relative group">
                          <Button variant="ghost" size="icon" onClick={() => setWcProducts(prev => prev.filter(p => p.id !== prod.id))} className="absolute top-2 right-2 text-slate-500 hover:text-red-500 opacity-50 group-hover:opacity-100 transition-opacity">
                             <Trash2 className="w-4 h-4" />
                          </Button>
                          
                          <div className="flex items-center gap-2 mb-4">
                             <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-900/50 text-indigo-300 text-xs font-bold">{index + 1}</span>
                             <h4 className="text-sm font-bold text-slate-300">Configuración de Producto</h4>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                             <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1"><Hash className="w-3 h-3"/> WooCommerce ID</Label>
                                <Input value={prod.wc_id} onChange={e => handleUpdateProduct(prod.id, 'wc_id', e.target.value)} placeholder="Ej: 1483" className="bg-slate-900 border-slate-700 h-10 font-mono text-amber-500 font-bold" />
                             </div>
                             <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-slate-500">Nombre Interno (Contexto)</Label>
                                <Input value={prod.title} onChange={e => handleUpdateProduct(prod.id, 'title', e.target.value)} placeholder="Ej: Taller Cuencos Monterrey" className="bg-slate-900 border-slate-700 h-10 text-white" />
                             </div>
                             <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-slate-500">Precio (Monto)</Label>
                                <div className="relative">
                                   <DollarSign className="absolute left-2 top-3 h-4 w-4 text-emerald-500" />
                                   <Input value={prod.price} onChange={e => handleUpdateProduct(prod.id, 'price', e.target.value)} placeholder="1500" className="pl-7 bg-slate-900 border-slate-700 h-10 text-emerald-400 font-bold" />
                                </div>
                             </div>
                          </div>

                          <div className="space-y-2">
                             <Label className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5"/> Prompt / Condición de Venta (Instrucción para IA)
                             </Label>
                             <Textarea 
                                value={prod.prompt} 
                                onChange={e => handleUpdateProduct(prod.id, 'prompt', e.target.value)} 
                                placeholder="Escribe cuándo y cómo el Bot debe ofrecer este producto..." 
                                className="bg-slate-900 border-slate-700 text-xs min-h-[80px] leading-relaxed focus:border-indigo-500" 
                             />
                             <p className="text-[9px] text-slate-500 italic">Ej: "Ofrecer este enlace exclusivamente cuando el cliente confirme que desea asegurar su lugar para el Retiro en Tulum."</p>
                          </div>
                       </div>
                   ))}
                </CardContent>
             </Card>
          </TabsContent>
          
          <TabsContent value="pago_directo" className="mt-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-blue-600">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><Building2 className="w-5 h-5 text-blue-600" /> Datos para Depósito</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2"><Label>Nombre del Banco</Label><Input value={getValue('bank_name')} onChange={e => handleInputChange('bank_name', e.target.value, 'BANK')} className="bg-slate-950" /></div>
                   <div className="space-y-2"><Label>Titular de la Cuenta</Label><Input value={getValue('bank_holder')} onChange={e => handleInputChange('bank_holder', e.target.value, 'BANK')} className="bg-slate-950" /></div>
                   <div className="space-y-2"><Label>Número de Cuenta</Label><Input value={getValue('bank_account')} onChange={e => handleInputChange('bank_account', e.target.value, 'BANK')} className="bg-slate-950" /></div>
                   <div className="space-y-2"><Label>CLABE Interbancaria</Label><Input value={getValue('bank_clabe')} onChange={e => handleInputChange('bank_clabe', e.target.value, 'BANK')} className="bg-slate-950" /></div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="secrets" className="mt-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-red-600">
                <CardHeader><CardTitle className="text-white flex items-center gap-2"><Key className="w-5 h-5 text-red-600" /> Secretos y API Keys</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                   <div className="space-y-2"><Label>OpenAI API Key</Label><Input type="password" value={getValue('openai_api_key')} onChange={e => handleInputChange('openai_api_key', e.target.value, 'SECRETS')} className="bg-slate-950 font-mono" /></div>
                </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;