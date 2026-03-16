import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Trash2, Smartphone, Globe, Key, 
  CheckCircle2, AlertCircle, Loader2, RefreshCw, Layers, ShieldCheck, BellRing 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const ChannelsTab = () => {
  const [channels, setChannels] = useState<any[]>([]);
  const [defaultNotifyId, setDefaultNotifyId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data: chs } = await supabase.from('whatsapp_channels').select('*').order('created_at', { ascending: true });
    const { data: cfg } = await supabase.from('app_config').select('value').eq('key', 'default_notification_channel').maybeSingle();
    
    if (chs) setChannels(chs);
    if (cfg?.value) setDefaultNotifyId(cfg.value);
    setLoading(false);
  };

  const handleSetDefault = async (id: string) => {
    setDefaultNotifyId(id);
    await supabase.from('app_config').upsert({ key: 'default_notification_channel', value: id, category: 'SYSTEM' }, { onConflict: 'key' });
    toast.success("Canal de notificaciones actualizado");
  };

  const handleAddChannel = () => {
    setChannels([...channels, { id: `new-${Date.now()}`, name: '', provider: 'meta', api_url: '', api_key: '', instance_id: '', verify_token: 'samurai_v3', is_new: true }]);
  };

  const handleSaveChannel = async (ch: any) => {
    setSaving(true);
    try {
      const { is_new, ...payload } = ch;
      const data = { 
        name: payload.name, 
        provider: payload.provider, 
        api_url: payload.api_url, 
        api_key: payload.api_key, 
        instance_id: payload.instance_id, 
        verify_token: payload.verify_token, 
        is_active: true 
      };
      
      const { error } = is_new ? await supabase.from('whatsapp_channels').insert(data) : await supabase.from('whatsapp_channels').update(data).eq('id', ch.id);
      if (error) throw error;
      toast.success("Canal guardado correctamente.");
      fetchAll();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
        <div>
           <h2 className="text-lg font-bold text-white flex items-center gap-2"><Smartphone className="w-5 h-5 text-indigo-400"/> Flota Multicanal</h2>
           <p className="text-xs text-slate-500">Cada canal tiene su propio Webhook independiente.</p>
        </div>
        <Button onClick={handleAddChannel} className="bg-indigo-900 hover:bg-indigo-800 text-amber-500 font-bold"><Plus className="w-4 h-4 mr-2"/> AÑADIR NÚMERO</Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {channels.map((ch) => (
          <Card key={ch.id} className={cn("bg-slate-900 border-slate-800 transition-all", defaultNotifyId === ch.id && "border-amber-500/50 shadow-amber-900/10")}>
            <CardHeader className="py-4 border-b border-slate-800/50 flex flex-row items-center justify-between bg-slate-950/20">
               <div className="flex items-center gap-4 flex-1">
                  <Input value={ch.name} onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, name: e.target.value} : c))} className="bg-transparent border-0 font-bold text-slate-100 p-0 h-auto text-lg focus-visible:ring-0" placeholder="Nombre de la cuenta..." />
                  {defaultNotifyId === ch.id && <Badge className="bg-amber-600 text-white uppercase text-[9px] font-bold"><BellRing className="w-3 h-3 mr-1"/> Canal de Sistema</Badge>}
               </div>
               <div className="flex gap-2">
                  {!ch.is_new && defaultNotifyId !== ch.id && (
                     <Button variant="ghost" size="sm" onClick={() => handleSetDefault(ch.id)} className="text-[10px] text-slate-400 hover:text-amber-500 uppercase font-bold">Usar para Alertas</Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={async () => { if(confirm("¿Eliminar?")) { await supabase.from('whatsapp_channels').delete().eq('id', ch.id); fetchAll(); } }} className="text-slate-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
               </div>
            </CardHeader>
            <CardContent className="p-6">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] uppercase font-bold text-slate-500">Proveedor</Label>
                     <Select value={ch.provider} onValueChange={v => setChannels(channels.map(c => c.id === ch.id ? {...c, provider: v} : c))}>
                        <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                           <SelectItem value="meta">Meta Cloud API</SelectItem>
                           <SelectItem value="evolution">Evolution API</SelectItem>
                           <SelectItem value="gowa">GOWA</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
                  
                  <div className="space-y-2">
                     <Label className="text-[10px] uppercase font-bold text-slate-500">URL del Servidor</Label>
                     <Input 
                        value={ch.api_url} 
                        onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, api_url: e.target.value} : c))} 
                        placeholder={ch.provider === 'meta' ? 'https://graph.facebook.com' : 'https://tu-gowa.com'}
                        className="bg-slate-950 border-slate-800 font-mono text-xs" 
                     />
                  </div>

                  <div className="space-y-2">
                     <Label className="text-[10px] uppercase font-bold text-slate-500">{ch.provider === 'meta' ? 'Access Token' : 'API Key'}</Label>
                     <Input type="password" value={ch.api_key} onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, api_key: e.target.value} : c))} className="bg-slate-950 border-slate-800" />
                  </div>

                  <div className="space-y-2">
                     <Label className="text-[10px] uppercase font-bold text-slate-500">{ch.provider === 'meta' ? 'Phone Number ID' : 'Instance ID'}</Label>
                     <Input value={ch.instance_id} onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, instance_id: e.target.value} : c))} className="bg-slate-950 border-slate-800" />
                  </div>
               </div>

               {ch.provider === 'meta' && (
                  <div className="mt-6 p-4 bg-slate-950 border border-amber-900/30 rounded-xl space-y-2">
                     <Label className="text-[10px] uppercase font-bold text-amber-500">Verify Token (Para Meta Webhook)</Label>
                     <Input value={ch.verify_token} onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, verify_token: e.target.value} : c))} className="bg-transparent border-slate-800 text-amber-400 font-mono" />
                  </div>
               )}

               <div className="mt-6 flex justify-end">
                  <Button onClick={() => handleSaveChannel(ch)} disabled={saving} className="bg-indigo-900 hover:bg-indigo-800 text-amber-500 font-bold px-10">
                     {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2"/> : <ShieldCheck className="w-4 h-4 mr-2"/>} 
                     GUARDAR CONFIG
                  </Button>
               </div>
            </CardContent>
            {!ch.is_new && (
               <CardFooter className="bg-slate-950/30 border-t border-slate-800/50 py-3 flex flex-col items-start gap-2">
                  <span className="text-[9px] text-slate-500 font-mono uppercase font-bold">Copia esta URL en tu panel de Gowa (Webhooks):</span>
                  <code className="text-[10px] text-indigo-400 bg-black p-2 rounded border border-slate-800 w-full truncate select-all">
                     {`https://giwoovmvwlddaizorizk.supabase.co/functions/v1/evolution-webhook?channel_id=${ch.id}`}
                  </code>
               </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};