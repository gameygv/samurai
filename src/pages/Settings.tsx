import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Webhook, Key, Save, Loader2, Info, Play, Eye, EyeOff, ShoppingCart, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

interface ConfigItem {
  key: string;
  value: string;
  category: string;
  description: string;
}

const Settings = () => {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('*')
        .order('key');

      if (!error && data) {
        setConfigs(data as ConfigItem[]);
      }
    } catch (err) {
      console.error("Error fetching configs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (key: string, newValue: string, category: string = 'SYSTEM') => {
    setConfigs(prev => {
        const existing = prev.find(i => i.key === key);
        if (existing) {
            return prev.map(item => item.key === key ? { ...item, value: newValue } : item);
        } else {
            return [...prev, { key, value: newValue, category, description: `Configuración de ${key}` }];
        }
    });
  };

  const toggleVisibility = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = configs.map(item => ({
        key: item.key,
        value: item.value,
        category: item.category,
        description: item.description,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('app_config')
        .upsert(updates);

      if (error) throw error;

      await logActivity({
        action: 'UPDATE',
        resource: 'SYSTEM',
        description: 'Actualización de configuración de ventas y API',
        status: 'OK'
      });

      toast.success('Configuración de The Elephant Bowl guardada.');
    } catch (error: any) {
      toast.error(`Error al guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const getConfig = (key: string) => configs.find(c => c.key === key)?.value || '';

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Configuración Samurai</h1>
            <p className="text-slate-400">Integración con WooCommerce y Base de Datos.</p>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={saving} 
            className="bg-green-600 hover:bg-green-700 text-white font-bold"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar Cambios
          </Button>
        </div>

        <Tabs defaultValue="ecommerce" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="ecommerce" className="data-[state=active]:bg-indigo-600">
               <ShoppingCart className="w-4 h-4 mr-2" /> E-commerce
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="data-[state=active]:bg-indigo-600">
              <Webhook className="w-4 h-4 mr-2" /> Webhooks
            </TabsTrigger>
            <TabsTrigger value="secrets" className="data-[state=active]:bg-indigo-600">
              <Key className="w-4 h-4 mr-2" /> API Keys
            </TabsTrigger>
          </TabsList>

          {/* TAB: E-COMMERCE (NUEVO) */}
          <TabsContent value="ecommerce" className="mt-6">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-white">The Elephant Bowl - Ventas Directas</CardTitle>
                   <CardDescription>Configura el producto de apartado para que el Samurai genere links de pago.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                         <Label className="text-indigo-400">URL de la Tienda (Checkout)</Label>
                         <div className="flex gap-2">
                            <Globe className="w-5 h-5 text-slate-600 mt-2" />
                            <Input 
                               value={getConfig('shop_base_url') || 'https://theelephantbowl.com/finalizar-compra/'}
                               onChange={(e) => handleInputChange('shop_base_url', e.target.value, 'SYSTEM')}
                               className="bg-slate-950 border-slate-800 font-mono text-xs"
                            />
                         </div>
                      </div>
                      <div className="space-y-2">
                         <Label className="text-indigo-400">ID Producto: Apartado $1500</Label>
                         <div className="flex gap-2">
                            <ShoppingCart className="w-5 h-5 text-slate-600 mt-2" />
                            <Input 
                               value={getConfig('reservation_product_id')}
                               onChange={(e) => handleInputChange('reservation_product_id', e.target.value, 'SYSTEM')}
                               placeholder="Ej: 4521"
                               className="bg-slate-950 border-slate-800 font-mono text-xs"
                            />
                         </div>
                         <p className="text-[10px] text-slate-500 italic">Puedes encontrar este ID en tu lista de productos de WooCommerce.</p>
                      </div>
                   </div>

                   <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                      <h4 className="text-xs font-bold text-indigo-400 mb-2 flex items-center gap-2">
                         <Zap className="w-3 h-3"/> Generación Automática
                      </h4>
                      <p className="text-xs text-slate-400">
                         El Samurai usará estos datos para enviar este link cuando el cliente esté listo:
                      </p>
                      <code className="block bg-black p-2 mt-2 rounded text-[10px] text-green-500 font-mono">
                         {getConfig('shop_base_url') || 'https://theelephantbowl.com/finalizar-compra/'}?add-to-cart={getConfig('reservation_product_id') || 'ID'}
                      </code>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          {/* TAB: WEBHOOKS */}
          <TabsContent value="webhooks" className="mt-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Webhooks de Make.com</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 {configs.filter(c => c.category === 'WEBHOOK').map((item) => (
                    <div key={item.key} className="space-y-2">
                       <Label className="text-xs font-mono uppercase text-slate-500">{item.key}</Label>
                       <Input 
                          value={item.value}
                          onChange={(e) => handleInputChange(item.key, e.target.value, 'WEBHOOK')}
                          className="bg-slate-950 border-slate-800"
                       />
                    </div>
                 ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: SECRETS */}
          <TabsContent value="secrets" className="mt-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Llaves de API</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 {configs.filter(c => c.category === 'SECRET').map((item) => (
                    <div key={item.key} className="space-y-2">
                       <Label className="text-xs font-mono uppercase text-slate-500">{item.key}</Label>
                       <div className="relative">
                          <Input 
                             type={showSecrets[item.key] ? "text" : "password"}
                             value={item.value}
                             onChange={(e) => handleInputChange(item.key, e.target.value, 'SECRET')}
                             className="bg-slate-950 border-slate-800 pr-10"
                          />
                          <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => toggleVisibility(item.key)}>
                             {showSecrets[item.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                       </div>
                    </div>
                 ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;