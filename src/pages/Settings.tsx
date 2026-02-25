import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Webhook, Key, Save, Loader2, ShoppingCart, Clock, Zap, DollarSign, Target } from 'lucide-react';
import { toast } from 'sonner';

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'ventas';
  
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      toast.success('Configuración de ventas actualizada');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
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
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1">
            <TabsTrigger value="ventas" className="gap-2"><Target className="w-4 h-4"/> Estrategia de Venta</TabsTrigger>
            <TabsTrigger value="secrets" className="gap-2"><Key className="w-4 h-4"/> API Keys</TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2"><Webhook className="w-4 h-4"/> Webhooks</TabsTrigger>
          </TabsList>

          <TabsContent value="ventas" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-orange-500">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><DollarSign className="w-5 h-5 text-orange-500" /> Secuencia de Recordatorio de Pago</CardTitle>
                   <CardDescription>Tiempos de espera para re-contactar tras enviar el link de reserva.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
                   <div className="space-y-2">
                      <Label className="text-xs text-slate-500 uppercase">Intento 1 (horas)</Label>
                      <Input type="number" value={getValue('sales_reminder_1') || '24'} onChange={e => handleInputChange('sales_reminder_1', e.target.value, 'SALES')} className="bg-slate-950" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-xs text-slate-500 uppercase">Intento 2 (horas)</Label>
                      <Input type="number" value={getValue('sales_reminder_2') || '48'} onChange={e => handleInputChange('sales_reminder_2', e.target.value, 'SALES')} className="bg-slate-950" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-xs text-slate-500 uppercase">Intento 3 (horas)</Label>
                      <Input type="number" value={getValue('sales_reminder_3') || '72'} onChange={e => handleInputChange('sales_reminder_3', e.target.value, 'SALES')} className="bg-slate-950" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-xs text-slate-500 uppercase">Intento 4 (días)</Label>
                      <Input type="number" value={getValue('sales_reminder_4') || '7'} onChange={e => handleInputChange('sales_reminder_4', e.target.value, 'SALES')} className="bg-slate-950" />
                   </div>
                </CardContent>
                <div className="p-4 bg-orange-500/5 border-t border-slate-800">
                   <p className="text-[10px] text-orange-400 italic">Si tras el 4to intento no hay pago ni respuesta, el lead pasará automáticamente a estado "PERDIDO".</p>
                </div>
             </Card>
          </TabsContent>
          
          <TabsContent value="secrets" className="mt-6"><Card className="bg-slate-900 border-slate-800"><CardHeader><CardTitle>Tokens de Integración</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Gemini API Key</Label><Input type="password" value={getValue('gemini_api_key')} onChange={e => handleInputChange('gemini_api_key', e.target.value, 'SECRET')} className="bg-slate-950"/></div></CardContent></Card></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;