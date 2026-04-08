import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, Trash2, Smartphone, Globe, Key, 
  Loader2, BellRing, Send, ShieldCheck, Network, User, AlertTriangle, Zap, CheckCircle2, Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sendMessage } from '@/utils/messagingService';

export const ChannelsTab = () => {
  const [channels, setChannels] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  
  const [defaultNotifyId, setDefaultNotifyId] = useState<string>('');
  const [routingMode, setRoutingMode] = useState<'auto' | 'channel'>('auto');
  const [agentMap, setAgentMap] = useState<Record<string, string>>({});
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingRouting, setSavingRouting] = useState(false);
  
  const [testPhones, setTestPhones] = useState<Record<string, string>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [autoConfiguringId, setAutoConfiguringId] = useState<string | null>(null);
  const [showUnofficial, setShowUnofficial] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data: chs } = await supabase.from('whatsapp_channels').select('*').order('created_at', { ascending: true });
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, role').eq('is_active', true);
    const { data: cfgs } = await supabase.from('app_config').select('key, value').in('key', ['default_notification_channel', 'channel_routing_mode', 'channel_agent_map', 'show_unofficial_providers']);

    if (chs) setChannels(chs);
    if (profiles) setAgents(profiles);

    if (cfgs) {
       const cfgMap = cfgs.reduce((acc, curr) => ({...acc, [curr.key]: curr.value}), {} as Record<string, string>);
       if (cfgMap.default_notification_channel) setDefaultNotifyId(cfgMap.default_notification_channel);
       if (cfgMap.channel_routing_mode) setRoutingMode(cfgMap.channel_routing_mode as 'auto'|'channel');
       if (cfgMap.channel_agent_map) {
           try { setAgentMap(JSON.parse(cfgMap.channel_agent_map)); } catch(e) {}
       }
       setShowUnofficial(cfgMap.show_unofficial_providers === 'true');
    }
    setLoading(false);
  };

  const handleSaveRoutingImmediate = async (newMode: 'auto' | 'channel', newAgentMap: Record<string, string>) => {
     setSavingRouting(true);
     try {
         await supabase.from('app_config').upsert([
             { key: 'channel_routing_mode', value: newMode, category: 'SYSTEM' },
             { key: 'channel_agent_map', value: JSON.stringify(newAgentMap), category: 'SYSTEM' }
         ], { onConflict: 'key' });
         toast.success("Asignación actualizada en tiempo real.");
     } catch (err: any) {
         toast.error("Error al guardar enrutamiento: " + err.message);
     } finally {
         setSavingRouting(false);
     }
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

  const handleToggleActive = async (ch: any) => {
    const newStatus = ch.is_active === false ? true : false;
    const tid = toast.loading(newStatus ? "Encendiendo canal..." : "Apagando canal...");
    try {
      const { error } = await supabase.from('whatsapp_channels').update({ is_active: newStatus }).eq('id', ch.id);
      if (error) throw error;
      setChannels(channels.map(c => c.id === ch.id ? { ...c, is_active: newStatus } : c));
      toast.success(newStatus ? "Canal encendido. La IA responderá aquí." : "Canal apagado. La IA ignorará este número.", { id: tid });
    } catch (err: any) {
      toast.error("Error: " + err.message, { id: tid });
    }
  };

  const handleChangeAiMode = async (channelId: string, mode: string) => {
    const labels: Record<string, string> = { on: 'IA Activa', monitor: 'Solo Monitoreo', off: 'Canal Apagado' };
    const tid = toast.loading(`Cambiando a ${labels[mode]}...`);
    try {
      const { error } = await supabase.from('whatsapp_channels').update({ ai_mode: mode }).eq('id', channelId);
      if (error) throw error;
      setChannels(channels.map(c => c.id === channelId ? { ...c, ai_mode: mode } : c));
      toast.success(`Modo: ${labels[mode]}`, { id: tid });
    } catch (err: any) {
      toast.error("Error: " + err.message, { id: tid });
    }
  };

  const handleAddChannel = () => {
    if (showUnofficial) {
      const existingGowa = channels.find(c => c.provider === 'gowa' && c.api_key && !c.is_new);
      setChannels([...channels, {
        id: `new-${Date.now()}`, name: '', provider: 'gowa',
        api_url: existingGowa ? existingGowa.api_url : '',
        api_key: existingGowa ? existingGowa.api_key : '',
        instance_id: '', verify_token: 'samurai_v3', is_new: true, is_active: true
      }]);
      if (existingGowa) toast.info("Se ha copiado la URL y API Key de Gowa automáticamente.");
    } else {
      setChannels([...channels, {
        id: `new-${Date.now()}`, name: '', provider: 'meta',
        api_url: 'https://graph.facebook.com', api_key: '',
        instance_id: '', verify_token: 'samurai_v3', is_new: true, is_active: true
      }]);
    }
  };

  const handleSaveChannel = async (ch: any) => {
    if (!ch.name) return toast.error("Error: Falta ponerle un NOMBRE a la cuenta.");
    if (!ch.instance_id) return toast.error(`Error: Falta el ${ch.provider === 'meta' ? 'Identificador' : 'Instance ID'}.`);
    if (!ch.api_key) return toast.error("Error: Falta introducir la API Key / Token de Gowa.");

    setSaving(true);
    try {
      const { is_new, ...payload } = ch;
      const data = { 
        name: payload.name.trim(), 
        provider: payload.provider, 
        api_url: payload.provider === 'meta' ? 'https://graph.facebook.com' : payload.api_url.trim(), 
        api_key: payload.api_key.trim(), 
        instance_id: payload.instance_id.trim(), 
        verify_token: payload.verify_token || 'samurai_v3', 
        is_active: payload.is_active !== false 
      };
      
      const { error } = is_new ? await supabase.from('whatsapp_channels').insert(data) : await supabase.from('whatsapp_channels').update(data).eq('id', ch.id);
      if (error) throw error;
      toast.success("¡Canal guardado exitosamente!");
      fetchAll();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleTestChannel = async (channelId: string) => {
     const phone = testPhones[channelId];
     if (!phone || phone.length < 10) return toast.error("Ingresa un número de teléfono válido (10+ dígitos)");
     
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

  const handleAutoConfigureWebhook = async (ch: any) => {
     setAutoConfiguringId(ch.id);
     const tid = toast.loading("Inyectando configuración en servidor de Gowa...");
     try {
        const { data, error } = await supabase.functions.invoke('setup-whatsapp-webhook', { body: { channel: ch } });
        if (error) throw error;
        toast.success("¡Webhook Inyectado! Samurai ya está escuchando a Gowa.", { id: tid });
     } catch (err: any) {
        toast.error(`La auto-inyección falló. Configura el Webhook manualmente.`, { id: tid, duration: 8000 });
     } finally {
        setAutoConfiguringId(null);
     }
  };

  const handleToggleUnofficial = async (val: boolean) => {
    setShowUnofficial(val);
    await supabase.from('app_config').upsert({ key: 'show_unofficial_providers', value: String(val), category: 'SYSTEM' }, { onConflict: 'key' });
  };

  const visibleChannels = channels; // Show all channels regardless of provider

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-8">

      <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
        <div>
           <h2 className="text-lg font-bold text-white flex items-center gap-2"><Smartphone className="w-5 h-5 text-indigo-400"/> Flota Multicanal</h2>
           <p className="text-xs text-slate-500">Configura tus instancias de WhatsApp para enviar y recibir mensajes.</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800">
             <Switch checked={showUnofficial} onCheckedChange={handleToggleUnofficial} />
             <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Gowa / Evolution</span>
           </div>
           <Button onClick={handleAddChannel} className="bg-indigo-900 hover:bg-indigo-800 text-amber-500 font-bold"><Plus className="w-4 h-4 mr-2"/> AÑADIR NÚMERO</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {visibleChannels.map((ch) => (
          <Card key={ch.id} className={cn("bg-slate-900 border-slate-800 transition-all overflow-hidden", defaultNotifyId === ch.id && "border-amber-500/50 shadow-amber-900/10", ch.is_active === false && "opacity-75")}>
            
            <CardHeader className="py-4 border-b border-slate-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-950/20 gap-4">
               <div className="flex items-center gap-4 flex-1 w-full">
                  {!ch.is_new && (
                     <div className="flex flex-col items-center gap-1.5 shrink-0">
                       <div className="flex items-center gap-2 bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800">
                         <Switch checked={ch.is_active !== false} onCheckedChange={() => handleToggleActive(ch)} />
                         <span className={cn("text-[10px] font-bold uppercase tracking-widest", ch.is_active !== false ? "text-emerald-500" : "text-red-500")}>
                           {ch.is_active !== false ? "ON" : "OFF"}
                         </span>
                       </div>
                       {ch.is_active !== false && (
                         <Select value={ch.ai_mode || 'on'} onValueChange={v => handleChangeAiMode(ch.id, v)}>
                           <SelectTrigger className={cn("h-7 text-[9px] font-bold uppercase tracking-widest border rounded-lg px-2 w-full",
                             (ch.ai_mode || 'on') === 'on' ? "bg-emerald-950/50 border-emerald-500/30 text-emerald-400" :
                             ch.ai_mode === 'monitor' ? "bg-amber-950/50 border-amber-500/30 text-amber-400" :
                             "bg-red-950/50 border-red-500/30 text-red-400"
                           )}><SelectValue /></SelectTrigger>
                           <SelectContent className="bg-slate-900 border-slate-800 text-white">
                             <SelectItem value="on"><span className="flex items-center gap-1.5"><Zap className="w-3 h-3 text-emerald-400"/>IA Activa</span></SelectItem>
                             <SelectItem value="monitor"><span className="flex items-center gap-1.5"><Network className="w-3 h-3 text-amber-400"/>Solo Monitoreo</span></SelectItem>
                             <SelectItem value="off"><span className="flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-red-400"/>Apagado</span></SelectItem>
                           </SelectContent>
                         </Select>
                       )}
                     </div>
                  )}
                  
                  <div className="flex-1 min-w-0 flex flex-col">
                     <Label className={cn("text-[10px] font-bold uppercase tracking-widest mb-1", !ch.name ? "text-red-400 animate-pulse" : "text-slate-500")}>
                        {ch.is_new ? "🚨 Ponle un nombre aquí abajo ⬇️" : "Nombre Identificador"}
                     </Label>
                     <Input 
                        value={ch.name} 
                        onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, name: e.target.value} : c))} 
                        className={cn("bg-transparent font-bold text-slate-100 p-0 h-auto text-xl focus-visible:ring-0 rounded-none shadow-none", !ch.name ? "border-b-2 border-red-500 placeholder:text-red-500/50" : "border-0 border-b border-transparent hover:border-slate-700")} 
                        placeholder="Ej: WhatsApp Principal / Edith WA" 
                     />
                  </div>

                  {defaultNotifyId === ch.id && <Badge className="bg-amber-600 text-white uppercase text-[9px] font-bold shrink-0"><BellRing className="w-3 h-3 mr-1"/> Canal de Alertas</Badge>}
               </div>
               
               <div className="flex gap-2 shrink-0 self-end sm:self-auto">
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
                           <SelectItem value="meta">Meta Cloud API Oficial</SelectItem>
                           {showUnofficial && <SelectItem value="gowa">GOWA</SelectItem>}
                           {showUnofficial && <SelectItem value="evolution">Evolution API</SelectItem>}
                        </SelectContent>
                     </Select>
                  </div>
                  
                  <div className="space-y-2">
                     <Label className={cn("text-[10px] uppercase font-bold tracking-widest", !ch.instance_id ? "text-red-400" : "text-slate-500")}>
                       {ch.provider === 'meta' ? 'Identificador de Número *' : 'Instance ID de Gowa *'}
                     </Label>
                     <Input 
                        value={ch.instance_id} 
                        onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, instance_id: e.target.value} : c))} 
                        className={cn("bg-slate-950 h-11 font-mono", !ch.instance_id ? "border-red-500/50 focus-visible:ring-red-500 placeholder:text-red-500/30" : "border-slate-800")} 
                        placeholder={ch.provider === 'meta' ? "Ej: 106093498877543" : "Ej: edith"} 
                     />
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                     <Label className={cn("text-[10px] uppercase font-bold tracking-widest", !ch.api_key ? "text-red-400" : "text-slate-500")}>
                        {ch.provider === 'meta' ? 'Token de Acceso Permanente *' : 'API Key / Token de Gowa *'}
                     </Label>
                     <Input 
                        type="password" 
                        value={ch.api_key} 
                        onChange={e => setChannels(channels.map(c => c.id === ch.id ? {...c, api_key: e.target.value} : c))} 
                        className={cn("bg-slate-950 h-11 font-mono", !ch.api_key ? "border-red-500/50 focus-visible:ring-red-500 placeholder:text-red-500/30" : "border-slate-800")} 
                        placeholder={ch.provider === 'meta' ? "EAAX..." : "Pega aquí el Token de seguridad..."} 
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

               {/* SECCIÓN VINCULACIÓN DE ASESOR */}
               <div className="mt-6 p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/10">
                   <Label className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest flex items-center gap-1.5 mb-3">
                      <User className="w-4 h-4"/> Asesor Vinculado a este Canal (Vínculo Directo)
                   </Label>
                   
                   <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                      <div className="flex-1 w-full flex gap-2 items-center">
                         <Select 
                             value={agentMap[ch.id] || 'unassigned'} 
                             onValueChange={v => {
                                 const newMap = {...agentMap, [ch.id]: v === 'unassigned' ? '' : v};
                                 setAgentMap(newMap);
                                 handleSaveRoutingImmediate(routingMode, newMap); // AUTO-GUARDADO
                             }} 
                             disabled={ch.is_new || savingRouting}
                         >
                            <SelectTrigger className="bg-[#0a0a0c] border-[#333336] h-11 text-slate-200 flex-1 disabled:opacity-50"><SelectValue placeholder="Seleccionar asesor..."/></SelectTrigger>
                            <SelectContent className="bg-[#121214] border-[#222225] text-white">
                               <SelectItem value="unassigned">Ninguno (Bot Global o Auto-Routing)</SelectItem>
                               {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                            </SelectContent>
                         </Select>
                         {savingRouting && <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />}
                         {!savingRouting && agentMap[ch.id] && <span title="Guardado Automáticamente" className="flex"><CheckCircle2 className="w-5 h-5 text-emerald-500" /></span>}
                      </div>
                      
                      {ch.is_new && (
                         <p className="text-[10px] text-amber-500/80 italic md:max-w-[250px] leading-relaxed">
                            <strong className="font-bold">Aviso:</strong> Guarda este canal primero para habilitar la vinculación.
                         </p>
                      )}
                      {!ch.is_new && !agentMap[ch.id] && (
                         <p className="text-[10px] text-slate-500 italic md:max-w-[280px] leading-relaxed">
                            Sin asesor asignado → los leads se asignarán automáticamente por ciudad/territorio.
                         </p>
                      )}
                   </div>
               </div>

               <div className="mt-6 flex justify-between items-center border-t border-slate-800 pt-6">
                  <div className="text-[10px] text-slate-500 italic">
                     {ch.is_new ? "Completa los campos rojos para poder guardar." : "Configuración general del canal guardada correctamente."}
                  </div>
                  <Button onClick={() => handleSaveChannel(ch)} disabled={saving} className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-10 h-11 rounded-xl shadow-lg uppercase tracking-widest text-[10px]">
                     {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2"/> : <ShieldCheck className="w-4 h-4 mr-2"/>} 
                     {ch.is_new ? "GUARDAR CANAL Y GENERAR WEBHOOK" : "GUARDAR CAMBIOS DEL CANAL"}
                  </Button>
               </div>
            </CardContent>
            
            {!ch.is_new && (
               <div className="bg-slate-950/60 border-t border-slate-800/50 p-4 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
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
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-[10px] uppercase tracking-widest">
                           <Globe className="w-3.5 h-3.5" /> URL de Webhook:
                        </div>
                        <code className="text-[10px] text-emerald-300 bg-black p-2.5 rounded-lg border border-slate-800 block truncate select-all font-mono shadow-inner mb-2">
                           {`https://giwoovmvwlddaizorizk.supabase.co/functions/v1/evolution-webhook?channel_id=${ch.id}`}
                        </code>

                        {ch.provider === 'gowa' && (
                           <div className="bg-indigo-900/10 border border-indigo-500/20 p-3 rounded-lg text-[10px] text-indigo-300 mt-2 mb-2 space-y-1.5">
                              <p className="font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1"><Info className="w-3 h-3"/> Guía Rápida para Gowa</p>
                              <p className="leading-relaxed"><strong>Instance ID:</strong> Es el nombre de la instancia en tu panel de Gowa (ej: "edith", "principal"). Cada número de WhatsApp tiene su propio Instance ID.</p>
                              <p className="leading-relaxed"><strong>API Key:</strong> Token de seguridad de Gowa. En tu panel: Configuración → API Key. Si tienes 2 números en el mismo VPS, ambos comparten la misma URL y API Key, pero cada uno tiene su propio Instance ID.</p>
                              <p className="leading-relaxed"><strong>URL del Servidor:</strong> La dirección de tu VPS con Gowa (ej: https://gowa.tudominio.com). Si tienes múltiples números, todos usan la misma URL.</p>
                              <p className="leading-relaxed"><strong>Webhook:</strong> Haz clic en "Auto-Inyectar" o copia la URL de arriba y pégala en la configuración de Webhook de Gowa para esta instancia.</p>
                           </div>
                        )}

                        {ch.provider !== 'meta' ? (
                           <Button 
                              variant="secondary" 
                              className="w-full bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-400 font-bold uppercase tracking-widest text-[10px] h-9"
                              onClick={() => handleAutoConfigureWebhook(ch)}
                              disabled={autoConfiguringId === ch.id}
                           >
                              {autoConfiguringId === ch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2"/> : <Zap className="w-3.5 h-3.5 mr-2"/>}
                              Auto-Inyectar Webhook en Gowa
                           </Button>
                        ) : (
                           <div className="bg-amber-900/10 border border-amber-500/20 p-3 rounded-lg text-[10px] text-amber-500 mt-2 flex items-start gap-2">
                              <Info className="w-4 h-4 shrink-0 mt-0.5" />
                              <p className="leading-relaxed">
                                 Para recibir mensajes de Meta: Entra a <strong>developers.facebook.com</strong> {'>'} Configuración de WhatsApp {'>'} Webhooks. Pega esta URL y el Verify Token. <strong>¡Asegúrate de suscribirte al campo "messages"!</strong>
                              </p>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};