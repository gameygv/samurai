import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Webhook, Key, Save, Loader2, ShoppingCart, Globe, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'ecommerce';
  
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    const { data } = await supabase.from('app_config').select('*');
    if (data) setConfigs(data);
    setLoading(false);
  };

  const handleInputChange = (key: string, value: string, category: string = 'SYSTEM') => {
    setConfigs(prev => {
      const exists = prev.find(c => c.key === key);
      if (exists) return prev.map(c => c.key === key ? { ...c, value } : c);
      return [...prev, { key, value, category }];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('app_config').upsert(configs);
      if (error) throw error;
      toast.success('Configuración guardada');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getValue = (key: string) => configs.find(c => c.key === key)?.value || '';

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Configuración</h1>
          <Button onClick={handleSave} disabled={saving} className="bg-green-600">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={v => setSearchParams({ tab: v })}>
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="ecommerce"><ShoppingCart className="w-4 h-4 mr-2" /> E-commerce</TabsTrigger>
            <TabsTrigger value="webhooks"><Webhook className="w-4 h-4 mr-2" /> Webhooks</TabsTrigger>
            <TabsTrigger value="secrets"><Key className="w-4 h-4 mr-2" /> API Keys</TabsTrigger>
          </TabsList>

          <TabsContent value="webhooks" className="mt-6 space-y-6">
             <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-yellow-500">
                <CardHeader>
                   <CardTitle className="text-white flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-yellow-500" /> Webhook Intervención Humana
                   </CardTitle>
                   <CardDescription>Esta URL se disparará cuando el Samurai decida que un humano debe intervenir (cliente molesto o situación compleja).</CardDescription>
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
          
          {/* ... otras pestañas mantenidas */}
        </Tabs>
      </div>
    </Layout>
  );
};

export default Settings;