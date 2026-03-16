import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Key, Save, Loader2, Store, Send, Clock, Building2, MessageSquarePlus, TerminalSquare, ShieldAlert, Smartphone, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

// Import Modulares
import { BankTab, SecretsTab } from '@/components/settings/BankAndSecretsTabs';
import { TemplatesTab } from '@/components/settings/TemplatesTab';
import { FollowupTab } from '@/components/settings/FollowupTab';
import { WooCommerceTab } from '@/components/settings/WooCommerceTab';
import { KernelTab } from '@/components/settings/KernelTab';
import { ChannelsTab } from '@/components/settings/ChannelsTab';

const Settings = () => {
  const { isAdmin, isDev } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'canales';
  
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [globalBotPaused, setGlobalBotPaused] = useState(false);

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    const { data } = await supabase.from('app_config').select('*');
    if (data) {
        setConfigs(data);
        setGlobalBotPaused(data.find(c => c.key === 'global_bot_paused')?.value === 'true');
    }
    setLoading(false);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const updates = configs.map(c => ({ key: c.key, value: c.value, category: c.category || 'SYSTEM' }));
      updates.push({ key: 'global_bot_paused', value: String(globalBotPaused), category: 'SYSTEM' });
      
      const { error } = await supabase.from('app_config').upsert(updates, { onConflict: 'key' });
      if (error) throw error;
      toast.success('Configuración global actualizada.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getValue = (key: string) => configs.find(c => c.key === key)?.value || '';
  const updateConfigValue = (key: string, value: string) => {
      setConfigs(prev => prev.map(c => c.key === key ? { ...c, value } : c));
  };

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-indigo-500" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-white tracking-tight">Configuración del Centro de Control</h1><p className="text-slate-400">Gestión de flota multicanal e inteligencia sistémica.</p></div>
          <Button onClick={handleSaveAll} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg px-8 rounded-xl font-bold">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Cambios
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 flex-wrap h-auto rounded-xl">
            <TabsTrigger value="canales" className="gap-2"><Smartphone className="w-4 h-4"/> Canales</TabsTrigger>
            <TabsTrigger value="plantillas" className="gap-2"><MessageSquarePlus className="w-4 h-4"/> UI & Plantillas</TabsTrigger>
            <TabsTrigger value="followup" className="gap-2"><Clock className="w-4 h-4"/> Retargeting</TabsTrigger>
            <TabsTrigger value="secrets" className="gap-2"><Key className="w-4 h-4"/> API Keys</TabsTrigger>
            {isDev && <TabsTrigger value="kernel" className="gap-2 bg-indigo-900/20 text-indigo-400 ml-auto"><TerminalSquare className="w-4 h-4"/> Kernel Dev</TabsTrigger>}
          </TabsList>

          <TabsContent value="canales" className="mt-6">
             <div className="space-y-6">
                <Card className="bg-indigo-900/10 border border-indigo-500/30 rounded-2xl overflow-hidden">
                   <CardContent className="p-6 flex items-center gap-4">
                      <div className="p-3 bg-indigo-500/20 rounded-full"><BellRing className="w-6 h-6 text-indigo-400" /></div>
                      <div>
                         <h3 className="text-white font-bold">Canal Maestro de Alertas</h3>
                         <p className="text-xs text-slate-400">Este número enviará notificaciones de ventas y errores a tu equipo. Configúralo en cada canal individual abajo.</p>
                      </div>
                   </CardContent>
                </Card>
                <ChannelsTab />
             </div>
          </TabsContent>

          <TabsContent value="plantillas" className="mt-6">
             <TemplatesTab 
                globalTags={[]} onAddTag={()=>{}} onUpdateTag={()=>{}} onRemoveTag={()=>{}}
                quickReplies={[]} onAddQuickReply={()=>{}} onUpdateQuickReply={()=>{}} onRemoveQuickReply={()=>{}}
             />
          </TabsContent>

          <TabsContent value="secrets" className="mt-6">
             <SecretsTab getValue={getValue} onChange={(k,v)=>updateConfigValue(k,v)} />
          </TabsContent>

          {isDev && (
             <TabsContent value="kernel" className="mt-6">
                <KernelTab kernelConfig={{}} onChange={()=>{}} />
             </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;