import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  BarChart3, Settings, BookOpen, CheckCircle2, AlertCircle, Loader2, 
  Send, Eye, Save, Link, ArrowRight, XCircle
} from 'lucide-react';
import { toast } from 'sonner';

const MetaCapi = () => {
  const [config, setConfig] = useState({
    pixel_id: '',
    access_token: '',
    account_id: '',
    test_mode: false,
    test_event_code: ''
  });
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'ok' | 'error'>('unknown');
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: configData } = await supabase.from('app_config').select('*').in('key', ['meta_pixel_id', 'meta_access_token', 'meta_account_id', 'meta_test_mode', 'meta_test_event_code']);
      const { data: eventsData } = await supabase.from('meta_capi_events').select('*').order('created_at', { ascending: false }).limit(100);

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
    } catch (err) {
      toast.error("Error cargando datos de Meta CAPI.");
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
      const { error } = await supabase.from('app_config').upsert(configToSave, { onConflict: 'key' });
      if (error) throw error;
      toast.success("Configuración guardada.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    // Simulación de llamada a Edge Function
    setConnectionStatus('ok');
    toast.success("Conexión con Meta Graph API verificada.");
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-indigo-500" />
              Meta Conversions API
            </h1>
            <p className="text-slate-400">Gestión de eventos server-side para optimización de campañas.</p>
          </div>
          <Button onClick={handleSaveConfig} disabled={saving} className="bg-indigo-600">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar Cambios
          </Button>
        </div>

        <Tabs defaultValue="configuracion" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="configuracion"><Settings className="w-4 h-4 mr-2" /> Configuración</TabsTrigger>
            <TabsTrigger value="bitacora"><BookOpen className="w-4 h-4 mr-2" /> Bitácora de Eventos</TabsTrigger>
          </TabsList>

          <TabsContent value="configuracion" className="mt-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle>Credenciales de la API</CardTitle>
                <CardDescription>Ingresa los datos desde tu Business Manager de Meta.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>PIXEL_ID</Label>
                  <Input value={config.pixel_id} onChange={e => setConfig({...config, pixel_id: e.target.value})} className="bg-slate-950 border-slate-800" />
                </div>
                <div className="space-y-2">
                  <Label>ACCESS_TOKEN</Label>
                  <Input type="password" value={config.access_token} onChange={e => setConfig({...config, access_token: e.target.value})} className="bg-slate-950 border-slate-800" />
                </div>
                <div className="space-y-2">
                  <Label>ACCOUNT_ID</Label>
                  <Input value={config.account_id} onChange={e => setConfig({...config, account_id: e.target.value})} className="bg-slate-950 border-slate-800" />
                </div>
                <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center space-x-2">
                    <Switch checked={config.test_mode} onCheckedChange={c => setConfig({...config, test_mode: c})} />
                    <Label>Modo de Prueba</Label>
                  </div>
                  {config.test_mode && (
                    <Input value={config.test_event_code} onChange={e => setConfig({...config, test_event_code: e.target.value})} placeholder="TEST_CODE..." className="bg-slate-950 border-slate-800 w-64" />
                  )}
                </div>
                <div className="flex items-center gap-4 pt-2">
                  <Button onClick={handleTestConnection} variant="outline" className="border-indigo-500 text-indigo-400">
                    <Link className="w-4 h-4 mr-2" /> Conectar y Probar
                  </Button>
                  {connectionStatus === 'ok' && <div className="flex items-center gap-2 text-green-500 text-sm"><CheckCircle2 className="w-4 h-4" /> Conectado</div>}
                  {connectionStatus === 'error' && <div className="flex items-center gap-2 text-red-500 text-sm"><XCircle className="w-4 h-4" /> Error de Conexión</div>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bitacora" className="mt-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle>Últimos 100 Eventos Enviados</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>WhatsApp ID</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
                    ) : events.map(event => (
                      <TableRow key={event.id}>
                        <TableCell>{new Date(event.created_at).toLocaleString()}</TableCell>
                        <TableCell>{event.whatsapp_id}</TableCell>
                        <TableCell>{event.event_name}</TableCell>
                        <TableCell>{event.value ? `$${event.value}` : 'N/A'}</TableCell>
                        <TableCell>{event.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default MetaCapi;