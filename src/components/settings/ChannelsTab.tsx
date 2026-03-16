import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Trash2, Smartphone, Globe, Key, 
  CheckCircle2, AlertCircle, Loader2, RefreshCw, Layers, ShieldCheck 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const ChannelsTab = () => {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchChannels(); }, []);

  const fetchChannels = async () => {
    setLoading(true);
    const { data } = await supabase.from('whatsapp_channels').select('*').order('created_at', { ascending: true });
    if (data) setChannels(data);
    setLoading(false);
  };

  const handleAddChannel = () => {
    setChannels([...channels, { id: `new-${Date.now()}`, name: '', provider: 'evolution', api_url: '', api_key: '', instance_id: '', verify_token: 'samurai_verify_token', is_new: true }]);
  };

  const handleSaveChannel = async (channel: any) => {
    setSaving(true);
    try {
      const { is_new, ...payload } = channel;
      const dataToSave = {
        name: payload.name,
        provider: payload.provider,
        api_url: payload.api_url || 'https://graph.facebook.com',
        api_key: payload.api_key,
        instance_id: payload.instance_id,
        verify_token: payload.verify_token,
        is_active: payload.is_active ?? true
      };

      const { error } = is_new 
        ? await supabase.from('whatsapp_channels').insert(dataToSave) 
        : await supabase.from('whatsapp_channels').update(dataToSave).eq('id', channel.id);

      if (error) throw error;
      toast.success("Canal guardado");
      fetchChannels();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-lg font-bold text-white flex items-center gap-2"><Smartphone className="w-5 h-5 text-indigo-400"/> Flota Multicanal</h2>
           <p className="text-xs text-slate-500">Conecta Evolution, Gowa o Meta Cloud API simultáneamente.</p>
        </div>
        <Button onClick={handleAddChannel} className="bg-indigo-900 hover:bg-indigo-800 text-amber-500 rounded-xl h-10 px-6 font-bold shadow-lg"><Plus className="w-4 h-4 mr-2"/> AÑADIR CANAL</Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {channels.map((ch) => (
          <Card key={ch.id} className="bg-slate-900 border-slate-800">
            <CardHeader className="py-4 border-b border-slate-800/50 bg-slate-950/20">
               <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                     <Input value={ch.name} onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, name: e.target.value} : c))} placeholder="Nombre (ej: WhatsApp Oficial)" className="bg-transparent border-0 font-bold text-slate-100 focus-visible:ring-0 p-0 h-auto text-base" />
                  </div>
                  <Button variant="ghost" size="icon" onClick={async () => { if(confirm("¿Eliminar?")) { await supabase.from('whatsapp_channels').delete().eq('id', ch.id); fetchChannels(); } }} className="text-slate-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
               </div>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">Proveedor</Label>
                  <Select value={ch.provider} onValueChange={v => setChannels(channels.map(c => c.id === ch.id ? {...c, provider: v} : c))}>
                     <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                     <SelectContent className="bg-slate-900 border-slate-800 text-white">
                        <SelectItem value="evolution">Evolution API</SelectItem>
                        <SelectItem value="gowa">GOWA</SelectItem>
                        <SelectItem value="meta">Meta Cloud API (Oficial)</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
               
               <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">{ch.provider === 'meta' ? 'Permanent Access Token' : 'API Key'}</Label>
                  <Input type="password" value={ch.api_key} onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, api_key: e.target.value} : c))} className="bg-slate-950 border-slate-800" />
               </div>

               <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">{ch.provider === 'meta' ? 'Phone Number ID' : 'Instance ID / Slug'}</Label>
                  <Input value={ch.instance_id} onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, instance_id: e.target.value} : c))} className="bg-slate-950 border-slate-800" />
               </div>

               {ch.provider === 'meta' && (
                  <div className="space-y-2 md:col-span-2">
                     <Label className="text-[10px] uppercase font-bold text-amber-500 flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> Verify Token (Webhook)</Label>
                     <Input value={ch.verify_token} onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, verify_token: e.target.value} : c))} className="bg-slate-950 border-amber-900/50 text-amber-400 font-mono" />
                  </div>
               )}

               <div className="flex items-end">
                  <Button onClick={() => handleSaveChannel(ch)} disabled={saving} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold h-10 rounded-xl">{saving ? <Loader2 className="animate-spin w-4 h-4"/> : "GUARDAR"}</Button>
               </div>
            </CardContent>
            {!ch.is_new && (
               <CardFooter className="bg-slate-950/30 border-t border-slate-800/50 py-3 px-5 flex flex-col gap-2">
                  <div className="flex justify-between items-center w-full">
                     <span className="text-[10px] text-slate-500 font-mono uppercase">Webhook URL para {ch.provider.toUpperCase()}</span>
                     <Badge variant="outline" className="text-[9px] border-indigo-500/30 text-indigo-400">COPIAR URL</Badge>
                  </div>
                  <div className="bg-black p-2 rounded border border-slate-800 w-full overflow-hidden">
                     <p className="text-[10px] text-slate-400 font-mono truncate select-all">
                        {`https://giwoovmvwlddaizorizk.supabase.co/functions/v1/evolution-webhook?channel_id=${ch.id}`}
                     </p>
                  </div>
               </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};