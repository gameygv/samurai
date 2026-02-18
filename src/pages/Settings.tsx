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
import { Webhook, Key, Save, Loader2, ShoppingCart, Globe, ShieldAlert, Database, Eye, Sparkles, Clock, Zap, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'ecommerce';
  
  const [configs, setConfigs] = useState<any[]>([]);
  const [followupConfig, setFollowupConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfigs();
    fetchFollowupConfig();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    const { data } = await supabase.from('app_config').select('*');
    if (data) setConfigs(data);
    setLoading(false);
  };

  const fetchFollowupConfig = async () => {
    const { data } = await supabase.from('followup_config').select('*').single();
    if (data) setFollowupConfig(data);
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

  const handleSaveFollowup = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('followup_config').upsert(followupConfig);
      if (error) throw error;
      toast.success('Configuración de Follow-ups actualizada');
    } catch (err: any) {
      toast.error(err.message);
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

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Configuración del Sistema</h1>
            <p className="text-slate-400">Control de integraciones, webhooks y parámetros de negocio.</p>
          </div>
          <Button onClick={activeTab === 'followups' ? handleSaveFollowup : handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20 px-8">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} 
            Guardar Cambios
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1">
            <TabsTrigger value="ecommerce" className="data-[state=active]:bg-indigo-600"><ShoppingCart className="w-4 h-4 mr-2" /> E-commerce</TabsTrigger>
            <TabsTrigger value="followups" className="data-[state=active]:bg-indigo-600"><Clock className="w-4 h-4 mr-2" /> Follow-ups</TabsTrigger>
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

          <TabsContent value="followups" className="mt-6 space-y-6">
             {followupConfig && (
               <>
                 <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-indigo-500">
                   <CardHeader>
                     <div className="flex items-center justify-between">
                       <div>
                         <CardTitle className="text-white flex items-center gap-2">
                           <Zap className="w-5 h-5 text-indigo-400" /> Sistema de Follow-up Automático
                         </CardTitle>
                         <CardDescription>Configuración de reintentos inteligentes y auto-reactivación post #STOP</CardDescription>
                       </div>
                       <Switch 
                         checked={followupConfig.enabled}
                         onCheckedChange={(checked) => handleFollowupChange('enabled', checked)}
                       />
                     </div>
                   </CardHeader>
                   <CardContent className="space-y-6">
                     
                     {/* Tiempos de Reintento */}
                     <div className="space-y-4">
                       <h4 className="text-sm font-bold text-white flex items-center gap-2">
                         <Clock className="w-4 h-4 text-yellow-500" /> Tiempos de Reintento Escalonados
                       </h4>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div className="space-y-2">
                           <Label className="text-xs text-slate-400">Stage 1 (minutos)</Label>
                           <Input 
                             type="number"
                             value={followupConfig.stage_1_delay}
                             onChange={e => handleFollowupChange('stage_1_delay', parseInt(e.target.value))}
                             className="bg-slate-950 border-slate-800"
                           />
                           <p className="text-[9px] text-slate-600">Primer reintento si no responde</p>
                         </div>
                         <div className="space-y-2">
                           <Label className="text-xs text-slate-400">Stage 2 (minutos)</Label>
                           <Input 
                             type="number"
                             value={followupConfig.stage_2_delay}
                             onChange={e => handleFollowupChange('stage_2_delay', parseInt(e.target.value))}
                             className="bg-slate-950 border-slate-800"
                           />
                           <p className="text-[9px] text-slate-600">Segundo reintento</p>
                         </div>
                         <div className="space-y-2">
                           <Label className="text-xs text-slate-400">Stage 3 (minutos)</Label>
                           <Input 
                             type="number"
                             value={followupConfig.stage_3_delay}
                             onChange={e => handleFollowupChange('stage_3_delay', parseInt(e.target.value))}
                             className="bg-slate-950 border-slate-800"
                           />
                           <p className="text-[9px] text-slate-600">Último reintento</p>
                         </div>
                       </div>
                     </div>

                     {/* Auto-Restart */}
                     <div className="space-y-4 bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                       <h4 className="text-sm font-bold text-white flex items-center gap-2">
                         <Zap className="w-4 h-4 text-red-500" /> Auto-Reactivación Post #STOP
                       </h4>
                       <div className="space-y-2">
                         <Label className="text-xs text-slate-400">Tiempo de espera (minutos)</Label>
                         <Input 
                           type="number"
                           value={followupConfig.auto_restart_delay}
                           onChange={e => handleFollowupChange('auto_restart_delay', parseInt(e.target.value))}
                           className="bg-slate-950 border-slate-800"
                         />
                         <p className="text-[9px] text-slate-500">Cuánto tiempo esperar después de #STOP antes de reactivar automáticamente</p>
                       </div>
                     </div>

                     {/* Horarios Permitidos */}
                     <div className="space-y-4">
                       <h4 className="text-sm font-bold text-white flex items-center gap-2">
                         <Calendar className="w-4 h-4 text-green-500" /> Horarios Permitidos
                       </h4>
                       <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <Label className="text-xs text-slate-400">Hora de Inicio</Label>
                           <Select value={followupConfig.start_hour.toString()} onValueChange={v => handleFollowupChange('start_hour', parseInt(v))}>
                             <SelectTrigger className="bg-slate-950 border-slate-800">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent className="bg-slate-900 border-slate-800 text-white">
                               {Array.from({length: 24}, (_, i) => (
                                 <SelectItem key={i} value={i.toString()}>{i}:00</SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         </div>
                         <div className="space-y-2">
                           <Label className="text-xs text-slate-400">Hora de Fin</Label>
                           <Select value={followupConfig.end_hour.toString()} onValueChange={v => handleFollowupChange('end_hour', parseInt(v))}>
                             <SelectTrigger className="bg-slate-950 border-slate-800">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent className="bg-slate-900 border-slate-800 text-white">
                               {Array.from({length: 24}, (_, i) => (
                                 <SelectItem key={i} value={i.toString()}>{i}:00</SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         </div>
                       </div>
                       
                       <div className="space-y-2">
                         <Label className="text-xs text-slate-400">Días Activos</Label>
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                           {daysOfWeek.map(day => (
                             <label key={day.value} className="flex items-center gap-2 p-2 bg-slate-950 rounded border border-slate-800 cursor-pointer hover:border-indigo-500 transition-colors">
                               <input 
                                 type="checkbox"
                                 checked={followupConfig.allowed_days?.includes(day.value)}
                                 onChange={(e) => {
                                   const newDays = e.target.checked 
                                     ? [...(followupConfig.allowed_days || []), day.value]
                                     : (followupConfig.allowed_days || []).filter((d: string) => d !== day.value);
                                   handleFollowupChange('allowed_days', newDays);
                                 }}
                                 className="rounded"
                               />
                               <span className="text-xs text-slate-300">{day.label}</span>
                             </label>
                           ))}
                         </div>
                       </div>
                     </div>

                     {/* Mensajes Personalizados */}
                     <div className="space-y-4">
                       <h4 className="text-sm font-bold text-white">Mensajes de Follow-up</h4>
                       <div className="space-y-3">
                         <div className="space-y-2">
                           <Label className="text-xs text-slate-400">Mensaje Stage 1</Label>
                           <Textarea 
                             value={followupConfig.stage_1_message}
                             onChange={e => handleFollowupChange('stage_1_message', e.target.value)}
                             className="bg-slate-950 border-slate-800 text-xs h-16"
                             placeholder="Usa {nombre} para personalizar"
                           />
                         </div>
                         <div className="space-y-2">
                           <Label className="text-xs text-slate-400">Mensaje Stage 2</Label>
                           <Textarea 
                             value={followupConfig.stage_2_message}
                             onChange={e => handleFollowupChange('stage_2_message', e.target.value)}
                             className="bg-slate-950 border-slate-800 text-xs h-16"
                           />
                         </div>
                         <div className="space-y-2">
                           <Label className="text-xs text-slate-400">Mensaje Stage 3</Label>
                           <Textarea 
                             value={followupConfig.stage_3_message}
                             onChange={e => handleFollowupChange('stage_3_message', e.target.value)}
                             className="bg-slate-950 border-slate-800 text-xs h-16"
                           />
                         </div>
                       </div>
                     </div>

                   </CardContent>
                 </Card>
               </>
             )}
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
          
          <TabsContent value="secrets" className="mt-6 space-y-6">
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

             <Card className="bg-indigo-900/10 border-indigo-500/20 border-l-4 border-l-indigo-500">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2">
                      <Eye className="w-5 h-5 text-indigo-400" /> OpenAI Vision API (Ojo de Halcón)
                      <Badge className="bg-yellow-600 text-xs">PENDIENTE</Badge>
                   </CardTitle>
                   <CardDescription>
                      Configuración para el análisis de comprobantes de pago mediante GPT-4 Vision.
                   </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="space-y-2">
                      <Label className="text-indigo-400 flex items-center gap-2">
                         <Sparkles className="w-4 h-4" /> OpenAI Vision API Key
                      </Label>
                      <Input 
                        type="password"
                        value={getValue('openai_vision_key')}
                        onChange={e => handleInputChange('openai_vision_key', e.target.value, 'SECRETS')}
                        className="bg-slate-950 border-indigo-500/30 font-mono text-xs focus:border-indigo-500"
                        placeholder="sk-proj-..."
                      />
                      <p className="text-[10px] text-slate-500 italic">
                         Esta API se usará exclusivamente para validar comprobantes de pago cuando el cliente envíe una imagen.
                      </p>
                   </div>

                   <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                      <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-2">
                         <Eye className="w-3 h-3 text-indigo-400" /> Flujo del Ojo de Halcón
                      </h4>
                      <ol className="text-[10px] text-slate-400 space-y-1 list-decimal list-inside">
                         <li>Cliente envía foto del comprobante</li>
                         <li>GPT-4 Vision extrae: Monto, Fecha, CUIT/Razón Social</li>
                         <li>Sistema compara con deuda registrada en Kommo</li>
                         <li>Si coincide (±5 pesos): Confirma pago automáticamente</li>
                         <li>Si no coincide: Escala a humano</li>
                      </ol>
                   </div>

                   <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 text-xs text-yellow-400">
                      <strong>⚠️ Estado:</strong> Infraestructura lista. Esperando instrucción para desarrollar la lógica de validación.
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