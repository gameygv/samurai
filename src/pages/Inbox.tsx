import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Search, Loader2, MessageCircle, Bot, Zap, 
  CreditCard, MessageSquarePlus, Play, Pause, X, Menu, ShoppingCart
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { MemoryPanel } from '@/components/chat/MemoryPanel';
import { AiSuggestions } from '@/components/chat/AiSuggestions';
import { sendEvolutionMessage } from '@/utils/messagingService';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Inbox = () => {
  const { user, isAdmin } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<any[]>([]);
  const [activeLead, setActiveLead] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [sending, setSending] = useState(false);
  
  const [quickActions, setQuickActions] = useState<any>({});
  const [quickReplies, setQuickReplies] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  
  const [isEditingMemory, setIsEditingMemory] = useState(false);
  const [showMemoryMobile, setShowMemoryMobile] = useState(false);
  const [memoryForm, setMemoryForm] = useState<any>({});

  // HOOK DE TIEMPO REAL - Polling estable cada 2 segundos
  const { messages, loading: loadingMessages, refetch: refetchMessages } = useRealtimeMessages(
    activeLead?.id || null,
    true
  );

  useEffect(() => {
    fetchLeads();
    fetchQuickActions();

    const channel = supabase.channel('inbox-leads-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
         fetchLeads(false); 
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (activeLead) {
       updateMemoryForm(activeLead);
       if (messages.length > 0) {
          fetchAiSuggestions(activeLead.id, messages);
       }
    }
  }, [activeLead?.id]);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    setFilteredLeads(leads.filter(l => 
      l.nombre?.toLowerCase().includes(term) || 
      l.telefono?.includes(term) ||
      l.tags?.some((t: string) => t.toLowerCase().includes(term))
    ));
  }, [searchTerm, leads]);

  const fetchLeads = async (showLoader = true) => {
    if (showLoader) setLoadingLeads(true);
    let query = supabase.from('leads').select('*').order('last_message_at', { ascending: false });
    if (!isAdmin) query = query.eq('assigned_to', user?.id);
    
    const { data } = await query;
    if (data) {
       setLeads(data);
       if (activeLead) {
          const updated = data.find(l => l.id === activeLead.id);
          if (updated) setActiveLead(updated);
       }
    }
    if (showLoader) setLoadingLeads(false);
  };

  const fetchQuickActions = async () => {
    const { data } = await supabase.from('app_config').select('key, value').in('key', ['wc_url', 'bank_name', 'bank_account', 'bank_clabe', 'bank_holder', 'quick_replies', 'wc_products']);
    if (data) {
       const config: any = data.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
       setQuickActions({
          wcBaseUrl: config.wc_url || '',
          bankInfo: `Banco: ${config.bank_name}\nCuenta: ${config.bank_account}\nCLABE: ${config.bank_clabe}\nTitular: ${config.bank_holder}`
       });
       try { if (config.quick_replies) setQuickReplies(JSON.parse(config.quick_replies)); } catch (e) {}
       try { if (config.wc_products) setProducts(JSON.parse(config.wc_products)); } catch (e) {}
    }
  };

  const fetchAiSuggestions = async (leadId: string, msgs: any[]) => {
    if (msgs.length === 0) return;
    setLoadingSuggestions(true);
    try {
      const transcript = msgs.slice(-8).map(m => `${m.emisor}: ${m.mensaje}`).join('\n');
      const { data } = await supabase.functions.invoke('get-ai-suggestions', { body: { lead_id: leadId, transcript } });
      if (data?.suggestions) setSuggestions(data.suggestions);
    } finally { setLoadingSuggestions(false); }
  };

  const updateMemoryForm = (data: any) => {
    setMemoryForm({
       nombre: data.nombre || '', apellido: data.apellido || '', email: data.email || '', summary: data.summary || '',
       mood: data.estado_emocional_actual || 'NEUTRO', buying_intent: data.buying_intent || 'BAJO',
       followup_stage: data.followup_stage || 0, next_followup_at: data.next_followup_at || null,
       ciudad: data.ciudad || '', estado: data.estado || '', cp: data.cp || '', pais: data.pais || 'mx',
       perfil_psicologico: data.perfil_psicologico || '', main_pain: data.main_pain || '',
       servicio_interes: data.servicio_interes || '', origen_contacto: data.origen_contacto || '',
       tiempo_compra: data.tiempo_compra || '', lead_score: data.lead_score || 0, assigned_to: data.assigned_to || '',
       tags: data.tags || []
    });
  };

  const handleGlobalAiToggle = async (pause: boolean) => {
    if (!confirm(`¿${pause ? 'PAUSAR' : 'ACTIVAR'} la IA para TODOS?`)) return;
    let query = supabase.from('leads').update({ ai_paused: pause });
    if (!isAdmin) query = query.eq('assigned_to', user?.id);
    else query = query.neq('id', '00000000-0000-0000-0000-000000000000');
    await query;
    toast.success(`IA ${pause ? 'Pausada' : 'Activada'} masivamente.`);
    fetchLeads();
  };

  const handleSendMessage = async (text: string, file?: File, isInternalNote: boolean = false) => {
    if (!activeLead) return;
    setSending(true);
    try {
      if (text.trim() === '#STOP' || text.trim() === '#START') {
         const isPaused = text.trim() === '#STOP';
         await supabase.from('leads').update({ ai_paused: isPaused }).eq('id', activeLead.id);
         await supabase.from('conversaciones').insert({ lead_id: activeLead.id, mensaje: `IA ${isPaused ? 'Pausada' : 'Activada'} manualmente.`, emisor: 'NOTA', platform: 'PANEL_INTERNO' });
         toast.success(`Samurai ${isPaused ? 'Pausado' : 'Activado'}`);
         setDraftMessage('');
         return;
      }

      if (isInternalNote) {
         await supabase.from('conversaciones').insert({ lead_id: activeLead.id, mensaje: text, emisor: 'NOTA', platform: 'PANEL_INTERNO' });
         toast.success("Nota guardada.");
         setDraftMessage('');
         return; 
      }

      let mediaData = undefined;
      if (file) {
        const ext = file.name.split('.').pop();
        const path = `chat_uploads/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('media').upload(path, file);
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
        let type = 'document';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        mediaData = { url: publicUrl, type, mimetype: file.type, name: file.name };
      }

      const apiResponse = await sendEvolutionMessage(activeLead.telefono, text, mediaData);
      const textToSave = text || (file ? `[ARCHIVO: ${file.name}]` : '');
      const finalMessage = apiResponse ? textToSave : `[PRUEBA / WA DESCONECTADO] ${textToSave}`;

      await supabase.from('conversaciones').insert({ 
        lead_id: activeLead.id, mensaje: finalMessage, emisor: 'HUMANO', platform: 'PANEL',
        metadata: mediaData ? { mediaUrl: mediaData.url, mediaType: mediaData.type, fileName: mediaData.name } : {}
      });

      if (user && text) {
          supabase.functions.invoke('evaluate-agent', { body: { agent_id: user.id, lead_id: activeLead.id, message_text: text } }).catch(() => {});
      }

      setDraftMessage('');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const saveMemory = async () => {
    if (!activeLead) return;
    setSending(true);
    try {
       const { data: updatedLead, error } = await supabase.from('leads').update({
             nombre: memoryForm.nombre, apellido: memoryForm.apellido, email: memoryForm.email, summary: memoryForm.summary,
             estado_emocional_actual: memoryForm.mood, buying_intent: memoryForm.buying_intent,
             ciudad: memoryForm.ciudad, estado: memoryForm.estado, cp: memoryForm.cp, pais: memoryForm.pais,
             perfil_psicologico: memoryForm.perfil_psicologico, main_pain: memoryForm.main_pain, servicio_interes: memoryForm.servicio_interes,
             origen_contacto: memoryForm.origen_contacto, tiempo_compra: memoryForm.tiempo_compra,
             lead_score: memoryForm.lead_score, assigned_to: memoryForm.assigned_to || null, tags: memoryForm.tags
          }).eq('id', activeLead.id).select().single();
       if (error) throw error;
       if (updatedLead.email && !updatedLead.capi_lead_event_sent_at) {
          supabase.functions.invoke('analyze-leads', { body: { lead_id: activeLead.id, force: true } });
       }
       toast.success('Memoria actualizada');
       setIsEditingMemory(false);
    } catch (err: any) {
       toast.error("Error: " + err.message);
    } finally {
       setSending(false);
    }
  };

  const getIntentColor = (intent: string) => {
      switch((intent || '').toUpperCase()) {
          case 'COMPRADO': return 'bg-emerald-500';
          case 'ALTO': return 'bg-amber-500';
          case 'MEDIO': return 'bg-indigo-500';
          case 'PERDIDO': return 'bg-red-500';
          default: return 'bg-slate-500';
      }
  };

  return (
    <Layout>
      <div className="h-[calc(100vh-64px)] -m-4 md:-m-8 flex overflow-hidden bg-slate-950 border-t border-slate-800">
        
        {/* COLUMNA 1: LISTA */}
        <div className={cn("w-full md:w-80 flex-shrink-0 border-r border-slate-800 bg-[#0d0a08] flex flex-col", activeLead ? "hidden md:flex" : "flex")}>
           <div className="p-4 border-b border-slate-800 bg-slate-900/50 shrink-0">
               <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2"><MessageCircle className="w-4 h-4 text-indigo-400"/> Bandeja</h2>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                       <Button variant="outline" size="icon" className="h-7 w-7 border-slate-700 bg-slate-950 text-slate-400 hover:text-indigo-400"><Bot className="w-3.5 h-3.5"/></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-slate-900 border-slate-800 text-white" align="end">
                       <DropdownMenuLabel className="text-[10px] text-slate-500 uppercase">Control IA</DropdownMenuLabel>
                       <DropdownMenuSeparator className="bg-slate-800" />
                       <DropdownMenuItem onClick={() => handleGlobalAiToggle(false)} className="text-emerald-400 cursor-pointer text-xs"><Play className="w-3.5 h-3.5 mr-2"/> Activar a Todos</DropdownMenuItem>
                       <DropdownMenuItem onClick={() => handleGlobalAiToggle(true)} className="text-red-400 cursor-pointer text-xs"><Pause className="w-3.5 h-3.5 mr-2"/> Pausar a Todos</DropdownMenuItem>
                    </DropdownMenuContent>
                 </DropdownMenu>
               </div>
               <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9 bg-slate-950 border-slate-800 text-xs rounded-xl"/>
               </div>
           </div>
           <ScrollArea className="flex-1">
              {loadingLeads ? <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-slate-600"/></div>
              : filteredLeads.length === 0 ? <div className="text-center p-8 text-xs text-slate-600 italic">No hay conversaciones.</div>
              : <div className="divide-y divide-slate-800/50">
                    {filteredLeads.map(lead => (
                       <button key={lead.id} onClick={() => setActiveLead(lead)}
                         className={cn("w-full text-left p-3 hover:bg-slate-800/30 transition-colors flex items-start gap-3 relative", activeLead?.id === lead.id ? "bg-indigo-900/20" : "")}>
                          {activeLead?.id === lead.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />}
                          <div className="relative">
                             <Avatar className="h-10 w-10 border border-slate-700">
                               <AvatarFallback className={cn("text-xs font-bold", lead.ai_paused ? "bg-red-950/50 text-red-500" : "bg-slate-800 text-slate-300")}>
                                  {lead.nombre?.substring(0,2).toUpperCase() || 'CL'}
                               </AvatarFallback>
                             </Avatar>
                             <div className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0d0a08]", getIntentColor(lead.buying_intent))} />
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-baseline mb-0.5">
                                <span className={cn("font-bold truncate text-sm flex-1", activeLead?.id === lead.id ? "text-indigo-400" : "text-slate-200")}>{lead.nombre || lead.telefono}</span>
                                <span className="text-[9px] text-slate-500 font-mono pl-2 shrink-0">{new Date(lead.last_message_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</span>
                             </div>
                             <p className={cn("text-[11px] line-clamp-1", lead.ai_paused ? "text-red-400/80" : "text-slate-400")}>
                                {lead.ai_paused && <span className="font-bold mr-1">[PAUSADA]</span>}
                                {lead.summary || 'Sin interacción reciente...'}
                             </p>
                          </div>
                       </button>
                    ))}
                 </div>}
           </ScrollArea>
        </div>

        {/* COLUMNA 2: CHAT */}
        <div className={cn("flex-1 min-w-0 flex flex-col bg-slate-950 relative", !activeLead ? "hidden md:flex items-center justify-center" : "flex")}>
           {!activeLead ? (
              <div className="text-center flex flex-col items-center gap-4 text-slate-500">
                 <MessageCircle className="w-12 h-12 opacity-20" />
                 <p className="text-sm uppercase tracking-widest font-bold">Selecciona una conversación</p>
              </div>
           ) : (
              <>
                 <div className="h-16 px-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                       <Button variant="ghost" size="icon" className="md:hidden text-slate-400 -ml-2" onClick={() => setActiveLead(null)}><X className="w-5 h-5"/></Button>
                       <div className="flex flex-col">
                          <span className="font-bold text-white flex items-center gap-2">
                             {activeLead.nombre || activeLead.telefono} 
                             {activeLead.ai_paused && <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 text-[8px] h-4 uppercase">IA PAUSADA</Badge>}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{activeLead.telefono}</span>
                       </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <Button variant="outline" size="sm" className={cn("hidden lg:flex h-8 text-xs border", activeLead.ai_paused ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500" : "bg-red-500/10 border-red-500/50 text-red-500")} onClick={() => handleSendMessage(activeLead.ai_paused ? '#START' : '#STOP')}>
                          {activeLead.ai_paused ? <><Play className="w-3 h-3 mr-2"/> Activar IA</> : <><Pause className="w-3 h-3 mr-2"/> Pausar IA</>}
                       </Button>
                       <Button variant="ghost" size="icon" className="xl:hidden text-slate-400" onClick={() => setShowMemoryMobile(!showMemoryMobile)}><Menu className="w-5 h-5" /></Button>
                    </div>
                 </div>

                 <MessageList messages={messages} loading={loadingMessages} />

                 <div className="p-3 bg-slate-900/80 border-t border-slate-800 shrink-0">
                    <div className="flex justify-between items-center mb-2 px-1">
                       <AiSuggestions suggestions={suggestions} loading={loadingSuggestions} onSelect={setDraftMessage} onRefresh={() => fetchAiSuggestions(activeLead.id, messages)} />
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                             <Button size="sm" variant="outline" className="h-7 text-[10px] bg-slate-950 border-slate-700 text-amber-500 uppercase font-bold tracking-widest"><Zap className="w-3 h-3 mr-1.5" /> Plantillas</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800 text-white w-64 max-h-[300px] overflow-y-auto">
                             <DropdownMenuLabel className="text-[10px] uppercase text-slate-500 font-bold">Catálogo</DropdownMenuLabel>
                             {products.map(p => (
                                 <DropdownMenuItem key={p.id} onClick={() => setDraftMessage(`${quickActions.wcBaseUrl}/checkout/?add-to-cart=${p.wc_id}`)} className="cursor-pointer text-xs">
                                    <ShoppingCart className="w-3 h-3 mr-2 text-indigo-400 shrink-0" /><span className="truncate">{p.title}</span>
                                 </DropdownMenuItem>
                             ))}
                             <DropdownMenuSeparator className="bg-slate-800 my-2"/>
                             <DropdownMenuItem onClick={() => setDraftMessage(quickActions.bankInfo)} className="cursor-pointer text-xs"><CreditCard className="w-3 h-3 mr-2 text-indigo-400" /> Datos Bancarios</DropdownMenuItem>
                             {quickReplies.length > 0 && <>
                                <DropdownMenuSeparator className="bg-slate-800 my-2"/>
                                {quickReplies.map((qr) => (
                                   <DropdownMenuItem key={qr.id} onClick={() => setDraftMessage(qr.text)} className="cursor-pointer text-xs">
                                      <MessageSquarePlus className="w-3 h-3 mr-2 text-indigo-400 shrink-0" /><span className="truncate">{qr.title}</span>
                                   </DropdownMenuItem>
                                ))}
                             </>}
                          </DropdownMenuContent>
                       </DropdownMenu>
                    </div>
                    <MessageInput onSendMessage={handleSendMessage} sending={sending} isAiPaused={activeLead.ai_paused} initialValue={draftMessage} />
                 </div>
              </>
           )}
        </div>

        {/* COLUMNA 3: FICHA TÁCTICA */}
        {activeLead && (
           <div className={cn("w-full xl:w-[350px] flex-shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col absolute xl:relative z-20 h-full transition-transform duration-300", showMemoryMobile ? "translate-x-0" : "translate-x-full xl:translate-x-0")}>
              <div className="xl:hidden h-16 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
                 <span className="font-bold text-sm uppercase tracking-widest text-slate-300">Ficha Táctica</span>
                 <Button variant="ghost" size="sm" onClick={() => setShowMemoryMobile(false)}><X className="w-5 h-5"/></Button>
              </div>
              <MemoryPanel currentAnalysis={activeLead} isEditing={isEditingMemory} setIsEditing={setIsEditingMemory} memoryForm={memoryForm} setMemoryForm={setMemoryForm} onSave={saveMemory} saving={sending} onReset={() => {}} onToggleFollowup={() => handleSendMessage(activeLead.ai_paused ? '#START' : '#STOP')} />
           </div>
        )}
      </div>
    </Layout>
  );
};

export default Inbox;