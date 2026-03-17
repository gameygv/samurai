import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Key, Save, Loader2, Clock, MessageSquarePlus, TerminalSquare, Smartphone, DollarSign } from 'lucide-react';
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
  const activeTab = searchParams.get('tab') || 'plantillas';
  
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
      // 1. Guardado ATÓMICO y SEPARADO de Etiquetas y Plantillas para asegurar persistencia
      await supabase.from('app_config').upsert({ 
          key: 'global_tags', value: JSON.stringify(globalTags), category: 'SYSTEM', updated_at: new Date().toISOString() 
      }, { onConflict: 'key' });
      
      await supabase.from('app_config').upsert({ 
          key: 'quick_replies', value: JSON.stringify(globalReplies), category: 'SYSTEM', updated_at: new Date().toISOString() 
      }, { onConflict: 'key' });

      // 2. Guardado del resto de configuraciones
      const filteredConfigs = configs.filter(c => c.key !== 'global_tags' && c.key !== 'quick_replies');
      if (filteredConfigs.length > 0) {
         const updates = filteredConfigs.map(c => ({ 
            key: c.key, value: c.value, category: c.category || 'SYSTEM', updated_at: new Date().toISOString()
         }));
         const { error } = await supabase.from('app_config').upsert(updates, { onConflict: 'key' });
         if (error) throw error;
      }

      // 3. Guardado de Followups
      if (followupConfig.id) await supabase.from('followup_config').update({ ...followupConfig, updated_at: new Date().toISOString() }).eq('id', followupConfig.id);
      if (salesConfig.id) await supabase.from('followup_config').update({ ...salesConfig, updated_at: new Date().toISOString() }).eq('id', salesConfig.id);
      
      toast.success('Configuración maestra guardada correctamente.');
      fetchAllData();
    } catch (err: any) {
      toast.error("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getValue = (key: string) => configs.find(c => c.key === key)?.value || '';
  const updateConfigValue = (key: string, value: string) => {
      const exists = configs.find(c => c.key === key);
      if (exists) {
          setConfigs(prev => prev.map(c => c.key === key ? { ...c, value } : c));
      } else {
          setConfigs(prev => [...prev, { key, value, category: 'SYSTEM' }]);
      }
  };

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-indigo-500" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-white tracking-tight">Centro de Control</h1><p className="text-slate-400">Gestión de flota multicanal, plantillas y retargeting.</p></div>
          <Button onClick={handleSaveAll} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg px-8 rounded-xl font-bold uppercase tracking-widest text-[10px] h-11">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Cambios
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-[#121214] border border-[#222225] p-1 flex-wrap h-auto rounded-xl">
            <TabsTrigger value="plantillas" className="gap-2 px-4 py-2 text-xs data-[state=active]:bg-amber-600 data-[state=active]:text-slate-900"><MessageSquarePlus className="w-4 h-4"/> Plantillas y Etiquetas</TabsTrigger>
            <TabsTrigger value="canales" className="gap-2 px-4 py-2 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white"><Smartphone className="w-4 h-4"/> Canales WA</TabsTrigger>
            <TabsTrigger value="followup" className="gap-2 px-4 py-2 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white"><Clock className="w-4 h-4"/> Retargeting (IA)</TabsTrigger>
            <TabsTrigger value="finanzas" className="gap-2 px-4 py-2 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white"><DollarSign className="w-4 h-4"/> Finanzas</TabsTrigger>
            <TabsTrigger value="secrets" className="gap-2 px-4 py-2 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white"><Key className="w-4 h-4"/> API Keys</TabsTrigger>
            {isDev && <TabsTrigger value="kernel" className="gap-2 bg-indigo-900/20 text-indigo-400 ml-auto text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white"><TerminalSquare className="w-4 h-4"/> Kernel Dev</TabsTrigger>}
          </TabsList>

          <TabsContent value="plantillas" className="mt-6">
            <TemplatesTab 
                globalTags={globalTags} 
                onAddTag={() => setGlobalTags([...globalTags, { id: Date.now().toString(), text: '', color: '#D4AF37' }])} 
                onUpdateTag={(id, field, val) => setGlobalTags(globalTags.map(t => t.id === id ? {...t, [field]: val} : t))} 
                onRemoveTag={(id) => setGlobalTags(globalTags.filter(t => t.id !== id))} 
                quickReplies={globalReplies} 
                onAddQuickReply={() => setGlobalReplies([...globalReplies, { id: Date.now().toString(), title: '', text: '' }])} 
                onUpdateQuickReply={(id, field, val) => setGlobalReplies(globalReplies.map(r => r.id === id ? {...r, [field]: val} : r))} 
                onRemoveQuickReply={(id) => setGlobalReplies(globalReplies.filter(r => r.id !== id))} 
            />
          </TabsContent>
          <TabsContent value="canales" className="mt-6"><ChannelsTab /></TabsContent>
          <TabsContent value="followup" className="mt-6"><FollowupTab followupConfig={followupConfig} setFollowupConfig={setFollowupConfig} salesConfig={salesConfig} setSalesConfig={setSalesConfig} onSave={handleSaveAll} saving={saving}/></TabsContent>
          <TabsContent value="finanzas" className="mt-6 space-y-6">
             <BankTab getValue={getValue} onChange={updateConfigValue} />
          </TabsContent>
          <TabsContent value="secrets" className="mt-6">
             <SecretsTab getValue={getValue} onChange={updateConfigValue} />
          </TabsContent>
          {isDev && <TabsContent value="kernel" className="mt-6"><KernelTab kernelConfig={{}} onChange={()=>{}} /></TabsContent>}
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;