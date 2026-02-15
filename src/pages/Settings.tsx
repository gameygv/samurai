import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Webhook, Key, Save, Loader2, ShieldAlert, CheckCircle2, Eye, EyeOff, Info } from 'lucide-react';
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
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .in('category', ['WEBHOOK', 'SECRET', 'SYSTEM'])
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
        description: 'Actualización de credenciales del sistema',
        status: 'OK'
      });

      toast.success('Configuración guardada correctamente.');
    } catch (error: any) {
      toast.error(`Error al guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const webhooks = configs.filter(c => c.category === 'WEBHOOK');
  const secrets = configs.filter(c => c.category === 'SECRET');

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Configuración</h1>
            <p className="text-slate-400">Gestión de llaves maestras e integraciones.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar Todo
          </Button>
        </div>

        <Tabs defaultValue="secrets" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="secrets"><Key className="w-4 h-4 mr-2" /> API Keys (Opcional)</TabsTrigger>
            <TabsTrigger value="webhooks"><Webhook className="w-4 h-4 mr-2" /> Webhooks & Make</TabsTrigger>
          </TabsList>

          <TabsContent value="secrets" className="mt-6 space-y-6">
             <div className="bg-blue-900/20 border border-blue-900/50 p-4 rounded-lg flex gap-3 mb-6">
                <Info className="w-5 h-5 text-blue-400 shrink-0" />
                <p className="text-sm text-blue-200">
                   <strong>Nota:</strong> Estas llaves NO se usan para la conexión con Make. Son un almacenamiento seguro por si necesitas usarlas en Edge Functions personalizadas.
                </p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-slate-900 border-slate-800">
                   <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2"><span className="text-xl">✨</span> Gemini API</CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      {secrets.filter(s => s.key.includes('gemini')).map(item => (
                         <div key={item.key} className="space-y-2">
                            <Label className="text-xs font-mono text-slate-500 uppercase">{item.description}</Label>
                            <div className="relative">
                               <Input 
                                 type={showSecrets[item.key] ? "text" : "password"}
                                 value={item.value || ''}
                                 onChange={(e) => handleInputChange(item.key, e.target.value)}
                                 className="bg-slate-950 border-slate-800 pr-10 font-mono"
                               />
                               <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-full text-slate-500 hover:text-white" onClick={() => toggleVisibility(item.key)}>
                                  {showSecrets[item.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                               </Button>
                            </div>
                         </div>
                      ))}
                   </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                   <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2"><span className="text-xl">💬</span> Kommo CRM</CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      {secrets.filter(s => s.key.includes('kommo')).map(item => (
                         <div key={item.key} className="space-y-2">
                            <Label className="text-xs font-mono text-slate-500 uppercase">{item.description}</Label>
                            <div className="relative">
                               <Input 
                                 type={showSecrets[item.key] || item.key.includes('id') ? "text" : "password"}
                                 value={item.value || ''}
                                 onChange={(e) => handleInputChange(item.key, e.target.value)}
                                 className="bg-slate-950 border-slate-800 font-mono"
                               />
                               {!item.key.includes('id') && (
                                 <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-full text-slate-500 hover:text-white" onClick={() => toggleVisibility(item.key)}>
                                    {showSecrets[item.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                 </Button>
                               )}
                            </div>
                         </div>
                      ))}
                   </CardContent>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="webhooks" className="mt-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Conexiones Activas con Make</CardTitle>
                <CardDescription>
                  Pega aquí las URLs de tus Webhooks de Make para conectar las funcionalidades.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-6">
                   {webhooks.map((item) => (
                      <div key={item.key} className="space-y-2">
                         <div className="flex items-center justify-between">
                            <Label className="text-indigo-400 font-mono text-sm uppercase">{item.key.replace('webhook_', '').replace(/_/g, ' ')}</Label>
                            <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">POST</span>
                         </div>
                         <div className="flex gap-2">
                            <Input 
                              value={item.value || ''}
                              onChange={(e) => handleInputChange(item.key, e.target.value)}
                              className="bg-slate-950 border-slate-800 text-slate-300 font-mono text-xs"
                              placeholder="https://hook.make.com/..."
                            />
                         </div>
                         <p className="text-xs text-slate-500">{item.description}</p>
                      </div>
                   ))}
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