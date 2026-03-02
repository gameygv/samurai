import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Webhook, Key, Save, Loader2, ShoppingCart, Clock, Zap, DollarSign, Target, Link as LinkIcon, Building2, Brain, Store, Hash, PlayCircle, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'ventas';
  
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningFollowup, setRunningFollowup] = useState(false);

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    const { data } = await supabase.from('app_config').select('*');
    if (data) setConfigs(data);
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
      toast.success('Configuración actualizada correctamente');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRunFollowups = async () => {
     setRunningFollowup(true);
     toast.info("Ejecutando barrido de Follow-ups (Ventas + Reactivación)...");
     try {
        const { data, error } = await supabase.functions.invoke('process-followups');
        if (error) throw error;
        
        const count = (data.processed?.length || 0) + (data.reactivated?.length || 0);
        
        if (count > 0) {
           toast.success(`Proceso finalizado. ${count} mensajes enviados.`);
        } else {
           toast.success("Todo al día. No hay leads pendientes de seguimiento.");
        }
     } catch (err: any) {
        toast.error("Error al ejecutar follow-ups: " + err.message);
     } finally {
        setRunningFollowup(false);
     }
  };

  const getValue = (key: string) => configs.find(c => c.key === key)?.value || '';

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-indigo-600 w-10 h-10" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Configuración del Sistema</h1>
            <p className="text-slate-400">Parámetros tácticos del Samurai.</p>
          </div>
          <Button onClick={handleSaveAll} disabled={saving} className="bg-indigo-600">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Todo
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 flex-wrap h-auto">
            <TabsTrigger value="ventas" className="gap-2"><Target className="w-4 h-4"/> Estrategia Venta</TabsTrigger>
            <TabsTrigger value="mensajeria" className="gap-2"><Send className="w-4 h-4"/> Mensajería</TabsTrigger>
            <TabsTrigger value="woocommerce" className="gap-2"><Store className="w-4 h-4"/> WooCommerce</TabsTrigger>
            <TabsTrigger value="pago_directo" className="gap-2"><Building2 className="w-4 h-4"/> Depósito Directo</TabsTrigger>
            <TabsTrigger value="secrets" className="gap-2"><Key className="w-4 h-4"/> API Keys</TabsTrigger>
          </TabsList>

          <TabsContent value="ventas" className="mt-6 space-y-6">
             {/* REACTIVACIÓN (NUEVO) */}
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-blue-500">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-blue-500" /> Reactivación de Conversación
                   </CardTitle>
                   <CardDescription>Para clientes que preguntan y dejan de contestar (Intención Baja/Media).</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label className="text-xs text-slate-500 uppercase">Tiempo de espera (horas)</Label>
                      <Input 
                        type="number" 
                        value={getValue('engagement_reminder_hours') || '24'} 
                        onChange={e => handleInputChange('engagement_reminder_hours', e.target.value, 'SALES')} 
                        className="bg-slate-950" 
                        placeholder="Ej: 12 o 24"
                      />
                      <p className="text-[10px] text-slate-500">Tiempo de silencio antes de enviar el "¿sigues ahí?".</p>
                   </div>
                   <div className="flex items-center justify-center p-4 bg-slate-950 rounded border border-slate-800">
                      <p className="text-xs text-slate-400 italic text-center">
                         "Hola [Nombre], ¿pudiste revisar la información? Quedo pendiente por si tienes dudas..."
                      </p>
                   </div>
                </CardContent>
             </Card>

             {/* CIERRE DE VENTAS (EXISTENTE) */}
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-orange-500">
                <CardHeader>
                   <div className="flex justify-between items-center">
                      <div>
                         <CardTitle className="text-white flex items-center gap-2"><DollarSign className="w-5 h-5 text-orange-500" /> Cierre de Ventas (Intención Alta)</CardTitle>
                         <CardDescription>Secuencia agresiva para clientes que ya recibieron link de pago.</CardDescription>
                      </div>
                      <Button onClick={handleRunFollowups} disabled={runningFollowup} variant="outline" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
                         {runningFollowup ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                         Probar Follow-ups Ahora
                      </Button>
                   </div>
                </CardHeader>
                <CardContent className="space-y-6">
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="space-y-2">
                         <Label className="text-xs text-slate-500 uppercase">Fase 1 (horas)</Label>
                         <Input type="number" value={getValue('sales_reminder_1') || '24'} onChange={e => handleInputChange('sales_reminder_1', e.target.value, 'SALES')} className="bg-slate-950" />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-xs text-slate-500 uppercase">Fase 2 (horas)</Label>
                         <Input type="number" value={getValue('sales_reminder_2') || '48'} onChange={e => handleInputChange('sales_reminder_2', e.target.value, 'SALES')} className="bg-slate-950" />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-xs text-slate-500 uppercase">Fase 3 (horas)</Label>
                         <Input type="number" value={getValue('sales_reminder_3') || '72'} onChange={e => handleInputChange('sales_reminder_3', e.target.value, 'SALES')} className="bg-slate-950" />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-xs text-slate-500 uppercase">Fase 4 (días)</Label>
                         <Input type="number" value={getValue('sales_reminder_4') || '7'} onChange={e => handleInputChange('sales_reminder_4', e.target.value, 'SALES')} className="bg-slate-950" />
                      </div>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="mensajeria" className="mt-6 space-y-6">
            <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><Send className="w-5 h-5 text-green-500" /> Evolution API (WhatsApp Directo)</CardTitle>
                <CardDescription>Conexión directa para envío de mensajes. Esto reemplaza a Make.com.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>URL de la API (incluyendo instancia)</Label>
                  <Input value={getValue('evolution_api_url')} onChange={e => handleInputChange('evolution_api_url', e.target.value, 'EVOLUTION')} placeholder="http://tu_vps:8080/message/sendText/instance_name" className="bg-slate-950" />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input type="password" value={getValue('evolution_api_key')} onChange={e => handleInputChange('evolution_api_key', e.target.value, 'EVOLUTION')} className="bg-slate-950" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><Webhook className="w-5 h-5" /> Webhooks (Opcional)</CardTitle>
                <CardDescription>Para integraciones externas como Make.com (si aún se requiere).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="space-y-2">
                    <Label>Webhook de Salida (Make.com)</Label>
                    <Input value={getValue('webhook_sale')} onChange={e => handleInputChange('webhook_sale', e.target.value, 'WEBHOOK')} className="bg-slate-950" />
                 </div>
              </CardContent>
           </Card>
          </TabsContent>

          <TabsContent value="woocommerce" className="mt-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-pink-600">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-pink-600" /> Integración Tienda</CardTitle>
                   <CardDescription>Samurai verificará aquí si el cliente ya pagó antes de cobrarle.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="space-y-2">
                      <Label>URL de la Tienda</Label>
                      <Input value={getValue('wc_url')} onChange={e => handleInputChange('wc_url', e.target.value, 'WOOCOMMERCE')} placeholder="https://theelephantbowl.com" className="bg-slate-950" />
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <Label>Consumer Key (ck_...)</Label>
                         <Input type="password" value={getValue('wc_key')} onChange={e => handleInputChange('wc_key', e.target.value, 'WOOCOMMERCE')} className="bg-slate-950" />
                      </div>
                      <div className="space-y-2">
                         <Label>Consumer Secret (cs_...)</Label>
                         <Input type="password" value={getValue('wc_secret')} onChange={e => handleInputChange('wc_secret', e.target.value, 'WOOCOMMERCE')} className="bg-slate-950" />
                      </div>
                   </div>
                   <div className="space-y-2 pt-2 bg-slate-950 p-4 rounded border border-slate-800">
                      <Label className="text-xs text-green-500 uppercase font-bold flex items-center gap-2">
                         <Hash className="w-4 h-4" /> ID del Producto Principal (Checkout Automático)
                      </Label>
                      <div className="flex items-center gap-4">
                         <Input 
                           value={getValue('wc_product_id')} 
                           onChange={e => handleInputChange('wc_product_id', e.target.value, 'SALES')} 
                           placeholder="Ej: 1483"
                           className="bg-slate-900 border-slate-700 text-white font-mono w-32 text-center" 
                         />
                         <p className="text-xs text-slate-500 italic">
                            Samurai generará el link: <span className="text-indigo-400 font-mono">/checkout/?add-to-cart={getValue('wc_product_id') || 'ID'}</span>
                         </p>
                      </div>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="pago_directo" className="mt-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-blue-500">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-blue-400" /> Depósito Directo (Opción B)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <Label>Banco</Label>
                         <Input value={getValue('bank_name')} onChange={e => handleInputChange('bank_name', e.target.value, 'PAYMENT')} className="bg-slate-950" />
                      </div>
                      <div className="space-y-2">
                         <Label>Titular</Label>
                         <Input value={getValue('bank_holder')} onChange={e => handleInputChange('bank_holder', e.target.value, 'PAYMENT')} className="bg-slate-950" />
                      </div>
                      <div className="space-y-2">
                         <Label>Cuenta</Label>
                         <Input value={getValue('bank_account')} onChange={e => handleInputChange('bank_account', e.target.value, 'PAYMENT')} className="bg-slate-950" />
                      </div>
                      <div className="space-y-2">
                         <Label>CLABE</Label>
                         <Input value={getValue('bank_clabe')} onChange={e => handleInputChange('bank_clabe', e.target.value, 'PAYMENT')} className="bg-slate-950" />
                      </div>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>
          
          <TabsContent value="secrets" className="mt-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-purple-500">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><Key className="w-5 h-5 text-purple-500" /> Llaves de Inteligencia Artificial</CardTitle>
                   <CardDescription>Configura los cerebros que alimentan al Samurai.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-indigo-400">
                         <Zap className="w-4 h-4" /> OpenAI API Key (Requerido para OCR/Visión)
                      </Label>
                      <Input 
                        type="password" 
                        value={getValue('openai_api_key')} 
                        onChange={e => handleInputChange('openai_api_key', e.target.value, 'SECRET')} 
                        placeholder="sk-..." 
                        className="bg-slate-950 border-slate-800"
                      />
                      <p className="text-[10px] text-slate-500">Motor de visión para Ojo de Halcón y Posters.</p>
                   </div>
                   
                   <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-slate-400">
                         <Brain className="w-4 h-4" /> Gemini API Key (Analítica Secundaria)
                      </Label>
                      <Input 
                        type="password" 
                        value={getValue('gemini_api_key')} 
                        onChange={e => handleInputChange('gemini_api_key', e.target.value, 'SECRET')} 
                        className="bg-slate-950 border-slate-800"
                      />
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