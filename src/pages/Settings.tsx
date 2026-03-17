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
  
  const [globalTags, setGlobalTags] = useState<{id: string, text: string, color: string}[]>([]);
  const [globalReplies, setGlobalReplies] = useState<{id: string, title: string, text: string}[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const { data: appData } = await supabase.from('app_config').select('*');
      if (appData) {
         setConfigs(appData);
         const tagsStr = appData.find(c => c.key === 'global_tags')?.value;
         if (tagsStr) { try { setGlobalTags(JSON.parse(tagsStr)); } catch(e){} }
         const repliesStr = appData.find(c => c.key === 'quick_replies')?.value;
         if (repliesStr) { try { setGlobalReplies(JSON.parse(repliesStr)); } catch(e){} }
      }

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
      const updates = configs.map(c => ({ 
        key: c.key, 
        value: c.value, 
        category: c.category || 'SYSTEM',
        updated_at: new Date().toISOString()
      }));

      updates.push({ key: 'global_tags', value: JSON.stringify(globalTags), category: 'SYSTEM', updated_at: new Date().toISOString() });
      updates.push({ key: 'quick_replies', value: JSON.stringify(globalReplies), category: 'SYSTEM', updated_at: new Date().toISOString() });

      await supabase.from('app_config').upsert(updates, { onConflict: 'key' });

      if (followupConfig.id) {
         await supabase.from('followup_config').update({ ...followupConfig, updated_at: new Date().toISOString() }).eq('id', followupConfig.id);
      }
      if (salesConfig.id) {
         await supabase.from('followup_config').update({ ...salesConfig, updated_at: new Date().toISOString() }).eq('id', salesConfig.id);
      }
      
      toast.success('Configuración maestra guardada correctamente.');
      fetchAllData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getValue = (key: string) => configs.find(c => c.key === key)?.value || '';
  const updateConfigValue = (key: string, value: string) => setConfigs(prev => prev.map(c => c.key === key ? { ...c, value } : c));

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-indigo-500" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-white tracking-tight">Centro de Control</h1><p className="text-slate-400">Gestión de flota multicanal y retargeting IA.</p></div>
          <Button onClick={handleSaveAll} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg px-8 rounded-xl font-bold uppercase tracking-widest text-[10px] h-11">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Cambios
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 flex-wrap h-auto rounded-xl">
            <TabsTrigger value="canales" className="gap-2 px-4 py-2 text-xs">Canales</TabsTrigger>
            <TabsTrigger value="followup" className="gap-2 px-4 py-2 text-xs"><Clock className="w-4 h-4"/> Retargeting (IA)</TabsTrigger>
            <TabsTrigger value="plantillas" className="gap-2 px-4 py-2 text-xs">Plantillas y Etiquetas</TabsTrigger>
            <TabsTrigger value="secrets" className="gap-2 px-4 py-2 text-xs">API Keys</TabsTrigger>
            {isDev && <TabsTrigger value="kernel" className="gap-2 bg-indigo-900/20 text-indigo-400 ml-auto text-xs"><TerminalSquare className="w-4 h-4"/> Kernel Dev</TabsTrigger>}
          </TabsList>

          <TabsContent value="canales" className="mt-6"><ChannelsTab /></TabsContent>
          <TabsContent value="followup" className="mt-6"><FollowupTab followupConfig={followupConfig} setFollowupConfig={setFollowupConfig} salesConfig={salesConfig} setSalesConfig={setSalesConfig} onSave={handleSaveAll} saving={saving}/></TabsContent>
          <TabsContent value="plantillas" className="mt-6"><TemplatesTab globalTags={globalTags} onAddTag={() => setGlobalTags([...globalTags, { id: Date.now().toString(), text: '', color: '#D4AF37' }])} onUpdateTag={(id, field, val) => setGlobalTags(globalTags.map(t => t.id === id ? {...t, [field]: val} : t))} onRemoveTag={(id) => setGlobalTags(globalTags.filter(t => t.id !== id))} quickReplies={globalReplies} onAddQuickReply={() => setGlobalReplies([...globalReplies, { id: Date.now().toString(), title: '', text: '' }])} onUpdateQuickReply={(id, field, val) => setGlobalReplies(globalReplies.map(r => r.id === id ? {...r, [field]: val} : r))} onRemoveQuickReply={(id) => setGlobalReplies(globalReplies.filter(r => r.id !== id))} /></TabsContent>
          <TabsContent value="secrets" className="mt-6"><SecretsTab getValue={getValue} onChange={(k,v)=>updateConfigValue(k,v)} /></TabsContent>
          {isDev && <TabsContent value="kernel" className="mt-6"><KernelTab kernelConfig={{}} onChange={()=>{}} /></TabsContent>}
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;