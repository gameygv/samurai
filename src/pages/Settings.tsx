import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Webhook, Key, Save, Loader2, ShoppingCart, Globe, ShieldAlert, Database } from 'lucide-react';
import { toast } from 'sonner';

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'ecommerce';
  
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    const { data } = await supabase.from('app_config').select('*');
    if (data) setConfigs(data);
    setLoading(false);
  };

  const handleInputChange = (key: string, value: string, category: string = 'SYSTEM') => {
    setConfigs(prev => {
      const exists = prev.find(c => c.key === key);
      if (exists) return prev.map(c => c.key === key ? { ...c, value } : c);
      return [...prev, { key, value, category }];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('app_config').upsert(configs);
      if (error) throw error;
      toast.success('Configuración global actualizada');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getValue = (key: string) => configs.find(c => c.key === key)?.value || '';

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Configuración del Sistema</h1>
            <p className="text-slate-400">Control de integraciones, webhooks y parámetros de negocio.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20 px-8">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} 
            Guardar Cambios
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1">
            <TabsTrigger value="ecommerce" className="data-[state=active]:bg-indigo-600"><ShoppingCart className="w-4 h-4 mr-2" /> E-commerce</TabsTrigger>
            <TabsTrigger value="webhooks" className="data-[state=active]:bg-indigo-600"><Webhook className="w-4 h-4 mr-2" /> Webhooks</TabsTrigger>
            <TabsTrigger value="secrets" className="data-[state=active]:bg-indigo-600"><Key className="w-4 h-4 mr-2" /> API Keys</TabsTrigger>
          </TabsList>

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

                <Card className="bg-slate-900 border-slate-800">
                   <CardHeader>
                      <CardTitle className="text-sm text-white flex items-center gap-2"><Database className="w-4 h-4 text-emerald-400"/> Parámetros de Ventas</CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      <div className="space-y-1">
                         <Label className="text-xs text-slate-500">Descuento Máximo Autorizado (%)</Label>
                         <Input 
                            type="number"
                            value={getValue('sales_max_discount')} 
                            onChange={e => handleInputChange('sales_max_discount', e.target.value, 'SALES')}
                            className="bg-slate-950 border-slate-800" 
                         />
                      </div>
                   </CardContent>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="webhooks" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-yellow-500">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-yellow-500" /> Webhook Intervención Humana
                   </CardTitle>
                   <CardDescription>Esta URL se disparará cuando el Samurai decida que un humano debe intervenir.</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="space-y-2">
                      <Label>Make.com Hook URL</Label>
                      <Input 
                        value={getValue('webhook_human_handoff')}
                        onChange={e => handleInputChange('webhook_human_handoff', e.target.value, 'WEBHOOK')}
                        className="bg-slate-950 border-slate-800 font-mono text-xs"
                        placeholder="https://hook.make.com/..."
                      />
                   </div>
                </CardContent>
             </Card>
          </TabsContent>
          
          <TabsContent value="secrets" className="mt-6">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-white">API Keys & Tokens</CardTitle>
                   <CardDescription>Tokens de seguridad para servicios externos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="space-y-1">
                      <Label className="text-xs text-slate-500">OpenAI API Key (Opcional si usas Edge Functions)</Label>
                      <Input 
                        type="password"
                        value={getValue('openai_api_key')}
                        onChange={e => handleInputChange('openai_api_key', e.target.value, 'SECRETS')}
                        className="bg-slate-950 border-slate-800 font-mono text-xs"
                        placeholder="sk-..."
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