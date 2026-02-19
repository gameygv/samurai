import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Webhook, Key, Save, Loader2, ShoppingCart, Globe, ShieldAlert, Database, Eye, Sparkles, Clock, Zap, Calendar, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'ecommerce';
  
  const [configs, setConfigs] = useState<any[]>([]);
  const [followupConfig, setFollowupConfig] = useState<any>({
    enabled: false,
    stage_1_delay: 15,
    stage_2_delay: 60,
    stage_3_delay: 1440,
    auto_restart_delay: 30,
    start_hour: 9,
    end_hour: 20,
    allowed_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    stage_1_message: 'Hola {nombre}, ¿pudiste ver la información?',
    stage_2_message: 'Hola {nombre}, sigo aquí por si tienes dudas.',
    stage_3_message: 'Hola {nombre}, te escribo por última vez para saber si quieres avanzar.',
    max_followup_stage: 3
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [configRes, followupRes] = await Promise.all([
        supabase.from('app_config').select('*'),
        supabase.from('followup_config').select('*').maybeSingle()
      ]);

      if (configRes.data) setConfigs(configRes.data);
      if (followupRes.data) {
        setFollowupConfig(followupRes.data);
      }
    } catch (err) {
      console.error("Fetch settings error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (key: string, value: string, category: string = 'SYSTEM') => {
    setConfigs(prev => {
      const exists = prev.find(c => c.key === key);
      if (exists) return prev.map(c => c.key === key ? { ...c, value } : c);
      return [...prev, { key, value, category }];
    });
  };

  const handleFollowupChange = (key: string, value: any) => {
    setFollowupConfig((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const { error: configErr } = await supabase.from('app_config').upsert(configs);
      if (configErr) throw configErr;

      const followupPayload = {
        enabled: followupConfig.enabled,
        stage_1_delay: followupConfig.stage_1_delay,
        stage_2_delay: followupConfig.stage_2_delay,
        stage_3_delay: followupConfig.stage_3_delay,
        auto_restart_delay: followupConfig.auto_restart_delay,
        start_hour: followupConfig.start_hour,
        end_hour: followupConfig.end_hour,
        allowed_days: followupConfig.allowed_days,
        stage_1_message: followupConfig.stage_1_message,
        stage_2_message: followupConfig.stage_2_message,
        stage_3_message: followupConfig.stage_3_message,
        max_followup_stage: followupConfig.max_followup_stage,
        updated_at: new Date().toISOString()
      };

      if (followupConfig.id) {
        const { error: updateErr } = await supabase
          .from('followup_config')
          .update(followupPayload)
          .eq('id', followupConfig.id);
        if (updateErr) throw updateErr;
      } else {
        const { data: newRecord, error: insertErr } = await supabase
          .from('followup_config')
          .insert(followupPayload)
          .select()
          .single();
        if (insertErr) throw insertErr;
        if (newRecord) setFollowupConfig(newRecord);
      }

      toast.success('Configuración global actualizada correctamente');
      await fetchAllData();
    } catch (err: any) {
      toast.error(`Error al guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const getValue = (key: string) => configs.find(c => c.key === key)?.value || '';

  const daysOfWeek = [
    { value: 'monday', label: 'Lunes' },
    { value: 'tuesday', label: 'Martes' },
    { value: 'wednesday', label: 'Miércoles' },
    { value: 'thursday', label: 'Jueves' },
    { value: 'friday', label: 'Viernes' },
    { value: 'saturday', label: 'Sábado' },
    { value: 'sunday', label: 'Domingo' }
  ];

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-indigo-600 w-10 h-10" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Configuración del Sistema</h1>
            <p className="text-slate-400">Control de integraciones, webhooks y parámetros de negocio.</p>
          </div>
          <Button onClick={handleSaveAll} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20 px-8">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} 
            Guardar Todo
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 flex-wrap h-auto">
            <TabsTrigger value="ecommerce" className="data-[state=active]:bg-indigo-600"><ShoppingCart className="w-4 h-4 mr-2" /> E-commerce</TabsTrigger>
            <TabsTrigger value="followups" className="data-[state=active]:bg-indigo-600"><Clock className="w-4 h-4 mr-2" /> Follow-ups</TabsTrigger>
            <TabsTrigger value="webhooks" className="data-[state=active]:bg-indigo-600"><Webhook className="w-4 h-4 mr-2" /> Webhooks</TabsTrigger>
            <TabsTrigger value="secrets" className="data-[state=active]:bg-indigo-600"><Key className="w-4 h-4 mr-2" /> API Keys</TabsTrigger>
          </TabsList>

          <TabsContent value="followups" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-indigo-500">
                <CardHeader>
                   <div className="flex items-center justify-between">
                      <div>
                         <CardTitle className="text-white flex items-center gap-2">
                            <Zap className="w-5 h-5 text-indigo-400" /> Sistema de Follow-up Automático
                         </CardTitle>
                         <CardDescription>Configuración de reintentos inteligentes y auto-reactivación post #STOP</CardDescription>
                      </div>
                      <div className="flex items-center gap-3 bg-slate-950 p-2 px-4 rounded-full border border-slate-800">
                         <span className={cn("text-[10px] font-bold uppercase tracking-widest", !followupConfig.enabled ? "text-red-500" : "text-slate-600")}>Pasivo</span>
                         <Switch 
                            checked={followupConfig?.enabled || false}
                            onCheckedChange={(checked) => handleFollowupChange('enabled', checked)}
                         />
                         <span className={cn("text-[10px] font-bold uppercase tracking-widest", followupConfig.enabled ? "text-green-500" : "text-slate-600")}>Proactivo</span>
                      </div>
                   </div>
                </CardHeader>
                <CardContent className="space-y-6">
                   {/* Rest of the content remains the same */}
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                         <Label className="text-xs text-slate-400">Stage 1 (minutos)</Label>
                         <Input 
                            type="number"
                            value={followupConfig?.stage_1_delay || 15}
                            onChange={e => handleFollowupChange('stage_1_delay', parseInt(e.target.value))}
                            className="bg-slate-950 border-slate-800"
                         />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-xs text-slate-400">Stage 2 (minutos)</Label>
                         <Input 
                            type="number"
                            value={followupConfig?.stage_2_delay || 60}
                            onChange={e => handleFollowupChange('stage_2_delay', parseInt(e.target.value))}
                            className="bg-slate-950 border-slate-800"
                         />
                      </div>
                      <div className="space-y-2">
                         <Label className="text-xs text-slate-400">Stage 3 (minutos)</Label>
                         <Input 
                            type="number"
                            value={followupConfig?.stage_3_delay || 1440}
                            onChange={e => handleFollowupChange('stage_3_delay', parseInt(e.target.value))}
                            className="bg-slate-950 border-slate-800"
                         />
                      </div>
                   </div>
                   <div className="space-y-4 bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                      <Label className="text-sm font-bold text-white flex items-center gap-2">
                         <Zap className="w-4 h-4 text-red-500" /> Auto-Reactivación Post #STOP (minutos)
                      </Label>
                      <Input 
                         type="number"
                         value={followupConfig?.auto_restart_delay || 30}
                         onChange={e => handleFollowupChange('auto_restart_delay', parseInt(e.target.value))}
                         className="bg-slate-950 border-slate-800"
                      />
                   </div>
                </CardContent>
             </Card>
          </TabsContent>
          {/* Other TabsContent remain the same */}
          <TabsContent value="ecommerce" className="mt-6 space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-slate-900 border-slate-800">
                   <CardHeader>
                      <CardTitle className="text-sm text-white flex items-center gap-2"><Globe className="w-4 h-4 text-blue-400"/> Tienda Online</CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <div className="space-y-1">
                         <Label className="text-xs text-slate-500">URL Base Catálogo</Label>
                         <Input 
                            value={getValue('ecommerce_url')} 
                            onChange={e => handleInputChange('ecommerce_url', e.target.value, 'ECOMMERCE')}
                            className="bg-slate-950 border-slate-800" 
                            placeholder="https://tienda.theelephantbowl.com"
                         />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-xs text-slate-500">Moneda por Defecto</Label>
                         <Input 
                            value={getValue('ecommerce_currency')} 
                            onChange={e => handleInputChange('ecommerce_currency', e.target.value, 'ECOMMERCE')}
                            className="bg-slate-950 border-slate-800" 
                            placeholder="USD"
                         />
                      </div>
                   </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-orange-500">
                   <CardHeader>
                      <CardTitle className="text-sm text-white flex items-center gap-2"><Package className="w-4 h-4 text-orange-400"/> Producto Principal (Anticipo)</CardTitle>
                      <CardDescription>Configura el producto de inscripción a cursos.</CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <div className="space-y-1">
                         <Label className="text-xs text-slate-500">ID de Producto WooCommerce</Label>
                         <Input 
                            value={getValue('main_product_id')} 
                            onChange={e => handleInputChange('main_product_id', e.target.value, 'ECOMMERCE')}
                            className="bg-slate-950 border-slate-800 font-mono" 
                            placeholder="Ej: 1483"
                         />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-xs text-slate-500">Precio del Anticipo ($)</Label>
                         <Input 
                            type="number"
                            value={getValue('main_product_price')} 
                            onChange={e => handleInputChange('main_product_price', e.target.value, 'ECOMMERCE')}
                            className="bg-slate-950 border-slate-800" 
                            placeholder="1500"
                         />
                      </div>
                   </CardContent>
                </Card>
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;