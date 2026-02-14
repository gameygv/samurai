import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Webhook, Key, Save, Loader2, ShieldAlert } from 'lucide-react';
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

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .in('category', ['WEBHOOK', 'SECRET'])
      .order('key');

    if (!error && data) {
      setConfigs(data as ConfigItem[]);
    }
    setLoading(false);
  };

  const handleInputChange = (key: string, newValue: string) => {
    setConfigs(prev => prev.map(item => 
      item.key === key ? { ...item, value: newValue } : item
    ));
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
        description: 'Actualización de configuración de sistema (Webhooks/Keys)',
        status: 'OK'
      });

      toast.success('Configuración guardada correctamente');
    } catch (error: any) {
      toast.error(`Error al guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const webhooks = configs.filter(c => c.category === 'WEBHOOK');
  const secrets = configs.filter(c => c.category === 'SECRET');

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
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Ajustes del Sistema</h1>
            <p className="text-slate-400">Conexiones externas, webhooks y llaves de seguridad.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar Cambios
          </Button>
        </div>

        <Tabs defaultValue="webhooks" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="webhooks" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              <Webhook className="w-4 h-4 mr-2" /> Webhooks (Make.com)
            </TabsTrigger>
            <TabsTrigger value="secrets" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              <Key className="w-4 h-4 mr-2" /> API Keys
            </TabsTrigger>
          </TabsList>

          <TabsContent value="webhooks" className="mt-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Conexiones a Make.com</CardTitle>
                <CardDescription>
                  Define las URLs donde el sistema enviará los datos para procesamiento.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {webhooks.length === 0 && <p className="text-slate-500 italic">No hay webhooks configurados en la base de datos.</p>}
                {webhooks.map((item) => (
                  <div key={item.key} className="space-y-2">
                    <Label className="text-slate-300 font-mono text-xs uppercase">{item.key.replace('webhook_', '').replace(/_/g, ' ')}</Label>
                    <Input 
                      value={item.value || ''}
                      onChange={(e) => handleInputChange(item.key, e.target.value)}
                      className="bg-slate-950 border-slate-800 text-indigo-400 font-mono text-sm"
                      placeholder="https://hook.us1.make.com/..."
                    />
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="secrets" className="mt-6">
            <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-red-600">
              <CardHeader>
                <div className="flex items-center gap-2 text-red-500 mb-2">
                   <ShieldAlert className="w-5 h-5" />
                   <span className="font-bold text-xs uppercase">Área Sensible</span>
                </div>
                <CardTitle className="text-white">Credenciales de API</CardTitle>
                <CardDescription>
                  Estas llaves se usan para conectar con servicios de IA.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {secrets.length === 0 && <p className="text-slate-500 italic">No hay secretos configurados.</p>}
                {secrets.map((item) => (
                  <div key={item.key} className="space-y-2">
                    <Label className="text-slate-300 font-mono text-xs uppercase">{item.key.replace(/_/g, ' ')}</Label>
                    <Input 
                      type="password"
                      value={item.value || ''}
                      onChange={(e) => handleInputChange(item.key, e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white font-mono text-sm"
                      placeholder="sk-..."
                    />
                    <p className="text-xs text-slate-500">{item.description}</p>
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