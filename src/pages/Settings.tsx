import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Key, Save, Loader2, Clock, MessageSquarePlus, TerminalSquare, Smartphone, DollarSign, ShoppingCart, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

import { BankTab, SecretsTab } from '@/components/settings/BankAndSecretsTabs';
import { TemplatesTab } from '@/components/settings/TemplatesTab';
import { FollowupTab } from '@/components/settings/FollowupTab';
import { KernelTab } from '@/components/settings/KernelTab';
import { ChannelsTab } from '@/components/settings/ChannelsTab';
import { WooCommerceTab } from '@/components/settings/WooCommerceTab';

const Settings = () => {
  const { isDev, isManager } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'plantillas';
  
  const [configs, setConfigs] = useState<any[]>([]);
  const [followupConfig, setFollowupConfig] = useState<any>({ enabled: false });
  const [salesConfig, setSalesConfig] = useState<any>({ enabled: false });
  const [daysToLost, setDaysToLost] = useState('14');
  
  const [globalTags, setGlobalTags] = useState<{id: string, text: string, color: string}[]>([]);
  const [globalReplies, setGlobalReplies] = useState<{id: string, title: string, text: string}[]>([]);
  const [wcProducts, setWcProducts] = useState<any[]>([]);

  const [globalAiStatus, setGlobalAiStatus] = useState('active');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWc, setTestingWc] = useState(false);

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const { data: appData } = await supabase.from('app_config').select('*');
      if (appData) {
         setConfigs(appData);
         
         // BLINDAJE CONTRA JSONs CORRUPTOS
         const tagsStr = appData.find(c => c.key === 'global_tags')?.value;
         if (tagsStr) { try { const p = JSON.parse(tagsStr); setGlobalTags(Array.isArray(p) ? p : []); } catch(e){ setGlobalTags([]); } }
         
         const repliesStr = appData.find(c => c.key === 'quick_replies')?.value;
         if (repliesStr) { try { const p = JSON.parse(repliesStr); setGlobalReplies(Array.isArray(p) ? p : []); } catch(e){ setGlobalReplies([]); } }
         
         const wcProdStr = appData.find(c => c.key === 'wc_products')?.value;
         if (wcProdStr) { try { const p = JSON.parse(wcProdStr); setWcProducts(Array.isArray(p) ? p : []); } catch(e){ setWcProducts([]); } }
         
         const daysToLostStr = appData.find(c => c.key === 'days_to_lost_lead')?.value;
         if (daysToLostStr) setDaysToLost(daysToLostStr);

         const aiStatus = appData.find(c => c.key === 'global_ai_status')?.value || 'active';
         setGlobalAiStatus(aiStatus);
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

  const handleToggleGlobalAi = async () => {
    const newVal = globalAiStatus === 'active' ? 'paused' : 'active';
    setGlobalAiStatus(newVal);
    try {
      await supabase.from('app_config').upsert({ key: 'global_ai_status', value: newVal, category: 'SYSTEM' }, { onConflict: 'key' });
      toast.success(newVal === 'paused' ? '🚨 IA GLOBAL DETENIDA POR EMERGENCIA' : '✅ IA GLOBAL REANUDADA');
    } catch(err: any) {
      toast.error("Error al cambiar estado de IA: " + err.message);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // 1. Guardado ATÓMICO de JSONs complejos y Días a Perdido
      await supabase.from('app_config').upsert([
          { key: 'global_tags', value: JSON.stringify(globalTags), category: 'SYSTEM', updated_at: new Date().toISOString() },
          { key: 'quick_replies', value: JSON.stringify(globalReplies), category: 'SYSTEM', updated_at: new Date().toISOString() },
          { key: 'wc_products', value: JSON.stringify(wcProducts), category: 'WOOCOMMERCE', updated_at: new Date().toISOString() },
          { key: 'days_to_lost_lead', value: daysToLost.toString(), category: 'SYSTEM', updated_at: new Date().toISOString() }
      ], { onConflict: 'key' });

      // 2. Guardado del resto de configuraciones simples
      const filteredConfigs = configs.filter(c => !['global_tags', 'quick_replies', 'wc_products', 'days_to_lost_lead', 'global_ai_status'].includes(c.key));
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

  const handleTestWcConnection = async () => {
      const wcUrl = getValue('wc_url');
      const wcKey = getValue('wc_consumer_key');
      const wcSecret = getValue('wc_consumer_secret');
      
      if (!wcUrl || !wcKey || !wcSecret) {
         toast.error("Completa URL, Key y Secret para probar la conexión.");
         return;
      }

      setTestingWc(true);
      const tid = toast.loading("Conectando con WooCommerce...");
      
      try {
         const { data, error } = await supabase.functions.invoke('test-wc-connection', {
            body: { wc_url: wcUrl, wc_key: wcKey, wc_secret: wcSecret }
         });

         if (error) throw error;
         if (!data.success) throw new Error(data.error);

         toast.success(`Conexión exitosa a la tienda.`, { id: tid });
      } catch (err: any) {
         toast.error(`Fallo: ${err.message}`, { id: tid });
      } finally {
         setTestingWc(false);
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

  const kernelConfigObj = configs.reduce((acc, c) => ({ ...acc, [c.key]: c.value }), {});

  const handleAddProduct = () => setWcProducts([...wcProducts, { id: Date.now().toString(), wc_id: '', title: '', price: '', prompt: '' }]);
  const handleUpdateProduct = (id: string, field: string, value: string) => setWcProducts(wcProducts.map(p => p.id === id ? { ...p, [field]: value } : p));
  const handleRemoveProduct = (id: string) => setWcProducts(wcProducts.filter(p => p.id !== id));

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-indigo-500" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-white tracking-tight">Centro de Control</h1><p className="text-slate-400">Gestión de flota multicanal, plantillas y retargeting.</p></div>
          <div className="flex gap-3">
             <Button 
                onClick={handleToggleGlobalAi} 
                variant={globalAiStatus === 'active' ? 'destructive' : 'default'} 
                className={cn("shadow-lg px-6 rounded-xl font-bold uppercase tracking-widest text-[10px] h-11 transition-all", globalAiStatus === 'active' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-slate-950')}
             >
               <PowerOff className="w-4 h-4 mr-2" />
               {globalAiStatus === 'active' ? 'APAGAR IA GLOBAL (EMERGENCIA)' : 'ENCENDER IA GLOBAL'}
             </Button>
             <Button onClick={handleSaveAll} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg px-8 rounded-xl font-bold uppercase tracking-widest text-[10px] h-11">
               {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Cambios
             </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-[#121214] border border-[#222225] p-1 flex-wrap h-auto rounded-xl">
            <TabsTrigger value="plantillas" className="gap-2 px-4 py-2 text-xs data-[state=active]:bg-amber-600 data-[state=active]:text-slate-900"><MessageSquarePlus className="w-4 h-4"/> Plantillas y Etiquetas</TabsTrigger>
            <TabsTrigger value="canales" className="gap-2 px-4 py-2 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white"><Smartphone className="w-4 h-4"/> Canales WA</TabsTrigger>
            <TabsTrigger value="ecommerce" className="gap-2 px-4 py-2 text-xs data-[state=active]:bg-pink-600 data-[state=active]:text-white"><ShoppingCart className="w-4 h-4"/> Tienda / Catálogo</TabsTrigger>
            <TabsTrigger value="followup" className="gap-2 px-4 py-2 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white"><Clock className="w-4 h-4"/> Retargeting (IA)</TabsTrigger>
            <TabsTrigger value="finanzas" className="gap-2 px-4 py-2 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white"><DollarSign className="w-4 h-4"/> Banco</TabsTrigger>
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
          
          <TabsContent value="ecommerce" className="mt-6">
             <WooCommerceTab 
                getValue={getValue} 
                onChange={updateConfigValue}
                wcProducts={wcProducts}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onRemoveProduct={handleRemoveProduct}
                onTestConnection={handleTestWcConnection}
                isTesting={testingWc}
             />
          </TabsContent>

          <TabsContent value="followup" className="mt-6"><FollowupTab followupConfig={followupConfig} setFollowupConfig={setFollowupConfig} salesConfig={salesConfig} setSalesConfig={setSalesConfig} daysToLost={daysToLost} setDaysToLost={setDaysToLost} onSave={handleSaveAll} saving={saving}/></TabsContent>
          <TabsContent value="finanzas" className="mt-6 space-y-6">
             <BankTab getValue={getValue} onChange={updateConfigValue} />
          </TabsContent>
          <TabsContent value="secrets" className="mt-6">
             <SecretsTab getValue={getValue} onChange={updateConfigValue} />
          </TabsContent>
          
          {isDev && (
             <TabsContent value="kernel" className="mt-6">
                <KernelTab 
                   kernelConfig={kernelConfigObj} 
                   onChange={updateConfigValue} 
                />
             </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;