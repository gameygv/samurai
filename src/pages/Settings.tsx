import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Webhook, Key, Save, Loader2, ShoppingCart, Clock, Zap, DollarSign, Target, Link as LinkIcon, Building2, Brain, Store, Hash, PlayCircle, MessageCircle, Send, CheckCircle2, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { sendEvolutionMessage } from '@/utils/messagingService';

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
      toast.success('Configuración actualizada correctamente');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getValue = (key: string) => configs.find(c => c.key === key)?.value || '';

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

          <TabsContent value="woocommerce" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-pink-600">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-pink-600" /> Integración Tienda</CardTitle>
                   <CardDescription>Configura cómo Samurai genera los links de pago dinámicos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                         <Label>URL Base de la Tienda</Label>
                         <Input value={getValue('wc_url')} onChange={e => handleInputChange('wc_url', e.target.value, 'WOOCOMMERCE')} placeholder="https://theelephantbowl.com" className="bg-slate-950" />
                      </div>
                      <div className="space-y-2">
                         <Label>Ruta de Checkout (Slug)</Label>
                         <Input value={getValue('wc_checkout_path') || '/checkout/'} onChange={e => handleInputChange('wc_checkout_path', e.target.value, 'WOOCOMMERCE')} placeholder="Ej: /inscripciones/ o /pago/" className="bg-slate-950 border-indigo-500/30" />
                      </div>
                   </div>

                   <div className="space-y-2 pt-2 bg-slate-950 p-4 rounded border border-slate-800">
                      <Label className="text-xs text-green-500 uppercase font-bold flex items-center gap-2">
                         <Hash className="w-4 h-4" /> ID del Producto Principal
                      </Label>
                      <div className="flex flex-col gap-2">
                         <Input 
                           value={getValue('wc_product_id')} 
                           onChange={e => handleInputChange('wc_product_id', e.target.value, 'SALES')} 
                           placeholder="Déjalo en blanco si usas FunnelKit"
                           className="bg-slate-900 border-slate-700 text-white font-mono w-64" 
                         />
                         <p className="text-[11px] text-slate-400 italic">
                            <strong>Tip para FunnelKit:</strong> Si tu página de checkout (<code>/inscripciones/</code>) ya tiene el curso configurado por defecto, <strong>deja este campo vacío</strong>. Esto evita que WooCommerce recargue la página y borre los datos de auto-rellenado del cliente.
                         </p>
                      </div>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>
          
          <TabsContent value="ventas" className="mt-6">
             <div className="p-10 text-center text-slate-600">Sección de Estrategia activa.</div>
          </TabsContent>
          <TabsContent value="mensajeria" className="mt-6">
             <div className="p-10 text-center text-slate-600">Sección de Mensajería activa.</div>
          </TabsContent>
          <TabsContent value="pago_directo" className="mt-6">
             <div className="p-10 text-center text-slate-600">Sección de Depósito activa.</div>
          </TabsContent>
          <TabsContent value="secrets" className="mt-6">
             <div className="p-10 text-center text-slate-600">Sección de API Keys activa.</div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;