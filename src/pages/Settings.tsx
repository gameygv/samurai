import React, { useEffect, useState } from 'react';
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
import { Webhook, Key, Save, Loader2, ShoppingCart, Target, Link as LinkIcon, Building2, Brain, Store, Hash, Send, Clock, Play } from 'lucide-react';
import { toast } from 'sonner';
import { sendEvolutionMessage } from '@/utils/messagingService';

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'mensajeria';
  
  const [configs, setConfigs] = useState<any[]>([]);
  const [followupConfig, setFollowupConfig] = useState<any>({
      enabled: false, stage_1_delay: 15, stage_2_delay: 60, stage_3_delay: 1440,
      start_hour: 9, end_hour: 20, stage_1_message: '', stage_2_message: '', stage_3_message: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingCron, setTestingCron] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    const { data } = await supabase.from('app_config').select('*');
    if (data) setConfigs(data);

    const { data: fcData } = await supabase.from('followup_config').select('*').limit(1).maybeSingle();
    if (fcData) {
        setFollowupConfig(fcData);
    } else {
        setFollowupConfig({
            enabled: false, stage_1_delay: 15, stage_2_delay: 60, stage_3_delay: 1440,
            start_hour: 9, end_hour: 20,
            stage_1_message: 'Haz un saludo natural y pregúntale si pudo ver la información.',
            stage_2_message: 'Dile que sigues al pendiente por si tiene alguna duda.',
            stage_3_message: 'Haz un último intento de cierre, ofrécele ayuda con el pago.',
            max_followup_stage: 3
        });
    }
    setLoading(false);
  };

  const handleInputChange = (key: string, value: string, category: string) => {
    setConfigs(prev => {
      const exists = prev.find(c => c.key === key);
      if (exists) return prev.map(c => c.key === key ? { ...c, value } : c);
      return [...prev, { key, value, category }];
    });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('app_config').upsert(configs, { onConflict: 'key' });
      if (error) throw error;

      if (followupConfig.id) {
          const { error: fError } = await supabase.from('followup_config').update(followupConfig).eq('id', followupConfig.id);
          if (fError) throw fError;
      } else {
          const { error: fError } = await supabase.from('followup_config').insert(followupConfig);
          if (fError) throw fError;
      }

      toast.success('Configuración actualizada correctamente');
      fetchAllData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestMessage = async () => {
    if (!testPhone) return toast.error("Ingresa un número de teléfono para la prueba.");
    setTesting(true);
    const response = await sendEvolutionMessage(testPhone, "Hola, esto es una prueba de conexión desde el panel de The Elephant Bowl CRM.");
    if (response) toast.success("Mensaje de prueba enviado. Revisa tu WhatsApp.");
    setTesting(false);
  };

  const handleForceCron = async () => {
     setTestingCron(true);
     const tid = toast.loading("Ejecutando evaluador de tiempos...");
     try {
        const { data, error } = await supabase.functions.invoke('process-followups', {});
        if (error) throw new Error(error.message);
        if (data.processed?.length > 0) {
            toast.success(`Se enviaron ${data.processed.length} follow-ups.`, { id: tid });
        } else {
            toast.info(data.message || "No hay leads que cumplan los minutos de inactividad requeridos.", { id: tid });
        }
     } catch (err: any) {
        toast.error("Fallo al ejecutar: " + err.message, { id: tid });
     } finally {
        setTestingCron(false);
     }
  };

  const getValue = (key: string) => configs.find(c => c.key === key)?.value || '';

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Configuración del Sistema</h1>
            <p className="text-slate-400">Parámetros tácticos de la IA.</p>
          </div>
          <Button onClick={handleSaveAll} disabled={saving} className="bg-indigo-600 shadow-lg">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Todo
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 flex-wrap h-auto">
            <TabsTrigger value="mensajeria" className="gap-2"><Send className="w-4 h-4"/> Mensajería</TabsTrigger>
            <TabsTrigger value="followup" className="gap-2"><Clock className="w-4 h-4"/> Retargeting IA</TabsTrigger>
            <TabsTrigger value="woocommerce" className="gap-2"><Store className="w-4 h-4"/> WooCommerce</TabsTrigger>
            <TabsTrigger value="pago_directo" className="gap-2"><Building2 className="w-4 h-4"/> Depósito Directo</TabsTrigger>
            <TabsTrigger value="secrets" className="gap-2"><Key className="w-4 h-4"/> API Keys</TabsTrigger>
          </TabsList>

          <TabsContent value="mensajeria" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-green-600">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><Webhook className="w-5 h-5 text-green-600" /> Conexión Evolution API</CardTitle>
                   <CardDescription>Configura el endpoint para enviar mensajes de WhatsApp.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="space-y-2">
                      <Label>URL del Endpoint (sendText)</Label>
                      <Input value={getValue('evolution_api_url')} onChange={e => handleInputChange('evolution_api_url', e.target.value, 'EVOLUTION')} placeholder="http://localhost:8080/message/sendText/instance_name" className="bg-slate-950 font-mono" />
                   </div>
                   <div className="space-y-2">
                      <Label>API Key</Label>
                      <Input type="password" value={getValue('evolution_api_key')} onChange={e => handleInputChange('evolution_api_key', e.target.value, 'EVOLUTION')} className="bg-slate-950 font-mono" />
                   </div>
                </CardContent>
                <CardFooter className="bg-slate-950/50 border-t border-slate-800 p-4 flex items-center gap-4">
                   <Input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="Tu # de WhatsApp (52...)" className="bg-slate-900 border-slate-700 w-48 h-9 text-xs" />
                   <Button onClick={handleTestMessage} disabled={testing} variant="outline" className="border-green-500/30 text-green-500 hover:bg-green-500/10 h-9 text-xs">
                      {testing ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Send className="w-3 h-3 mr-2" />} Probar Conexión
                   </Button>
                </CardFooter>
             </Card>
          </TabsContent>

          <TabsContent value="followup" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-amber-500 shadow-xl">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 bg-slate-950/30">
                   <div>
                       <CardTitle className="text-amber-500 flex items-center gap-2 uppercase tracking-widest text-xs font-bold"><Clock className="w-4 h-4" /> Retargeting Automático</CardTitle>
                       <CardDescription className="text-[10px] mt-1">Reglas de persecución e insistencia.</CardDescription>
                   </div>
                   <div className="flex items-center gap-4">
                       <Button variant="outline" onClick={handleForceCron} disabled={testingCron} className="h-9 text-[10px] border-indigo-500/30 text-indigo-400 hover:bg-indigo-900/30 font-bold uppercase">
                           {testingCron ? <Loader2 className="w-3 h-3 mr-2 animate-spin"/> : <Play className="w-3 h-3 mr-2"/>} Ejecutar Evaluador de Tiempos
                       </Button>
                       <div className="flex items-center space-x-2">
                          <Label className="text-slate-300 font-bold">Activar Sistema</Label>
                          <Switch checked={followupConfig.enabled} onCheckedChange={c => setFollowupConfig({...followupConfig, enabled: c})} />
                       </div>
                   </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6 opacity-100 transition-opacity" style={{ opacity: followupConfig.enabled ? 1 : 0.5, pointerEvents: followupConfig.enabled ? 'auto' : 'none' }}>
                   
                   <div className="grid grid-cols-2 gap-6 p-4 bg-slate-950 rounded-xl border border-slate-800">
                      <div className="space-y-2">
                         <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Hora de Inicio (24h)</Label>
                         <Input type="number" min="0" max="23" value={followupConfig.start_hour} onChange={e => setFollowupConfig({...followupConfig, start_hour: parseInt(e.target.value)})} className="bg-slate-900 border-slate-700" />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Hora de Fin (24h)</Label>
                         <Input type="number" min="0" max="23" value={followupConfig.end_hour} onChange={e => setFollowupConfig({...followupConfig, end_hour: parseInt(e.target.value)})} className="bg-slate-900 border-slate-700" />
                      </div>
                   </div>

                   <div className="space-y-6">
                       {/* FASE 1 */}
                       <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start border-b border-slate-800 pb-6">
                          <div className="md:col-span-3 space-y-2">
                             <Label className="text-amber-500 font-bold text-xs uppercase tracking-widest">Fase 1 (Re-enganche)</Label>
                             <div className="flex items-center gap-2">
                                <Input type="number" value={followupConfig.stage_1_delay} onChange={e => setFollowupConfig({...followupConfig, stage_1_delay: parseInt(e.target.value)})} className="bg-slate-950 border-slate-800 w-20 text-center font-bold text-amber-500" />
                                <span className="text-xs text-slate-400">Minutos</span>
                             </div>
                          </div>
                          <div className="md:col-span-9 space-y-2">
                             <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Instrucción para la IA</Label>
                             <Textarea value={followupConfig.stage_1_message} onChange={e => setFollowupConfig({...followupConfig, stage_1_message: e.target.value})} className="bg-slate-950 border-slate-800 text-xs h-20" placeholder="Ej: Hola, ¿pudiste revisar la información?" />
                          </div>
                       </div>

                       {/* FASE 2 */}
                       <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start border-b border-slate-800 pb-6">
                          <div className="md:col-span-3 space-y-2">
                             <Label className="text-indigo-400 font-bold text-xs uppercase tracking-widest">Fase 2 (Insistencia)</Label>
                             <div className="flex items-center gap-2">
                                <Input type="number" value={followupConfig.stage_2_delay} onChange={e => setFollowupConfig({...followupConfig, stage_2_delay: parseInt(e.target.value)})} className="bg-slate-950 border-slate-800 w-20 text-center font-bold text-indigo-400" />
                                <span className="text-xs text-slate-400">Minutos</span>
                             </div>
                             <p className="text-[9px] text-slate-500 italic leading-tight">Minutos desde el último mensaje de la Fase 1</p>
                          </div>
                          <div className="md:col-span-9 space-y-2">
                             <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Instrucción para la IA</Label>
                             <Textarea value={followupConfig.stage_2_message} onChange={e => setFollowupConfig({...followupConfig, stage_2_message: e.target.value})} className="bg-slate-950 border-slate-800 text-xs h-20" placeholder="Ej: Sigo al pendiente por si tienes dudas." />
                          </div>
                       </div>

                       {/* FASE 3 */}
                       <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                          <div className="md:col-span-3 space-y-2">
                             <Label className="text-red-400 font-bold text-xs uppercase tracking-widest">Fase 3 (Último Intento)</Label>
                             <div className="flex items-center gap-2">
                                <Input type="number" value={followupConfig.stage_3_delay} onChange={e => setFollowupConfig({...followupConfig, stage_3_delay: parseInt(e.target.value)})} className="bg-slate-950 border-slate-800 w-20 text-center font-bold text-red-400" />
                                <span className="text-xs text-slate-400">Minutos</span>
                             </div>
                          </div>
                          <div className="md:col-span-9 space-y-2">
                             <Label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Instrucción para la IA</Label>
                             <Textarea value={followupConfig.stage_3_message} onChange={e => setFollowupConfig({...followupConfig, stage_3_message: e.target.value})} className="bg-slate-950 border-slate-800 text-xs h-20" placeholder="Ej: Te escribo por última vez..." />
                          </div>
                       </div>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="woocommerce" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-pink-600">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-pink-600" /> Integración Tienda</CardTitle>
                   <CardDescription>Configura cómo la IA genera los links de pago dinámicos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                         <Label>URL Base de la Tienda</Label>
                         <Input value={getValue('wc_url')} onChange={e => handleInputChange('wc_url', e.target.value, 'WOOCOMMERCE')} placeholder="https://theelephantbowl.com" className="bg-slate-950" />
                      </div>
                      <div className="space-y-2">
                         <Label>Ruta de Checkout (Slug)</Label>
                         <Input value={getValue('wc_checkout_path') || '/checkout/'} onChange={e => handleInputChange('wc_checkout_path', e.target.value, 'WOOCOMMERCE')} placeholder="Ej: /inscripciones/ o /pago/" className="bg-slate-950" />
                      </div>
                   </div>
                   <div className="space-y-2 pt-2 bg-slate-950 p-4 rounded border border-slate-800">
                      <Label className="text-xs text-green-500 uppercase font-bold flex items-center gap-2"><Hash className="w-4 h-4" /> ID del Producto Principal</Label>
                      <Input value={getValue('wc_product_id')} onChange={e => handleInputChange('wc_product_id', e.target.value, 'SALES')} placeholder="Ej: 1483" className="bg-slate-900 border-slate-700 text-white font-mono w-64" />
                   </div>
                </CardContent>
             </Card>
          </TabsContent>
          
          <TabsContent value="pago_directo" className="mt-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-blue-600">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><Building2 className="w-5 h-5 text-blue-600" /> Datos para Depósito</CardTitle>
                   <CardDescription>Información que la IA proporcionará para transferencias bancarias.</CardDescription>
                </CardHeader>
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
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><Key className="w-5 h-5 text-red-600" /> Secretos y API Keys</CardTitle>
                   <CardDescription>Credenciales para servicios externos. Manejar con cuidado.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="space-y-2">
                      <Label>OpenAI API Key</Label>
                      <Input type="password" value={getValue('openai_api_key')} onChange={e => handleInputChange('openai_api_key', e.target.value, 'SECRETS')} className="bg-slate-950 font-mono" />
                   </div>
                </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;