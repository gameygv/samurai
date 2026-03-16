import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Key, Save, Loader2, Store, Send, Clock, Building2, MessageSquarePlus, TerminalSquare, ShieldAlert, Smartphone } from 'lucide-react';
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
  const [quickReplies, setQuickReplies] = useState<{id: string, title: string, text: string}[]>([]);
  const [globalTags, setGlobalTags] = useState<{id: string, text: string, color: string}[]>([]);
  const [wcProducts, setWcProducts] = useState<any[]>([]);
  
  const [followupConfig, setFollowupConfig] = useState<any>({
      enabled: false, stage_1_delay: 15, stage_2_delay: 60, stage_3_delay: 1440,
      start_hour: 9, end_hour: 20, stage_1_message: '', stage_2_message: '', stage_3_message: ''
  });

  const [salesConfig, setSalesConfig] = useState({
      enabled: false, stage_1_delay: 60, stage_2_delay: 1440, stage_3_delay: 2880,
      stage_1_message: '', stage_2_message: '', stage_3_message: ''
  });

  const [kernelConfig, setKernelConfig] = useState({
      prompt_catalog_rules: '', prompt_media_rules: '', prompt_behavior_rules: '',
      prompt_human_handoff: '', prompt_bank_rules: '', prompt_ai_suggestions: '', prompt_qa_auditor: ''
  });

  const [globalBotPaused, setGlobalBotPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    const { data } = await supabase.from('app_config').select('*');
    if (data) {
        setConfigs(data);
        const getC = (k: string, def: string) => data.find(c => c.key === k)?.value || def;
        
        setGlobalBotPaused(getC('global_bot_paused', 'false') === 'true');

        setSalesConfig({
            enabled: getC('sales_followup_enabled', 'false') === 'true',
            stage_1_delay: parseInt(getC('sales_stage_1_delay', '60')),
            stage_2_delay: parseInt(getC('sales_stage_2_delay', '1440')),
            stage_3_delay: parseInt(getC('sales_stage_3_delay', '2880')),
            stage_1_message: getC('sales_stage_1_message', '¿Tuviste algún problema con el enlace de pago o la transferencia?'),
            stage_2_message: getC('sales_stage_2_message', 'Tu lugar sigue pre-reservado, pero necesitamos confirmar el pago para asegurarlo.'),
            stage_3_message: getC('sales_stage_3_message', 'Liberaremos tu lugar en unas horas si no recibimos el comprobante. ¿Te ayudo con algo?')
        });

        setKernelConfig({
            prompt_catalog_rules: getC('prompt_catalog_rules', ''),
            prompt_media_rules: getC('prompt_media_rules', ''),
            prompt_behavior_rules: getC('prompt_behavior_rules', ''),
            prompt_human_handoff: getC('prompt_human_handoff', ''),
            prompt_bank_rules: getC('prompt_bank_rules', ''),
            prompt_ai_suggestions: getC('prompt_ai_suggestions', ''),
            prompt_qa_auditor: getC('prompt_qa_auditor', '')
        });
        
        try { setQuickReplies(JSON.parse(getC('quick_replies', '[]'))); } catch(e) { setQuickReplies([]); }
        try { setGlobalTags(JSON.parse(getC('global_tags', '[]'))); } catch(e) { setGlobalTags([]); }

        const productsStr = getC('wc_products', '');
        if (productsStr) {
           try { setWcProducts(JSON.parse(productsStr)); } catch(e) { setWcProducts([]); }
        }
    }

    const { data: fcData } = await supabase.from('followup_config').select('*').limit(1).maybeSingle();
    if (fcData) setFollowupConfig(fcData);
    
    setLoading(false);
  };

  const handleInputChange = (key: string, value: string, category: string) => {
    setConfigs(prev => {
      const exists = prev.find(c => c.key === key);
      if (exists) return prev.map(c => c.key === key ? { ...c, value } : c);
      return [...prev, { key, value, category }];
    });
  };
  
  const handleKernelChange = (key: string, value: string) => {
      setKernelConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const excludedKeys = [
          'global_bot_paused', 'global_tags', 'quick_replies', 'wc_products',
          'sales_followup_enabled', 'sales_stage_1_delay', 'sales_stage_2_delay', 'sales_stage_3_delay', 
          'sales_stage_1_message', 'sales_stage_2_message', 'sales_stage_3_message', 
          'prompt_catalog_rules', 'prompt_media_rules', 'prompt_behavior_rules', 'prompt_human_handoff', 'prompt_bank_rules', 'prompt_ai_suggestions', 'prompt_qa_auditor'
      ];
      
      const cleanConfigs = configs
          .filter(c => !excludedKeys.includes(c.key))
          .map(c => ({ key: c.key, value: c.value, category: c.category || 'SYSTEM' }));

      const newConfigs = [
        ...cleanConfigs,
        { key: 'global_bot_paused', value: String(globalBotPaused), category: 'SYSTEM' },
        { key: 'sales_followup_enabled', value: String(salesConfig.enabled), category: 'FOLLOWUP' },
        { key: 'sales_stage_1_delay', value: String(salesConfig.stage_1_delay), category: 'FOLLOWUP' },
        { key: 'sales_stage_2_delay', value: String(salesConfig.stage_2_delay), category: 'FOLLOWUP' },
        { key: 'sales_stage_3_delay', value: String(salesConfig.stage_3_delay), category: 'FOLLOWUP' },
        { key: 'sales_stage_1_message', value: salesConfig.stage_1_message, category: 'FOLLOWUP' },
        { key: 'sales_stage_2_message', value: salesConfig.stage_2_message, category: 'FOLLOWUP' },
        { key: 'sales_stage_3_message', value: salesConfig.stage_3_message, category: 'FOLLOWUP' },
        { key: 'quick_replies', value: JSON.stringify(quickReplies), category: 'SYSTEM' },
        { key: 'global_tags', value: JSON.stringify(globalTags), category: 'SYSTEM' },
        { key: 'wc_products', value: JSON.stringify(wcProducts), category: 'WOOCOMMERCE' },
        
        { key: 'prompt_catalog_rules', value: kernelConfig.prompt_catalog_rules, category: 'KERNEL' },
        { key: 'prompt_media_rules', value: kernelConfig.prompt_media_rules, category: 'KERNEL' },
        { key: 'prompt_behavior_rules', value: kernelConfig.prompt_behavior_rules, category: 'KERNEL' },
        { key: 'prompt_human_handoff', value: kernelConfig.prompt_human_handoff, category: 'KERNEL' },
        { key: 'prompt_bank_rules', value: kernelConfig.prompt_bank_rules, category: 'KERNEL' },
        { key: 'prompt_ai_suggestions', value: kernelConfig.prompt_ai_suggestions, category: 'KERNEL' },
        { key: 'prompt_qa_auditor', value: kernelConfig.prompt_qa_auditor, category: 'KERNEL' },
      ];
      
      const { error } = await supabase.from('app_config').upsert(newConfigs, { onConflict: 'key' });
      if (error) throw error;

      if (followupConfig.id) {
          await supabase.from('followup_config').update(followupConfig).eq('id', followupConfig.id);
      } else {
          await supabase.from('followup_config').insert(followupConfig);
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

  if (loading) return <Layout><div className="flex h-[80vh] items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div></Layout>;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div><h1 className="text-3xl font-bold text-white">Configuración del Sistema</h1><p className="text-slate-400">Canales e Inteligencia Operativa.</p></div>
          <Button onClick={handleSaveAll} disabled={saving} className="bg-indigo-600 shadow-lg shrink-0">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Guardar Todo
          </Button>
        </div>

        {isAdmin && (
           <Card className="bg-slate-900 border-red-900/50 shadow-2xl relative overflow-hidden">
             <div className={cn("absolute left-0 top-0 bottom-0 w-2", globalBotPaused ? "bg-red-500" : "bg-emerald-500")} />
             <CardHeader className="pb-3 border-b border-slate-800 bg-slate-950/30">
               <CardTitle className="text-white flex items-center justify-between gap-2">
                 <div className="flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-red-500" /> Interruptor Maestro (Kill Switch)</div>
                 <Switch checked={globalBotPaused} onCheckedChange={setGlobalBotPaused} />
               </CardTitle>
             </CardHeader>
             <CardContent className="pt-4">
               <p className="text-xs text-slate-400">Al activar esta opción, Sam dejará de responder en <strong>todos</strong> los canales registrados.</p>
             </CardContent>
           </Card>
        )}

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 flex-wrap h-auto">
            <TabsTrigger value="canales" className="gap-2"><Smartphone className="w-4 h-4"/> Canales</TabsTrigger>
            <TabsTrigger value="plantillas" className="gap-2"><MessageSquarePlus className="w-4 h-4"/> Componentes UI</TabsTrigger>
            <TabsTrigger value="followup" className="gap-2"><Clock className="w-4 h-4"/> Retargeting</TabsTrigger>
            <TabsTrigger value="woocommerce" className="gap-2"><Store className="w-4 h-4"/> WooCommerce</TabsTrigger>
            <TabsTrigger value="pago_directo" className="gap-2"><Building2 className="w-4 h-4"/> Depósito</TabsTrigger>
            <TabsTrigger value="secrets" className="gap-2"><Key className="w-4 h-4"/> API Keys</TabsTrigger>
            {isDev && <TabsTrigger value="kernel" className="gap-2 bg-indigo-900/20 text-indigo-400 data-[state=active]:bg-indigo-600 data-[state=active]:text-white ml-auto"><TerminalSquare className="w-4 h-4"/> Kernel Dev</TabsTrigger>}
          </TabsList>

          <TabsContent value="canales" className="mt-6 space-y-6">
             <ChannelsTab />
          </TabsContent>

          <TabsContent value="plantillas" className="mt-6 space-y-6">
             <TemplatesTab 
                globalTags={globalTags} onAddTag={() => setGlobalTags([...globalTags, { id: Date.now().toString(), text: '', color: '#8b5cf6' }])} 
                onUpdateTag={(id, f, v) => setGlobalTags(globalTags.map(t => t.id === id ? {...t, [f]: v} : t))} 
                onRemoveTag={(id) => setGlobalTags(globalTags.filter(t => t.id !== id))}
                quickReplies={quickReplies} onAddQuickReply={() => setQuickReplies([...quickReplies, { id: Date.now().toString(), title: '', text: '' }])} 
                onUpdateQuickReply={(id, f, v) => setQuickReplies(quickReplies.map(q => q.id === id ? {...q, [f]: v} : q))} 
                onRemoveQuickReply={(id) => setQuickReplies(quickReplies.filter(q => q.id !== id))}
             />
          </TabsContent>

          <TabsContent value="followup" className="mt-6 space-y-6">
             <FollowupTab 
                followupConfig={followupConfig} setFollowupConfig={setFollowupConfig} 
                salesConfig={salesConfig} setSalesConfig={setSalesConfig} 
             />
          </TabsContent>

          <TabsContent value="woocommerce" className="mt-6 space-y-6">
             <WooCommerceTab 
                getValue={getValue} onChange={handleInputChange} 
                wcProducts={wcProducts} onAddProduct={() => setWcProducts([...wcProducts, { id: Date.now().toString(), wc_id: '', title: '', price: '', prompt: '' }])} 
                onUpdateProduct={(id, f, v) => setWcProducts(wcProducts.map(p => p.id === id ? {...p, [f]: v} : p))} 
                onRemoveProduct={(id) => setWcProducts(wcProducts.filter(p => p.id !== id))} 
             />
          </TabsContent>
          
          <TabsContent value="pago_directo" className="mt-6">
             <BankTab getValue={getValue} onChange={handleInputChange} />
          </TabsContent>

          <TabsContent value="secrets" className="mt-6">
             <SecretsTab getValue={getValue} onChange={handleInputChange} />
          </TabsContent>

          {isDev && (
             <TabsContent value="kernel" className="mt-6 space-y-6">
                <KernelTab kernelConfig={kernelConfig} onChange={handleKernelChange} />
             </TabsContent>
          )}
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;