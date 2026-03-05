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
  Send, Eye, Save, Link, ArrowRight, XCircle, Map, GitMerge, RefreshCw, Briefcase, Activity, Fingerprint, Database, ShieldCheck, FlaskConical
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

  const [mapping] = useState([
    { samuraiField: 'email', metaField: 'user_data.em (SHA-256)', enabled: true, description: 'Email del prospecto' },
    { samuraiField: 'nombre', metaField: 'user_data.fn (SHA-256)', enabled: true, description: 'Nombre' },
    { samuraiField: 'apellido', metaField: 'user_data.ln (SHA-256)', enabled: true, description: 'Apellido' },
    { samuraiField: 'telefono', metaField: 'user_data.ph (SHA-256)', enabled: true, description: 'WhatsApp' },
    { samuraiField: 'ciudad', metaField: 'user_data.ct (SHA-256)', enabled: true, description: 'Ciudad extraída' },
    { samuraiField: 'id (CRM)', metaField: 'user_data.external_id', enabled: true, description: 'ID Único para deduplicación' },
  ]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: configData } = await supabase.from('app_config').select('*').in('key', ['meta_pixel_id', 'meta_access_token', 'meta_account_id', 'meta_test_mode', 'meta_test_event_code']);
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
      toast.success("Configuración de CAPI actualizada.");
    } finally {
      setSaving(false);
    }
  };

  const calculateEMQ = (event: any) => {
    const ud = event.unhashed_data?.user_data || {};
    const identifiers = [!!ud.em, !!ud.ph, !!ud.fn, !!ud.ln, !!ud.ct, !!ud.st, !!ud.zp];
    return identifiers.filter(Boolean).length;
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-indigo-900/30 rounded-xl border border-indigo-500/20">
                <BarChart3 className="w-8 h-8 text-indigo-400" />
             </div>
             <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Meta Conversions API (CAPI)</h1>
                <p className="text-slate-400 text-sm">Auditoría en tiempo real del entrenamiento de tu Pixel.</p>
             </div>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" onClick={fetchData} className="border-slate-800 text-slate-400 hover:bg-slate-800"><RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} /> Actualizar</Button>
             <Button onClick={handleSaveConfig} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-900/20"><Save className="w-4 h-4 mr-2" /> Guardar Cambios</Button>
          </div>
        </div>

        <Tabs defaultValue="bitacora" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <TabsTrigger value="bitacora" className="gap-2"><Activity className="w-4 h-4" /> Monitor de Tráfico</TabsTrigger>
            <TabsTrigger value="configuracion" className="gap-2"><Settings className="w-4 h-4" /> Credenciales</TabsTrigger>
            <TabsTrigger value="mapper" className="gap-2"><GitMerge className="w-4 h-4" /> Data Mapper</TabsTrigger>
          </TabsList>

          <TabsContent value="bitacora" className="mt-6">
            <Card className="bg-slate-900 border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 bg-slate-950/20">
                <div>
                  <CardTitle className="text-xs uppercase tracking-widest text-slate-200 font-bold">Eventos del Servidor</CardTitle>
                  <CardDescription className="text-[10px] mt-1">La IA sincroniza estos datos para optimizar tu CPA.</CardDescription>
                </div>
                <Button size="sm" onClick={() => setIsSendDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 h-9 px-4 rounded-xl font-bold text-xs">
                   <Send className="w-3 h-3 mr-2" /> DISPARO MANUAL
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 bg-slate-900/40 hover:bg-slate-900/40">
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500 pl-6">Timestamp</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500">Lead ID</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500">Evento</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500">EMQ (Match Score)</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-center">Status</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500 text-right pr-6">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={6} className="text-center h-48"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></TableCell></TableRow>
                    ) : events.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center h-48 text-slate-600 italic">No hay eventos capturados aún.</TableCell></TableRow>
                    ) : events.map(event => {
                      const emqScore = calculateEMQ(event);
                      return (
                      <TableRow key={event.id} className="border-slate-800 hover:bg-slate-800/40 transition-colors">
                        <TableCell className="text-[10px] text-slate-500 font-mono pl-6">{new Date(event.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                        <TableCell className="font-mono text-[10px] text-slate-400">{event.whatsapp_id?.substring(0,10) || 'WEB_DIRECT'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[9px] border-indigo-500/30 text-indigo-300 font-bold bg-indigo-500/5">{event.event_name}</Badge></TableCell>
                        <TableCell>
                           <div className="flex items-center gap-2">
                              <div className="flex gap-0.5">
                                 {[1,2,3,4,5,6,7].map(n => (
                                    <div key={n} className={cn("w-1.5 h-3 rounded-sm", n <= emqScore ? "bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.4)]" : "bg-slate-800")} />
                                 ))}
                              </div>
                              <span className="text-[10px] font-bold text-slate-500">{emqScore}/7</span>
                           </div>
                        </TableCell>
                        <TableCell className="text-center">
                           {event.status === 'OK' ? (
                               <div className="inline-flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> SUCCESS
                               </div>
                           ) : (
                               <div className="inline-flex items-center gap-1.5 text-[10px] text-red-500 font-bold bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                                   <div className="w-1.5 h-1.5 rounded-full bg-red-500" /> FAILED
                               </div>
                           )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button variant="ghost" size="sm" className="h-8 text-[10px] text-slate-400 hover:text-amber-500 hover:bg-amber-500/5 font-bold" onClick={() => { setSelectedEvent(event); setIsPayloadViewerOpen(true); }}>
                             <Eye className="w-3.5 h-3.5 mr-1.5" /> AUDITAR
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
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="bg-slate-900 border-slate-800 shadow-xl rounded-2xl overflow-hidden">
                    <CardHeader className="bg-slate-950/30 border-b border-slate-800">
                        <CardTitle className="text-white text-sm flex items-center gap-2 uppercase tracking-widest font-bold"><ShieldCheck className="w-4 h-4 text-emerald-500"/> Identidad del Píxel</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                       <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-slate-400">Pixel ID</Label>
                          <Input value={config.pixel_id} onChange={e => setConfig({...config, pixel_id: e.target.value})} className="bg-slate-950 border-slate-800 font-mono h-11" placeholder="Ej: 1234567890" />
                       </div>
                       <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-bold text-slate-400">Access Token (Server-Side Key)</Label>
                          <Input type="password" value={config.access_token} onChange={e => setConfig({...config, access_token: e.target.value})} className="bg-slate-950 border-slate-800 font-mono h-11" placeholder="EAA..." />
                       </div>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800 shadow-xl rounded-2xl overflow-hidden">
                    <CardHeader className="bg-slate-950/30 border-b border-slate-800">
                        <CardTitle className="text-white text-sm flex items-center gap-2 uppercase tracking-widest font-bold"><FlaskConical className="w-4 h-4 text-amber-500"/> Modo SandBox / Pruebas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                       <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                          <div className="flex items-center space-x-3">
                             <Switch checked={config.test_mode} onCheckedChange={c => setConfig({...config, test_mode: c})} />
                             <div>
                                <Label className="text-sm font-bold">Activar Sandbox</Label>
                                <p className="text-[10px] text-slate-500">Envía eventos a la pestaña "Probar Eventos" de Meta.</p>
                             </div>
                          </div>
                       </div>
                       {config.test_mode && (
                          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                             <Label className="text-[10px] uppercase font-bold text-emerald-400">Test Event Code</Label>
                             <Input 
                               value={config.test_event_code} 
                               onChange={e => setConfig({...config, test_event_code: e.target.value})} 
                               placeholder="TEST12345" 
                               className="bg-slate-950 text-xl font-mono text-center border-emerald-500/30 focus:border-emerald-500 text-emerald-400 h-14" 
                             />
                          </div>
                       )}
                    </CardContent>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="mapper" className="mt-6">
             <Card className="bg-slate-900 border-slate-800 shadow-xl rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-950/30 border-b border-slate-800">
                   <CardTitle className="text-sm uppercase tracking-widest font-bold flex items-center gap-2"><GitMerge className="w-4 h-4 text-indigo-400" /> Mapping de Atributos del Samurai</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                   <Table>
                      <TableHeader><TableRow className="border-slate-800 bg-slate-900/20"><TableHead className="text-slate-500 text-[10px] uppercase font-bold pl-6">Atributo CRM</TableHead><TableHead className="text-slate-500 text-[10px] uppercase font-bold">Campo Meta (Standard)</TableHead><TableHead className="text-slate-500 text-[10px] uppercase font-bold">Encriptación</TableHead><TableHead className="text-slate-500 text-[10px] uppercase font-bold pr-6">Función</TableHead></TableRow></TableHeader>
                      <TableBody>
                         {mapping.map((m, i) => (
                            <TableRow key={i} className="border-slate-800 hover:bg-slate-800/20">
                               <TableCell className="font-mono text-amber-500 text-[10px] font-bold pl-6">{m.samuraiField}</TableCell>
                               <TableCell className="font-mono text-indigo-400 text-[10px]">{m.metaField}</TableCell>
                               <TableCell><Badge className="bg-slate-950 text-slate-500 border-slate-800 text-[9px] uppercase font-bold">SHA-256 (Hashed)</Badge></TableCell>
                               <TableCell className="text-slate-400 text-xs italic pr-6">{m.description}</TableCell>
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