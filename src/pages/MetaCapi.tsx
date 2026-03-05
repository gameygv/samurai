import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  BarChart3, Settings, BookOpen, CheckCircle2, AlertCircle, Loader2, 
  Send, Eye, Save, Link, ArrowRight, XCircle, Map, GitMerge, RefreshCw, Briefcase, Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { SendEventDialog } from '@/components/meta/SendEventDialog';
import { PayloadViewer } from '@/components/meta/PayloadViewer';
import { cn } from '@/lib/utils';

const MetaCapi = () => {
  const [config, setConfig] = useState({ pixel_id: '', access_token: '', account_id: '', test_mode: false, test_event_code: '' });
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isPayloadViewerOpen, setIsPayloadViewerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const [mapping, setMapping] = useState([
    { samuraiField: 'email', metaField: 'user_data.em (SHA-256)', enabled: true, description: 'Email del prospecto' },
    { samuraiField: 'nombre', metaField: 'user_data.fn (SHA-256)', enabled: true, description: 'Nombre' },
    { samuraiField: 'apellido', metaField: 'user_data.ln (SHA-256)', enabled: true, description: 'Apellido' },
    { samuraiField: 'telefono', metaField: 'user_data.ph (SHA-256)', enabled: true, description: 'WhatsApp' },
    { samuraiField: 'ciudad', metaField: 'user_data.ct (SHA-256)', enabled: true, description: 'Ciudad extraída' },
    { samuraiField: 'estado', metaField: 'user_data.st (SHA-256)', enabled: true, description: 'Estado (Inferido)' },
    { samuraiField: 'cp', metaField: 'user_data.zp (SHA-256)', enabled: true, description: 'Código Postal (Inferido)' },
    { samuraiField: 'pais', metaField: 'user_data.country (SHA-256)', enabled: true, description: 'País (Por defecto MX)' },
    { samuraiField: 'id (Supabase)', metaField: 'user_data.external_id', enabled: true, description: 'ID Único del CRM' },
    { samuraiField: 'buying_intent', metaField: 'custom_data.intention', enabled: true, description: 'ALTO / MEDIO / BAJO' },
    { samuraiField: 'servicio_interes', metaField: 'custom_data.content_name', enabled: true, description: 'Taller/Servicio' },
    { samuraiField: 'origen_contacto', metaField: 'custom_data.lead_source', enabled: true, description: 'fb_ads, ig_organico...' },
    { samuraiField: 'main_pain', metaField: 'custom_data.main_pain', enabled: true, description: 'Dolor principal a sanar' },
    { samuraiField: 'tiempo_compra', metaField: 'custom_data.time_to_buy', enabled: true, description: 'Urgencia temporal' },
    { samuraiField: 'lead_score', metaField: 'custom_data.lead_score', enabled: true, description: 'Calidad 1-100' },
  ]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: configData } = await supabase.from('app_config').select('*').in('key', ['meta_pixel_id', 'meta_access_token', 'meta_account_id', 'meta_test_mode', 'meta_test_event_code', 'meta_capi_mapping']);
      const { data: eventsData } = await supabase.from('meta_capi_events').select('*').order('created_at', { ascending: false }).limit(50);

      if (configData) {
        const newConfig = { ...config };
        configData.forEach(item => {
          if (item.key === 'meta_pixel_id') newConfig.pixel_id = item.value;
          if (item.key === 'meta_access_token') newConfig.access_token = item.value;
          if (item.key === 'meta_account_id') newConfig.account_id = item.value;
          if (item.key === 'meta_test_mode') newConfig.test_mode = item.value === 'true';
          if (item.key === 'meta_test_event_code') newConfig.test_event_code = item.value;
        });
        setConfig(newConfig);
      }
      if (eventsData) setEvents(eventsData);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const configToSave = [
        { key: 'meta_pixel_id', value: config.pixel_id, category: 'META_CAPI' },
        { key: 'meta_access_token', value: config.access_token, category: 'META_CAPI' },
        { key: 'meta_account_id', value: config.account_id, category: 'META_CAPI' }, 
        { key: 'meta_test_mode', value: String(config.test_mode), category: 'META_CAPI' },
        { key: 'meta_test_event_code', value: config.test_event_code, category: 'META_CAPI' },
      ];
      await supabase.from('app_config').upsert(configToSave, { onConflict: 'key' });
      toast.success("Configuración guardada correctamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-indigo-500" /> Meta Conversions API
            </h1>
            <p className="text-slate-400">Control total del entrenamiento de tu algoritmo de anuncios.</p>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" onClick={fetchData} className="border-slate-800 text-slate-400"><RefreshCw className="w-4 h-4 mr-2" /> Actualizar</Button>
             <Button onClick={handleSaveConfig} disabled={saving} className="bg-indigo-600"><Save className="w-4 h-4 mr-2" /> Guardar Cambios</Button>
          </div>
        </div>

        <Tabs defaultValue="bitacora" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="bitacora"><BookOpen className="w-4 h-4 mr-2" /> Bitácora de Eventos</TabsTrigger>
            <TabsTrigger value="configuracion"><Settings className="w-4 h-4 mr-2" /> Configuración</TabsTrigger>
            <TabsTrigger value="mapper"><GitMerge className="w-4 h-4 mr-2" /> Data Mapper</TabsTrigger>
          </TabsList>

          <TabsContent value="bitacora" className="mt-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800">
                <div>
                  <CardTitle className="text-sm uppercase tracking-widest text-white">Eventos Server-Side</CardTitle>
                  <CardDescription>La IA envía estos datos automáticamente para bajar tu CPA.</CardDescription>
                </div>
                <Button size="sm" onClick={() => setIsSendDialogOpen(true)} className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white">
                   <Send className="w-3 h-3 mr-2" /> Test Manual
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 bg-slate-950/20">
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500">Fecha</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500">WhatsApp ID</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500">Evento</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500">Calidad (EMQ)</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-center">Estatus</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={6} className="text-center h-32"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                    ) : events.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center h-32 text-slate-600 italic">No hay eventos registrados aún.</TableCell></TableRow>
                    ) : events.map(event => {
                      // Calcular EMQ en base a datos crudos
                      const ud = event.unhashed_data?.user_data || {};
                      const fields = [true, !!ud.em, !!ud.fn, !!ud.ln, !!ud.ct, !!ud.st, !!ud.zp];
                      const emqScore = fields.filter(Boolean).length;

                      return (
                      <TableRow key={event.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                        <TableCell className="text-[10px] text-slate-500 font-mono">{new Date(event.created_at).toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-300">{event.whatsapp_id}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[9px] border-indigo-500/30 text-indigo-400 font-bold">{event.event_name}</Badge></TableCell>
                        <TableCell>
                           <div className="flex items-center gap-2">
                              <div className="flex gap-0.5">
                                 {[1,2,3,4,5,6,7].map(n => (
                                    <div key={n} className={cn("w-1.5 h-3 rounded-sm", n <= emqScore ? "bg-amber-500" : "bg-slate-800")} />
                                 ))}
                              </div>
                              <span className="text-[9px] text-slate-500 font-mono">{emqScore}/7</span>
                           </div>
                        </TableCell>
                        <TableCell className="text-center">
                           {event.status === 'OK' ? <div className="w-2 h-2 rounded-full bg-green-500 mx-auto shadow-[0_0_8px_rgba(34,197,94,0.5)]" /> : <div className="w-2 h-2 rounded-full bg-red-500 mx-auto" />}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-7 text-[10px] text-slate-400 hover:text-white" onClick={() => { setSelectedEvent(event); setIsPayloadViewerOpen(true); }}>
                             <Activity className="w-3 h-3 mr-1 text-amber-500" /> AUDITAR
                          </Button>
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="configuracion" className="mt-6">
             <Card className="bg-slate-900 border-slate-800 shadow-xl">
                <CardHeader><CardTitle className="text-white text-lg">Credenciales API Meta</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                   <div className="space-y-2">
                      <Label>Pixel ID</Label>
                      <Input 
                        value={config.pixel_id} 
                        onChange={e => setConfig({...config, pixel_id: e.target.value})} 
                        className="bg-slate-950 border-slate-800 font-mono" 
                        placeholder="Ej: 1234567890"
                      />
                   </div>
                   
                   <div className="space-y-2">
                      <Label className="flex items-center gap-2">Ad Account ID <span className="text-[10px] text-slate-500 font-normal">(Opcional, para referencia administrativa)</span></Label>
                      <div className="relative">
                         <Briefcase className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                         <Input 
                           value={config.account_id} 
                           onChange={e => setConfig({...config, account_id: e.target.value})} 
                           className="pl-9 bg-slate-950 border-slate-800 font-mono" 
                           placeholder="act_123456789"
                         />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <Label>Access Token (System User)</Label>
                      <Input 
                        type="password" 
                        value={config.access_token} 
                        onChange={e => setConfig({...config, access_token: e.target.value})} 
                        className="bg-slate-950 border-slate-800 font-mono" 
                        placeholder="EAA..."
                      />
                   </div>

                   <div className="flex items-center justify-between pt-4 p-4 bg-slate-950 rounded border border-slate-800">
                      <div className="flex items-center space-x-3">
                         <Switch checked={config.test_mode} onCheckedChange={c => setConfig({...config, test_mode: c})} />
                         <div>
                            <Label>Modo Test (Sandbox)</Label>
                            <p className="text-[10px] text-slate-500">Activa esto para ver eventos en la herramienta "Test Events" de Meta.</p>
                         </div>
                      </div>
                      {config.test_mode && (
                         <div className="w-48">
                            <Input 
                              value={config.test_event_code} 
                              onChange={e => setConfig({...config, test_event_code: e.target.value})} 
                              placeholder="TEST12345" 
                              className="bg-slate-900 text-xs font-mono text-center border-slate-700 focus:border-green-500 text-green-400" 
                            />
                         </div>
                      )}
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="mapper" className="mt-6">
             <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                   <CardTitle className="text-sm">Advanced Matching Activo</CardTitle>
                   <CardDescription>Estos datos se extraen automáticamente de la conversación por el "Analista CAPI" y se envían a Meta.</CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                   <Table>
                      <TableHeader>
                         <TableRow className="border-slate-800 bg-slate-950/50">
                            <TableHead className="text-slate-500 text-[10px] uppercase font-bold">Columna Local</TableHead>
                            <TableHead className="text-slate-500 text-[10px] uppercase font-bold">Propiedad Meta</TableHead>
                            <TableHead className="text-slate-500 text-[10px] uppercase font-bold">Descripción</TableHead>
                         </TableRow>
                      </TableHeader>
                      <TableBody>
                         {mapping.map((m, i) => (
                            <TableRow key={i} className="border-slate-800">
                               <TableCell className="font-mono text-amber-500 text-[10px] font-bold">{m.samuraiField}</TableCell>
                               <TableCell className="font-mono text-indigo-400 text-[10px]">{m.metaField}</TableCell>
                               <TableCell className="text-slate-400 text-xs italic">{m.description}</TableCell>
                            </TableRow>
                         ))}
                      </TableBody>
                   </Table>
                </CardContent>
             </Card>
          </TabsContent>
        </Tabs>

        <SendEventDialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen} config={config} onSuccess={fetchData} />
        <PayloadViewer open={isPayloadViewerOpen} onOpenChange={setIsPayloadViewerOpen} event={selectedEvent} />
      </div>
    </Layout>
  );
};

export default MetaCapi;