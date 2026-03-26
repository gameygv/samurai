import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Trash2, Smartphone, Globe, Key, 
  CheckCircle2, AlertCircle, Loader2, RefreshCw, Layers, ShieldCheck, BellRing, Info, Send
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sendMessage } from '@/utils/messagingService';

export const ChannelsTab = () => {
  const [channels, setChannels] = useState<any[]>([]);
  const [defaultNotifyId, setDefaultNotifyId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // States para pruebas
  const [testPhones, setTestPhones] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

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
    if (defaultNotifyId === id) {
       setDefaultNotifyId('');
       await supabase.from('app_config').delete().eq('key', 'default_notification_channel');
       toast.success("Alertas desactivadas para este canal.");
    } else {
       setDefaultNotifyId(id);
       await supabase.from('app_config').upsert({ key: 'default_notification_channel', value: id, category: 'SYSTEM' }, { onConflict: 'key' });
       toast.success("Canal de alertas maestro actualizado.");
    }
  };

  const handleAddChannel = () => {
    setChannels([...channels, { id: `new-${Date.now()}`, name: '', provider: 'gowa', api_url: '', api_key: '', instance_id: '', verify_token: 'samurai_v3', is_new: true }]);
  };

  const handleSaveChannel = async (ch: any) => {
    if (!ch.name || !ch.api_key || !ch.instance_id) {
        toast.error("Por favor completa Nombre, API Key e ID de Instancia/Teléfono");
        return;
    }
    setSaving(true);
    try {
      const { is_new, ...payload } = ch;
      const data = { 
        name: payload.name, 
        provider: payload.provider, 
        api_url: payload.provider === 'meta' ? 'https://graph.facebook.com' : payload.api_url, 
        api_key: payload.api_key, 
        instance_id: payload.instance_id, 
        verify_token: payload.verify_token || 'samurai_v3', 
        is_active: true 
      };
      
      const { error } = is_new ? await supabase.from('whatsapp_channels').insert(data) : await supabase.from('whatsapp_channels').update(data).eq('id', ch.id);
      if (error) throw error;
      toast.success("¡Canal guardado exitosamente!");
      fetchAll();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleTestChannel = async (channelId: string) => {
     const phone = testPhones[channelId];
     if (!phone || phone.length < 10) {
        toast.error("Ingresa un número de teléfono válido (10+ dígitos)");
        return;
     }

     setTestingId(channelId);
     const tid = toast.loading("Enviando mensaje de prueba...");
     try {
        await sendMessage(phone, "🛡️ Samurai Kernel: Prueba de conexión exitosa.", undefined, undefined, channelId);
        toast.success("¡Mensaje enviado! Revisa tu WhatsApp.", { id: tid });
     } catch (err: any) {
        toast.error("Fallo de envío: " + err.message, { id: tid });
     } finally {
        setTestingId(null);
     }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
        <div>
           <h2 className="text-lg font-bold text-white flex items-center gap-2"><Smartphone className="w-5 h-5 text-indigo-400"/> Flota Multicanal</h2>
           <p className="text-xs text-slate-500">Configura tus instancias de WhatsApp para enviar y recibir mensajes.</p>
        </div>
        <Button onClick={handleAddChannel} className="bg-indigo-900 hover:bg-indigo-800 text-amber-500 font-bold"><Plus className="w-4 h-4 mr-2"/> AÑADIR NÚMERO</Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {channels.map((ch) => (
          <Card key={ch.id} className={cn("bg-slate-900 border-slate-800 transition-all overflow-hidden", defaultNotifyId === ch.id && "border-amber-500/50 shadow-amber-900/10")}>
            <CardHeader className="py-4 border-b border-slate-800/50 flex flex-row items-center justify-between bg-slate-950/20">
               <div className="flex items-center gap-4 flex-1">
                  <Input value={ch.name} onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, name: e.target.value} : c))} className="bg-transparent border-0 font-bold text-slate-100 p-0 h-auto text-lg focus-visible:ring-0" placeholder="Nombre de la cuenta (Ej: WhatsApp Principal)" />
                  {defaultNotifyId === ch.id && <Badge className="bg-amber-600 text-white uppercase text-[9px] font-bold shrink-0"><BellRing className="w-3 h-3 mr-1"/> Canal de Alertas</Badge>}
               </div>
               <div className="flex gap-2 shrink-0">
                  {!ch.is_new && defaultNotifyId === ch.id && (
                     <Button variant="outline" size="sm" onClick={() => handleSetDefault(ch.id)} className="text-[10px] border-amber-500/50 text-amber-500 hover:bg-amber-900/20 uppercase font-bold">Desactivar Alertas</Button>
                  )}
                  {!ch.is_new && defaultNotifyId !== ch.id && (
                     <Button variant="ghost" size="sm" onClick={() => handleSetDefault(ch.id)} className="text-[10px] text-slate-400 hover:text-amber-500 uppercase font-bold">Usar para Alertas</Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={async () => { if(confirm("¿Eliminar este canal?")) { await supabase.from('whatsapp_channels').delete().eq('id', ch.id); fetchAll(); } }} className="text-slate-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
               </div>
            </CardHeader>
            <CardContent className="p-6">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div className="space-y-2">
                     <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Proveedor</Label>
                     <Select value={ch.provider} onValueChange={v => setChannels(channels.map(c => c.id === ch.id ? {...c, provider: v} : c))}>
                        <SelectTrigger className="bg-slate-950 border-slate-800 h-11"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                           <SelectItem value="gowa">GOWA (Recomendado)</SelectItem>
                           <SelectItem value="meta">Meta Cloud API Oficial</SelectItem>
                           <SelectItem value="evolution">Evolution API</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
                  
                  <div className="space-y-2">
                     <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                       {ch.provider === 'meta' ? 'Identificador de Número' : 'Instance ID'}
                     </Label>
                     <Input 
                        value={ch.instance_id} 
                        onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, instance_id: e.target.value} : c))} 
                        className="bg-slate-950 border-slate-800 h-11 font-mono" 
                        placeholder={ch.provider === 'meta' ? "Ej: 106093498877543" : "Ej: instancia-gowa"} 
                     />
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                     <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                        {ch.provider === 'meta' ? 'Token de Acceso Permanente' : 'API Key / Token'}
                     </Label>
                     <Input 
                        type="password" 
                        value={ch.api_key} 
                        onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, api_key: e.target.value} : c))} 
                        className="bg-slate-950 border-slate-800 h-11 font-mono" 
                        placeholder={ch.provider === 'meta' ? "EAAX..." : "Token de seguridad..."} 
                     />
                  </div>

                  <div className="space-y-2">
                     <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-1"><Key className="w-3 h-3"/> Verify Token</Label>
                     <Input 
                        value={ch.verify_token || 'samurai_v3'} 
                        onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, verify_token: e.target.value} : c))} 
                        className="bg-slate-950 border-slate-800 h-11 font-mono text-emerald-400" 
                        placeholder="Para verificar Webhook" 
                     />
                  </div>

                  {ch.provider !== 'meta' && (
                      <div className="space-y-2 lg:col-span-2">
                         <Label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">URL del Servidor</Label>
                         <Input 
                            value={ch.api_url} 
                            onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, api_url: e.target.value} : c))} 
                            placeholder="https://gowa.poesis.net"
                            className="bg-slate-950 border-slate-800 font-mono text-xs h-11" 
                         />
                      </div>
                  )}
               </div>

               <div className="mt-6 flex justify-between items-center">
                  <div className="text-[10px] text-slate-500 italic">
                     {ch.is_new ? "Completa los campos y guarda para generar el Webhook." : "Configuración guardada correctamente."}
                  </div>
                  <Button onClick={() => handleSaveChannel(ch)} disabled={saving} className="bg-indigo-900 hover:bg-indigo-800 text-amber-500 font-bold px-10 h-11 rounded-xl shadow-lg">
                     {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2"/> : <ShieldCheck className="w-4 h-4 mr-2"/>} 
                     {ch.is_new ? "CREAR Y GENERAR WEBHOOK" : "GUARDAR CAMBIOS"}
                  </Button>
               </div>
            </CardContent>
            
            {!ch.is_new && (
               <div className="bg-slate-950/60 border-t border-slate-800/50 p-4 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                     <div className="flex-1 space-y-2">
                        <Label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                           <Send className="w-3.5 h-3.5" /> Enviar Mensaje de Prueba:
                        </Label>
                        <div className="flex gap-2">
                           <Input 
                              placeholder="Teléfono (ej: 521...)" 
                              value={testPhones[ch.id] || ''} 
                              onChange={e => setTestPhones({...testPhones, [ch.id]: e.target.value})}
                              className="bg-black border-slate-800 h-10 text-xs font-mono max-w-[200px]"
                           />
                           <Button 
                              size="sm" 
                              variant="outline" 
                              className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 h-10 px-4 font-bold text-[10px] uppercase"
                              onClick={() => handleTestChannel(ch.id)}
                              disabled={testingId === ch.id}
                           >
                              {testingId === ch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2"/> : <Send className="w-3.5 h-3.5 mr-2"/>}
                              EJECUTAR TEST
                           </Button>
                        </div>
                     </div>
                     
                     <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 text-indigo-400 font-bold text-[10px] uppercase tracking-widest">
                           <Globe className="w-3.5 h-3.5" /> URL de Webhook:
                        </div>
                        <code className="text-[10px] text-indigo-300 bg-black p-2.5 rounded-lg border border-slate-800 block truncate select-all font-mono">
                           {`https://giwoovmvwlddaizorizk.supabase.co/functions/v1/evolution-webhook?channel_id=${ch.id}`}
                        </code>
                     </div>
                  </div>
               </div>
            )}

            {ch.is_new && (
                <div className="bg-amber-900/10 p-4 border-t border-slate-800/50 flex items-center gap-3">
                    <Info className="w-5 h-5 text-amber-500 shrink-0" />
                    <p className="text-[10px] text-amber-500/80 leading-relaxed uppercase font-bold tracking-tight">
                        Primero haz clic en "CREAR Y GENERAR WEBHOOK" para habilitar las pruebas de salida.
                    </p>
                </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};