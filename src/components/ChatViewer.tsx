import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  MessageCircle, X, Loader2, Pause, Play, Menu, 
  Zap, ShoppingCart, CreditCard, MessageSquarePlus 
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { AiSuggestions } from '@/components/chat/AiSuggestions';
import { MemoryPanel } from '@/components/chat/MemoryPanel';
import { sendEvolutionMessage } from '@/utils/messagingService';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

interface ChatViewerProps {
  lead: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ChatViewer({ lead, open, onOpenChange }: ChatViewerProps) {
  const { user, profile } = useAuth();
  
  const [liveLead, setLiveLead] = useState<any>(lead || {});
  const leadId = liveLead?.id || null;
  
  const { messages, loading, refetch } = useRealtimeMessages(leadId, open);
  
  const [sending, setSending] = useState(false);
  const [quickActions, setQuickActions] = useState<any>({});
  const [globalReplies, setGlobalReplies] = useState<any[]>([]);
  const [localReplies, setLocalReplies] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  
  const [isEditingMemory, setIsEditingMemory] = useState(false);
  const [showMemoryMobile, setShowMemoryMobile] = useState(false);
  const [memoryForm, setMemoryForm] = useState<any>({});

  useEffect(() => {
     if (open && lead) {
        setLiveLead(lead);
        updateMemoryForm(lead);
     }
  }, [lead, open]);

  useEffect(() => {
    if (open && user) {
       fetchQuickActions();
    }
  }, [open, user]);

  useEffect(() => {
    if (open && leadId && messages && messages.length > 0) {
       fetchAiSuggestions(leadId, messages);
    }
  }, [leadId, open, messages?.length]);

  const refreshLeadData = async () => {
     if (!leadId) return;
     const { data } = await supabase.from('leads').select('*').eq('id', leadId).single();
     if (data) {
         setLiveLead(data);
         updateMemoryForm(data);
     }
  };

  const fetchQuickActions = async () => {
    if(!user) return;
    const { data } = await supabase.from('app_config').select('key, value').in('key', ['wc_url', 'bank_name', 'bank_account', 'bank_clabe', 'bank_holder', 'quick_replies', 'wc_products', `agent_templates_${user.id}`]);
    if (data) {
       const config: any = data.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
       setQuickActions({ wcBaseUrl: config.wc_url || '', bankInfo: `Banco: ${config.bank_name}\nCuenta: ${config.bank_account}\nCLABE: ${config.bank_clabe}\nTitular: ${config.bank_holder}` });
       
       try { if (config.quick_replies) { const parsed = JSON.parse(config.quick_replies); if (Array.isArray(parsed)) setGlobalReplies(parsed); } } catch (e) {}
       try { if (config[`agent_templates_${user.id}`]) { const parsed = JSON.parse(config[`agent_templates_${user.id}`]); if (Array.isArray(parsed)) setLocalReplies(parsed); } } catch (e) {}
       try { if (config.wc_products) { const parsed = JSON.parse(config.wc_products); if (Array.isArray(parsed)) setProducts(parsed); } } catch (e) {}
    }
  };

  const fetchAiSuggestions = async (id: string, msgs: any[]) => {
    if (!msgs || msgs.length === 0) return;
    setLoadingSuggestions(true);
    try {
      const transcript = msgs.slice(-8).map(m => `${m.emisor}: ${m.mensaje}`).join('\n');
      const { data, error } = await supabase.functions.invoke('get-ai-suggestions', { body: { lead_id: id, transcript } });
      if (!error && data?.suggestions && Array.isArray(data.suggestions)) {
         setSuggestions(data.suggestions);
      }
    } catch (e) { console.error("AI Suggestion failed:", e); } finally { setLoadingSuggestions(false); }
  };

  const handleAutoGenerate = async () => {
      try {
         if (!messages) return null;
         const history = messages.slice(-15).map(m => ({ role: (m.emisor === 'IA' || m.emisor === 'SAMURAI' ? 'bot' : 'user'), text: m.mensaje }));
         const { data, error } = await supabase.functions.invoke('simulate-samurai', {
            body: { question: "Por favor genera la mejor respuesta corta y persuasiva para continuar esta conversación como un experto humano.", history, customPrompts: null }
         });
         if (error) throw error;
         return data.answer as string;
      } catch (e) { 
         return null; 
      }
  };

  const updateMemoryForm = (data: any) => {
    let rems = [];
    try { rems = data.reminders ? (typeof data.reminders === 'string' ? JSON.parse(data.reminders) : data.reminders) : []; } catch(e){}
    setMemoryForm({
       nombre: String(data.nombre || ''), email: String(data.email || ''), summary: String(data.summary || ''),
       mood: String(data.estado_emocional_actual || 'NEUTRO'), buying_intent: String(data.buying_intent || 'BAJO'),
       ciudad: String(data.ciudad || ''), perfil_psicologico: String(data.perfil_psicologico || ''), assigned_to: data.assigned_to || '',
       tags: Array.isArray(data.tags) ? data.tags : [], 
       reminders: Array.isArray(rems) ? rems : []
    });
  };

  const saveMemory = async () => {
    if (!leadId) return;
    setSending(true);
    try {
       await supabase.from('leads').update({ ...memoryForm }).eq('id', leadId);
       setLiveLead((prev: any) => ({...prev, ...memoryForm}));
       toast.success('Memoria táctica actualizada');
       setIsEditingMemory(false);
    } catch (err: any) { toast.error("Error: " + err.message); } finally { setSending(false); }
  };

  const handleDeleteLead = async () => {
    if (!leadId) return;
    const tid = toast.loading("Eliminando prospecto...");
    try {
       await supabase.from('conversaciones').delete().eq('lead_id', leadId);
       await supabase.from('leads').delete().eq('id', leadId);
       toast.success("Prospecto eliminado correctamente.", { id: tid });
       onOpenChange(false);
    } catch (err: any) { toast.error("Error al eliminar: " + err.message, { id: tid }); }
  };

  const handleSendMessage = async (text: string, file?: File, isInternalNote: boolean = false) => {
    if (!leadId) return;
    setSending(true);

    try {
      if (text.trim() === '#STOP' || text.trim() === '#START') {
        const isPaused = text.trim() === '#STOP';
        await supabase.from('leads').update({ ai_paused: isPaused }).eq('id', leadId);
        setLiveLead((prev: any) => ({...prev, ai_paused: isPaused}));
        await supabase.from('conversaciones').insert({
          lead_id: leadId,
          mensaje: `IA ${isPaused ? 'Pausada' : 'Activada'} manualmente.`,
          emisor: 'NOTA',
          platform: 'PANEL_INTERNO',
        });
        toast.success(`Samurai ${isPaused ? 'pausado' : 'activado'}`);
        refetch();
        return;
      }

      if (isInternalNote) {
        await supabase.from('conversaciones').insert({
          lead_id: leadId,
          mensaje: text,
          emisor: 'NOTA',
          platform: 'PANEL_INTERNO',
          metadata: { author: profile?.full_name || 'Agente' }
        });
        toast.success('Nota guardada');
        setDraftMessage('');
        refetch();
        return;
      }

      let mediaData: { url: string; type: string; mimetype: string; name: string } | undefined;

      if (file) {
        const ext = file.name.split('.').pop() || 'bin';
        const filePath = `chat_uploads/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);
        mediaData = {
          url: publicUrl,
          type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document',
          mimetype: file.type,
          name: file.name,
        };
      }

      await sendEvolutionMessage(liveLead.telefono, text, leadId, mediaData);

      await supabase.from('conversaciones').insert({
        lead_id: leadId,
        mensaje: text || (file ? `[ARCHIVO: ${file.name}]` : ''),
        emisor: 'HUMANO',
        platform: 'PANEL',
        metadata: mediaData ? { mediaUrl: mediaData.url, mediaType: mediaData.type, fileName: mediaData.name } : {},
      });

      setDraftMessage('');
      refetch();
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  if (!leadId) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-5xl bg-[#050505] border-l border-[#1a1a1a] p-0 text-white">
          <div className="flex h-full items-center justify-center text-slate-500 text-sm uppercase tracking-widest font-bold">
            No se pudo cargar el chat.
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const initials = String(liveLead.nombre || 'CL').slice(0, 2).toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-7xl bg-[#050505] border-l border-[#1a1a1a] p-0 text-white flex flex-row h-[100dvh] shadow-2xl">
        
        {/* COLUMNA 1: CHAT */}
        <div className={cn("flex-1 min-w-0 flex flex-col bg-[#050505] relative", showMemoryMobile ? "hidden md:flex" : "flex")}>
          {/* HEADER */}
          <div className="flex h-[72px] items-center justify-between border-b border-[#1a1a1a] bg-[#0a0a0c]/90 backdrop-blur-md px-6 shrink-0">
            <div className="flex items-center gap-4 min-w-0">
              <Avatar className="h-10 w-10 border border-[#222225] bg-[#121214]">
                <AvatarFallback className="bg-transparent text-indigo-400 font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-white">{liveLead.nombre || liveLead.telefono}</p>
                  <Badge variant="outline" className="hidden sm:inline-flex border-[#333336] text-[9px] uppercase text-slate-400 bg-[#121214]">
                    {liveLead.platform || 'WHATSAPP'}
                  </Badge>
                </div>
                <p className="text-[10px] font-mono text-slate-500 mt-0.5">{liveLead.telefono}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {liveLead.payment_status === 'VALID' && (
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] uppercase font-bold tracking-widest px-2 h-6">
                  Pago OK
                </Badge>
              )}
              
              <Button variant="ghost" size="icon" className="xl:hidden text-slate-400 hover:text-white" onClick={() => setShowMemoryMobile(!showMemoryMobile)}>
                 <Menu className="w-5 h-5" />
              </Button>
              
              <Button size="icon" variant="ghost" className="text-slate-500 hover:text-white hover:bg-red-500/20 hover:border-red-500/50 rounded-xl transition-all" onClick={() => onOpenChange(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* MESSAGES */}
          <div className="flex-1 min-h-0 flex flex-col relative bg-[#0a0a0c]">
             <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-[#050505] to-transparent z-10 pointer-events-none" />
             <MessageList messages={Array.isArray(messages) ? messages : []} loading={loading} />
          </div>

          {/* INPUT AREA */}
          <div className="bg-[#0a0a0c] border-t border-[#1a1a1a] p-4 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-20">
            <AiSuggestions suggestions={suggestions} loading={loadingSuggestions} onSelect={setDraftMessage} onRefresh={() => fetchAiSuggestions(leadId, messages)} />
            
            <MessageInput
              onSendMessage={handleSendMessage}
              sending={sending}
              isAiPaused={liveLead.ai_paused}
              initialValue={draftMessage}
              onAutoGenerate={handleAutoGenerate}
              toolbarAction={
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                       <Button size="sm" variant="outline" className="h-8 text-[10px] bg-[#121214] border-[#222225] text-amber-500 uppercase font-bold tracking-widest rounded-lg hover:bg-[#161618]">
                          <Zap className="w-3 h-3 mr-1.5" /> Plantillas
                       </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-[#0a0a0c] border-[#222225] text-white w-64 max-h-[300px] overflow-y-auto">
                       {Array.isArray(products) && products.length > 0 && <>
                          <DropdownMenuLabel className="text-[10px] uppercase text-slate-500 font-bold">Catálogo</DropdownMenuLabel>
                          {products.map(p => (
                              <DropdownMenuItem key={p.id || p.title} onClick={() => setDraftMessage(`${quickActions.wcBaseUrl}/checkout/?add-to-cart=${p.wc_id}`)} className="cursor-pointer text-xs focus:bg-[#161618] focus:text-white">
                                 <ShoppingCart className="w-3 h-3 mr-2 text-indigo-400 shrink-0" /><span className="truncate">{String(p.title)}</span>
                              </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator className="bg-[#222225] my-2"/>
                       </>}
                       
                       <DropdownMenuItem onClick={() => setDraftMessage(quickActions.bankInfo)} className="cursor-pointer text-xs focus:bg-[#161618] focus:text-white">
                          <CreditCard className="w-3 h-3 mr-2 text-indigo-400" /> Datos Bancarios
                       </DropdownMenuItem>
                       
                       {Array.isArray(globalReplies) && globalReplies.length > 0 && <>
                          <DropdownMenuSeparator className="bg-[#222225] my-2"/>
                          <DropdownMenuLabel className="text-[10px] uppercase text-slate-500 font-bold">Plantillas Globales</DropdownMenuLabel>
                          {globalReplies.map((qr) => (
                             <DropdownMenuItem key={qr.id || qr.title} onClick={() => setDraftMessage(qr.text)} className="cursor-pointer text-xs focus:bg-[#161618] focus:text-white">
                                <MessageSquarePlus className="w-3 h-3 mr-2 text-indigo-400 shrink-0" /><span className="truncate">{String(qr.title)}</span>
                             </DropdownMenuItem>
                          ))}
                       </>}

                       {Array.isArray(localReplies) && localReplies.length > 0 && <>
                          <DropdownMenuSeparator className="bg-[#222225] my-2"/>
                          <DropdownMenuLabel className="text-[10px] uppercase text-slate-500 font-bold">Mis Plantillas Privadas</DropdownMenuLabel>
                          {localReplies.map((qr) => (
                             <DropdownMenuItem key={qr.id || qr.title} onClick={() => setDraftMessage(qr.text)} className="cursor-pointer text-xs focus:bg-[#161618] focus:text-white">
                                <MessageSquarePlus className="w-3 h-3 mr-2 text-amber-500 shrink-0" /><span className="truncate">{String(qr.title)}</span>
                             </DropdownMenuItem>
                          ))}
                       </>}
                    </DropdownMenuContent>
                 </DropdownMenu>
              }
            />
          </div>
        </div>

        {/* COLUMNA 2: MEMORY PANEL (FICHA TÁCTICA) */}
        <div className={cn(
           "w-full xl:w-[380px] flex-shrink-0 bg-[#0a0a0c] border-l border-[#1a1a1a] flex flex-col absolute xl:relative z-30 h-[100dvh] transition-transform duration-300", 
           showMemoryMobile ? "translate-x-0" : "translate-x-full xl:translate-x-0"
        )}>
          <div className="xl:hidden p-4 border-b border-[#1a1a1a] flex justify-between items-center bg-[#0a0a0c]">
             <span className="font-bold text-sm uppercase tracking-widest text-slate-200">Ficha Táctica</span>
             <Button variant="ghost" size="icon" onClick={() => setShowMemoryMobile(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></Button>
          </div>
          
          <MemoryPanel 
            currentAnalysis={liveLead} 
            isEditing={isEditingMemory} 
            setIsEditing={setIsEditingMemory} 
            memoryForm={memoryForm} 
            setMemoryForm={setMemoryForm} 
            onSave={saveMemory} 
            saving={sending} 
            onReset={() => {}} 
            onToggleFollowup={() => handleSendMessage(liveLead.ai_paused ? '#START' : '#STOP')} 
            onAnalysisComplete={() => { refreshLeadData(); refetch(); }} 
            onDeleteLead={handleDeleteLead}
          />
        </div>

      </SheetContent>
    </Sheet>
  );
}