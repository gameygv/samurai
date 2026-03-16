import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Trash2, Smartphone, Globe, Key, 
  CheckCircle2, AlertCircle, Loader2, RefreshCw, Layers 
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
    setChannels([...channels, { 
      id: `new-${Date.now()}`, 
      name: '', 
      provider: 'evolution', 
      api_url: '', 
      api_key: '', 
      instance_id: '',
      is_new: true 
    }]);
  };

  const handleSaveChannel = async (channel: any) => {
    setSaving(true);
    try {
      const { is_new, ...payload } = channel;
      const dataToSave = {
        name: payload.name,
        provider: payload.provider,
        api_url: payload.api_url,
        api_key: payload.api_key,
        instance_id: payload.instance_id,
        is_active: payload.is_active ?? true
      };

      let error;
      if (is_new) {
        ({ error } = await supabase.from('whatsapp_channels').insert(dataToSave));
      } else {
        ({ error } = await supabase.from('whatsapp_channels').update(dataToSave).eq('id', channel.id));
      }

      if (error) throw error;
      toast.success("Canal sincronizado correctamente");
      fetchChannels();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChannel = async (id: string, isNew?: boolean) => {
    if (isNew) {
      setChannels(channels.filter(c => c.id !== id));
      return;
    }
    if (!confirm("¿Eliminar este canal? Sam dejará de responder por este número.")) return;
    const { error } = await supabase.from('whatsapp_channels').delete().eq('id', id);
    if (!error) {
      toast.success("Canal eliminado");
      fetchChannels();
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-lg font-bold text-white flex items-center gap-2"><Smartphone className="w-5 h-5 text-indigo-400"/> Flota de Dispositivos</h2>
           <p className="text-xs text-slate-500">Gestiona múltiples instancias de WhatsApp (Evolution/Gowa) de forma simultánea.</p>
        </div>
        <Button onClick={handleAddChannel} className="bg-indigo-900 hover:bg-indigo-800 text-amber-500 rounded-xl h-10 px-6 font-bold shadow-lg">
           <Plus className="w-4 h-4 mr-2"/> AÑADIR NÚMERO
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {channels.length === 0 && (
           <Card className="bg-slate-900/50 border-dashed border-slate-800 py-20 text-center">
              <p className="text-slate-600 italic">No hay canales configurados. Añade uno para empezar a recibir mensajes.</p>
           </Card>
        )}
        
        {channels.map((ch) => (
          <Card key={ch.id} className={`bg-slate-900 border-slate-800 transition-all ${ch.is_new ? 'border-indigo-500/50 shadow-indigo-900/20' : ''}`}>
            <CardHeader className="py-4 border-b border-slate-800/50 bg-slate-950/20">
               <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                     <div className={`p-2 rounded-lg ${ch.provider === 'evolution' ? 'bg-blue-900/30 text-blue-400' : 'bg-green-900/30 text-green-400'}`}>
                        {ch.provider === 'evolution' ? <Layers className="w-4 h-4"/> : <RefreshCw className="w-4 h-4"/>}
                     </div>
                     <Input 
                        value={ch.name} 
                        onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, name: e.target.value} : c))}
                        placeholder="Nombre de la cuenta (ej: Ventas Principal)"
                        className="bg-transparent border-0 font-bold text-slate-100 focus-visible:ring-0 p-0 h-auto text-base"
                     />
                  </div>
                  <div className="flex items-center gap-2">
                     <Badge variant="outline" className={ch.is_new ? 'border-amber-500 text-amber-500' : 'border-emerald-500 text-emerald-500'}>
                        {ch.is_new ? 'NUEVO' : 'ACTIVO'}
                     </Badge>
                     <Button variant="ghost" size="icon" onClick={() => handleDeleteChannel(ch.id, ch.is_new)} className="text-slate-500 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                     </Button>
                  </div>
               </div>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">Plataforma</Label>
                  <Select value={ch.provider} onValueChange={v => setChannels(channels.map(c => c.id === ch.id ? {...c, provider: v} : c))}>
                     <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                     <SelectContent className="bg-slate-900 border-slate-800 text-white">
                        <SelectItem value="evolution">Evolution API (v1/v2)</SelectItem>
                        <SelectItem value="gowa">GOWA (Go-WhatsApp)</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
               <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">URL del Endpoint</Label>
                  <div className="flex gap-2">
                     <Input 
                        value={ch.api_url} 
                        onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, api_url: e.target.value} : c))}
                        placeholder="https://api.tu-vps.com"
                        className="bg-slate-950 border-slate-800 font-mono text-xs"
                     />
                  </div>
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">API Key / Token</Label>
                  <Input 
                     type="password"
                     value={ch.api_key} 
                     onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, api_key: e.target.value} : c))}
                     placeholder="Global Apikey"
                     className="bg-slate-950 border-slate-800 font-mono text-xs"
                  />
               </div>
               {ch.provider === 'evolution' && (
                  <div className="space-y-2">
                     <Label className="text-[10px] uppercase font-bold text-slate-500">Instancia (Slug)</Label>
                     <Input 
                        value={ch.instance_id} 
                        onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, instance_id: e.target.value} : c))}
                        placeholder="ej: Samurai_1"
                        className="bg-slate-950 border-slate-800 font-mono text-xs"
                     />
                  </div>
               )}
               <div className="flex items-end">
                  <Button 
                     onClick={() => handleSaveChannel(ch)} 
                     disabled={saving || !ch.name || !ch.api_url}
                     className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold h-10 rounded-xl"
                  >
                     {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : "GUARDAR CONFIGURACIÓN"}
                  </Button>
               </div>
            </CardContent>
            {!ch.is_new && (
               <CardFooter className="bg-slate-950/30 border-t border-slate-800/50 py-3 px-5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                     <Globe className="w-3 h-3 text-slate-600"/>
                     <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest">Webhook Configured</span>
                  </div>
                  <div className="bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                     <span className="text-[10px] text-slate-400 font-mono select-all">
                        {`https://giwoovmvwlddaizorizk.supabase.co/functions/v1/evolution-webhook?channel_id=${ch.id}`}
                     </span>
                  </div>
               </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};