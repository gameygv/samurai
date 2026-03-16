import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Key, Save, Loader2, Clock, MessageSquarePlus, TerminalSquare, Smartphone, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

// Import Modulares
import { BankTab, SecretsTab } from '@/components/settings/BankAndSecretsTabs';
import { TemplatesTab } from '@/components/settings/TemplatesTab';
import { FollowupTab } from '@/components/settings/FollowupTab';
import { KernelTab } from '@/components/settings/KernelTab';
import { ChannelsTab } from '@/components/settings/ChannelsTab';

const Settings = () => {
  const { isDev } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'canales';
  
  const [configs, setConfigs] = useState<any[]>([]);
  const [followupConfig, setFollowupConfig] = useState<any>({ enabled: false });
  const [salesConfig, setSalesConfig] = useState<any>({ enabled: false });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Cargar App Config (Keys, Banco, etc)
      const { data: appData } = await supabase.from('app_config').select('*');
      if (appData) setConfigs(appData);

      // Cargar Retargeting Config
      const { data: flpData } = await supabase.from('followup_config').select('*');
      if (flpData) {
         const exploration = flpData.find(f => f.strategy_type === 'exploration');
         const sales = flpData.find(f => f.strategy_type === 'sales');
         if (exploration) setFollowupConfig(exploration);
         if (sales) setSalesConfig(sales);
      }
    } catch (e) {
      toast.error("Error cargando configuración");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // 1. Guardar App Config
      const updates = configs.map(c => ({ 
        key: c.key, 
        value: c.value, 
        category: c.category || 'SYSTEM',
        updated_at: new Date().toISOString()
      }));
      await supabase.from('app_config').upsert(updates, { onConflict: 'key' });

      // 2. Guardar Followups
      if (followupConfig.id) {
         await supabase.from('followup_config').update({ ...followupConfig, updated_at: new Date().toISOString() }).eq('id', followupConfig.id);
      }
      if (salesConfig.id) {
         await supabase.from('followup_config').update({ ...salesConfig, updated_at: new Date().toISOString() }).eq('id', salesConfig.id);
      }
      
      toast.success('Configuración guardada correctamente.');
      fetchAllData();
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
          <div><h1 className="text-3xl font-bold text-white tracking-tight">Centro de Control</h1><p className="text-slate-400">Gestión de flota multicanal y retargeting IA.</p></div>
          <Button onClick={handleSaveAll} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg px-8 rounded-xl font-bold">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Cambios
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 flex-wrap h-auto rounded-xl">
            <TabsTrigger value="canales" className="gap-2 px-4 py-2">Canales</TabsTrigger>
            <TabsTrigger value="followup" className="gap-2 px-4 py-2"><Clock className="w-4 h-4"/> Retargeting (IA)</TabsTrigger>
            <TabsTrigger value="plantillas" className="gap-2 px-4 py-2">Plantillas</TabsTrigger>
            <TabsTrigger value="secrets" className="gap-2 px-4 py-2">API Keys</TabsTrigger>
            {isDev && <TabsTrigger value="kernel" className="gap-2 bg-indigo-900/20 text-indigo-400 ml-auto"><TerminalSquare className="w-4 h-4"/> Kernel Dev</TabsTrigger>}
          </TabsList>

          <TabsContent value="canales" className="mt-6"><ChannelsTab /></TabsContent>

          <TabsContent value="followup" className="mt-6">
             <FollowupTab 
                followupConfig={followupConfig} 
                setFollowupConfig={setFollowupConfig} 
                salesConfig={salesConfig} 
                setSalesConfig={setSalesConfig} 
             />
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

          {isDev && <TabsContent value="kernel" className="mt-6"><KernelTab kernelConfig={{}} onChange={()=>{}} /></TabsContent>}
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;