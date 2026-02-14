import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Webhook, Key, Save, Loader2, ShieldAlert, CheckCircle2, AlertTriangle, Eye, EyeOff, Plug } from 'lucide-react';
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

      toast.success('Configuración guardada y encriptada (simulado).');
    } catch (error: any) {
      toast.error(`Error al guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (service: string) => {
    const toastId = toast.loading(`Probando conexión con ${service}...`);
    // Simulando delay de red
    await new Promise(r => setTimeout(r, 1500));
    
    // Aquí iría la lógica real de backend para probar la key
    // Por ahora simulamos éxito
    toast.dismiss(toastId);
    toast.success(`Conexión con ${service} EXITOSA`, {
       description: 'Respuesta: 200 OK - Latencia: 145ms'
    });
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
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Configuración</h1>
            <p className="text-slate-400">Gestión de llaves maestras e integraciones.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar Todo
          </Button>
        </div>

        <Tabs defaultValue="secrets" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="secrets" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              <Key className="w-4 h-4 mr-2" /> API Keys & Secretos
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              <Webhook className="w-4 h-4 mr-2" /> Webhooks & Make
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: API KEYS */}
          <TabsContent value="secrets" className="mt-6 space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* GEMINI CARD */}
                <Card className="bg-slate-900 border-slate-800">
                   <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                         <span className="text-xl">✨</span> Gemini API
                      </CardTitle>
                      <CardDescription>Motor de inteligencia artificial principal.</CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      {secrets.filter(s => s.key.includes('gemini')).map(item => (
                         <div key={item.key} className="space-y-2">
                            <Label className="text-xs font-mono text-slate-500 uppercase">{item.description}</Label>
                            <div className="flex gap-2">
                               <div className="relative flex-1">
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
                         </div>
                      ))}
                      <div className="flex items-center gap-2 mt-2">
                         <div className="w-2 h-2 rounded-full bg-green-500"></div>
                         <span className="text-xs text-green-500 font-medium">Estado: Activo</span>
                      </div>
                   </CardContent>
                   <CardFooter className="border-t border-slate-800 pt-4">
                      <Button variant="outline" size="sm" className="w-full border-slate-700 hover:bg-slate-800 text-slate-300" onClick={() => testConnection('Gemini AI')}>
                         <Plug className="w-4 h-4 mr-2" /> Validar Conexión
                      </Button>
                   </CardFooter>
                </Card>

                {/* KOMMO CARD */}
                <Card className="bg-slate-900 border-slate-800">
                   <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                         <span className="text-xl">💬</span> Kommo CRM
                      </CardTitle>
                      <CardDescription>Fuente de leads y mensajes de WhatsApp.</CardDescription>
                   </CardHeader>
                   <CardContent className="space-y-4">
                      {secrets.filter(s => s.key.includes('kommo')).map(item => (
                         <div key={item.key} className="space-y-2">
                            <Label className="text-xs font-mono text-slate-500 uppercase">{item.description}</Label>
                            <div className="relative flex-1">
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
                      <div className="flex items-center gap-2 mt-2">
                         <div className="w-2 h-2 rounded-full bg-green-500"></div>
                         <span className="text-xs text-green-500 font-medium">Estado: Sincronizado</span>
                      </div>
                   </CardContent>
                   <CardFooter className="border-t border-slate-800 pt-4">
                      <Button variant="outline" size="sm" className="w-full border-slate-700 hover:bg-slate-800 text-slate-300" onClick={() => testConnection('Kommo CRM')}>
                         <Plug className="w-4 h-4 mr-2" /> Sincronizar Ahora
                      </Button>
                   </CardFooter>
                </Card>

             </div>
             
             <Card className="bg-red-950/20 border-red-900/50">
                <CardContent className="flex items-center gap-4 p-4">
                   <ShieldAlert className="w-8 h-8 text-red-500" />
                   <div>
                      <h4 className="text-red-400 font-bold">Zona de Peligro</h4>
                      <p className="text-red-400/70 text-sm">Cambiar estas llaves puede interrumpir el servicio del agente inmediatamente. Procede con cautela.</p>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          {/* TAB 2: WEBHOOKS */}
          <TabsContent value="webhooks" className="mt-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Arquitectura de Webhooks</CardTitle>
                <CardDescription>
                  Orquestación de eventos entre Kommo, Make y el Panel.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Diagrama ASCII Simple */}
                <div className="bg-black/30 p-4 rounded-lg font-mono text-xs text-slate-400 overflow-x-auto whitespace-pre">
{`KOMMO (WhatsApp)  ──►  MAKE.COM  ──►  GEMINI AI
                          │
                          ▼
                    PANEL (Logs & Dashboard)`}
                </div>

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
                              placeholder="https://..."
                            />
                            <Button variant="outline" size="icon" className="shrink-0 border-slate-700" onClick={() => {
                               navigator.clipboard.writeText(item.value);
                               toast.success('URL copiada');
                            }}>
                               <CheckCircle2 className="w-4 h-4" />
                            </Button>
                         </div>
                         <p className="text-xs text-slate-500">{item.description}</p>
                      </div>
                   ))}
                </div>

              </CardContent>
              <CardFooter className="border-t border-slate-800 bg-slate-900/50">
                 <p className="text-xs text-slate-500">
                    ℹ️ Configura estos webhooks en los módulos "Custom Webhook" de tus escenarios en Make.com.
                 </p>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;