import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Webhook, Key, Save, Loader2, ShieldAlert, CheckCircle2, Eye, EyeOff, Info, Play, ExternalLink, Unplug } from 'lucide-react';
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
        .in('category', ['WEBHOOK', 'SECRET', 'SYSTEM'])
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

  const handleInputChange = (key: string, newValue: string) => {
    setConfigs(prev => prev.map(item => 
      item.key === key ? { ...item, value: newValue } : item
    ));
  };

  const toggleVisibility = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTestWebhook = async (url: string, key: string) => {
    if (!url) return toast.error("Ingresa una URL primero");
    setTestingWebhook(key);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test: true,
          message: "Esta es una prueba de conexión desde Samurai Panel",
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        toast.success(`Conexión exitosa con Make! Status: ${response.status}`);
      } else {
        toast.error(`Make respondió con error: ${response.status}`);
      }
    } catch (error: any) {
      toast.error(`Error de red: ${error.message}`);
    } finally {
      setTestingWebhook(null);
    }
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
          <Button 
            onClick={handleSave} 
            disabled={saving} 
            className="bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-900/20"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar Todo
          </Button>
        </div>

        <Tabs defaultValue="webhooks" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="webhooks" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              <Webhook className="w-4 h-4 mr-2" /> Webhooks & Make
            </TabsTrigger>
            <TabsTrigger value="secrets" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              <Key className="w-4 h-4 mr-2" /> API Keys (Opcional)
            </TabsTrigger>
            <TabsTrigger value="guide" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              <Info className="w-4 h-4 mr-2" /> Guía de Conexión
            </TabsTrigger>
          </TabsList>

          {/* TAB: WEBHOOKS (MAKE) */}
          <TabsContent value="webhooks" className="mt-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Conexiones Activas con Make</CardTitle>
                <CardDescription className="text-slate-400">
                  Pega aquí las URLs de tus Webhooks de Make. Usa el botón "Probar" para verificar que Make recibe datos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {webhooks.length === 0 && <p className="text-slate-500">No hay webhooks configurados en la BD. Ejecuta el SEED de configuración.</p>}
                
                {webhooks.map((item) => (
                  <div key={item.key} className="space-y-3 p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                      <div className="flex items-center justify-between">
                        <Label className="text-indigo-400 font-bold font-mono text-sm uppercase tracking-wider">
                          {item.key.replace('webhook_', '').replace(/_/g, ' ')}
                        </Label>
                        {item.value && (
                           <Badge variant="outline" className="border-green-500/30 text-green-500 bg-green-500/10 text-[10px]">
                              Configurado
                           </Badge>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Input 
                          value={item.value || ''}
                          onChange={(e) => handleInputChange(item.key, e.target.value)}
                          className="bg-slate-950 border-slate-700 text-white font-mono text-xs focus-visible:ring-indigo-500"
                          placeholder="https://hook.make.com/..."
                        />
                        <Button 
                          onClick={() => handleTestWebhook(item.value, item.key)}
                          disabled={!item.value || testingWebhook === item.key}
                          variant="secondary"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white border-0 min-w-[100px]"
                        >
                          {testingWebhook === item.key ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                            <>
                              <Play className="w-3 h-3 mr-2" /> Probar
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-2">
                        <Info className="w-3 h-3" /> {item.description}
                      </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: SECRETS (API KEYS) */}
          <TabsContent value="secrets" className="mt-6 space-y-6">
             <div className="bg-blue-900/20 border border-blue-900/50 p-4 rounded-lg flex gap-3 mb-6">
                <Info className="w-5 h-5 text-blue-400 shrink-0" />
                <p className="text-sm text-blue-200">
                   <strong>Nota:</strong> Estas llaves son almacenamiento seguro para Edge Functions. No se exponen al cliente.
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
                                 className="bg-slate-950 border-slate-700 text-white pr-10 font-mono"
                               />
                               <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-full text-slate-400 hover:text-white" onClick={() => toggleVisibility(item.key)}>
                                  {showSecrets[item.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                               </Button>
                            </div>
                         </div>
                      ))}
                   </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                   <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2"><span className="text-xl">💬</span> Kommo CRM (Opcional)</CardTitle>
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
                                 className="bg-slate-950 border-slate-700 text-white font-mono"
                               />
                               {!item.key.includes('id') && (
                                 <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-full text-slate-400 hover:text-white" onClick={() => toggleVisibility(item.key)}>
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

          {/* TAB: GUIDE (NUEVO) */}
          <TabsContent value="guide" className="mt-6">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-white">Arquitectura de Conexión</CardTitle>
                   <CardDescription>Cómo conectar los 3 cerebros (Kommo, Make, Samurai)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <div className="flex flex-col md:flex-row gap-4 items-center justify-center p-6 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="text-center">
                         <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-2 font-bold text-white">K</div>
                         <p className="text-xs font-bold text-blue-400">KOMMO</p>
                         <p className="text-[10px] text-slate-500">Recibe el WhatsApp</p>
                      </div>
                      <div className="h-0.5 w-12 bg-slate-700"></div>
                      <div className="text-center">
                         <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold text-white">M</div>
                         <p className="text-xs font-bold text-purple-400">MAKE</p>
                         <p className="text-[10px] text-slate-500">Orquesta el flujo</p>
                      </div>
                      <div className="h-0.5 w-12 bg-slate-700"></div>
                      <div className="text-center">
                         <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold text-white">S</div>
                         <p className="text-xs font-bold text-red-400">SAMURAI</p>
                         <p className="text-[10px] text-slate-500">Genera la respuesta</p>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white mt-4">Paso a Paso en Make.com</h3>
                      <ol className="list-decimal list-inside space-y-3 text-slate-300 text-sm">
                         <li>Crea un escenario nuevo.</li>
                         <li>
                            <strong>Módulo 1 (Trigger):</strong> Webhook {" > "} Custom Webhook. Copia la URL y pégala en Kommo (Digital Pipeline {" > "} Incoming Leads).
                         </li>
                         <li>
                            <strong>Módulo 2 (Samurai Context):</strong> HTTP {" > "} Make a Request.
                            <ul className="list-disc list-inside ml-6 mt-1 text-slate-400 text-xs">
                               <li>URL: <code>https://giwoovmvwlddaizorizk.supabase.co/functions/v1/get-samurai-context</code></li>
                               <li>Method: POST</li>
                               <li>Body type: Raw (JSON)</li>
                               <li>JSON: <code>{`{"message": "{{message_text}}", "lead_phone": "{{phone_number}}"}`}</code></li>
                            </ul>
                         </li>
                         <li>
                            <strong>Módulo 3 (Gemini/GPT):</strong> Usa el módulo de AI de tu preferencia.
                            <ul className="list-disc list-inside ml-6 mt-1 text-slate-400 text-xs">
                               <li>System Prompt: Usa la variable <code>system_prompt</code> que devuelve el Módulo 2.</li>
                               <li>User Message: El mensaje del cliente.</li>
                            </ul>
                         </li>
                         <li>
                            <strong>Módulo 4 (Samurai Process):</strong> HTTP {" > "} Make a Request.
                            <ul className="list-disc list-inside ml-6 mt-1 text-slate-400 text-xs">
                               <li>URL: <code>https://giwoovmvwlddaizorizk.supabase.co/functions/v1/process-samurai-response</code></li>
                               <li>JSON: <code>{`{"ai_json_response": "{{ai_output_text}}", "lead_id": "{{lead_id_from_mod_2}}"}`}</code></li>
                            </ul>
                         </li>
                         <li>
                            <strong>Módulo 5 (Respuesta):</strong> Kommo {" > "} Send a message. Envía la respuesta procesada al cliente.
                         </li>
                      </ol>
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