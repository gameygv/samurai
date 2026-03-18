import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ChatHeader } from './chat/ChatHeader';
import { MessageList } from './chat/MessageList';
import { MessageInput } from './chat/MessageInput';
import { MemoryPanel } from './chat/MemoryPanel';
import { AiSuggestions } from './chat/AiSuggestions';
import { Button } from '@/components/ui/button';
import { Zap, CreditCard, X, Menu, MessageSquarePlus, ShoppingCart } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { sendEvolutionMessage } from '@/utils/messagingService';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import { normalizeLeadForChat } from '@/lib/chat-normalizer';
import { ChatErrorBoundary } from '@/components/chat/ChatErrorBoundary';

interface ChatViewerProps {
  lead: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ChatViewer = ({ lead: initialLead, open, onOpenChange }: ChatViewerProps) => {
  const { user } = useAuth();
  const [lead, setLead] = useState(normalizeLeadForChat(initialLead));
  const [sending, setSending] = useState(false);
  const [isEditingMemory, setIsEditingMemory] = useState(false);
  const [showMemoryMobile, setShowMemoryMobile] = useState(false);
  const [quickActions, setQuickActions] = useState<any>({});
  const [globalReplies, setGlobalReplies] = useState<any[]>([]);
  const [localReplies, setLocalReplies] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [memoryForm, setMemoryForm] = useState<any>({
    nombre: '', email: '', summary: '', mood: 'NEUTRO', buying_intent: 'BAJO',
    ciudad: '', perfil_psicologico: '', assigned_to: '', tags: [], reminders: []
  });

  const { messages, loading: loadingMessages, refetch: refetchMessages } = useRealtimeMessages(lead?.id || null, open);

  useEffect(() => {
    const normalized = normalizeLeadForChat(initialLead);
    setLead(normalized);
    if (normalized) updateMemoryForm(normalized);
    fetchQuickActions();
  }, [initialLead, user]);

  useEffect(() => {
    let leadChannel: any;
    if (open && lead?.id) {
      leadChannel = supabase.channel(`lead-watch-${lead.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads', filter: `id=eq.${lead.id}` }, (payload) => {
          const normalized = normalizeLeadForChat(payload.new);
          setLead(normalized);
          updateMemoryForm(normalized);
        }).subscribe();
    }
    return () => { if (leadChannel) supabase.removeChannel(leadChannel); };
  }, [open, lead?.id]);

  useEffect(() => {
    if (lead?.id && messages && messages.length > 0) {
      fetchAiSuggestions(lead.id, messages);
    }
  }, [lead?.id, messages]);

  const fetchQuickActions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', ['wc_url', 'bank_name', 'bank_account', 'bank_clabe', 'bank_holder', 'quick_replies', 'wc_products', `agent_templates_${user.id}`]);

    if (data) {
      const config: any = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
      setQuickActions({
        wcBaseUrl: config.wc_url || '',
        bankInfo: `Banco: ${config.bank_name}\nCuenta: ${config.bank_account}\nCLABE: ${config.bank_clabe}\nTitular: ${config.bank_holder}`
      });

      try {
        const parsed = JSON.parse(config.quick_replies || '[]');
        setGlobalReplies(Array.isArray(parsed) ? parsed : []);
      } catch {
        setGlobalReplies([]);
      }

      try {
        const parsed = JSON.parse(config[`agent_templates_${user.id}`] || '[]');
        setLocalReplies(Array.isArray(parsed) ? parsed : []);
      } catch {
        setLocalReplies([]);
      }

      try {
        const parsed = JSON.parse(config.wc_products || '[]');
        setProducts(Array.isArray(parsed) ? parsed : []);
      } catch {
        setProducts([]);
      }
    }
  };

  const updateMemoryForm = (data: any) => {
    if (!data) return;
    setMemoryForm({
      nombre: data.nombre || '',
      email: data.email || '',
      summary: data.summary || '',
      mood: data.estado_emocional_actual || 'NEUTRO',
      buying_intent: data.buying_intent || 'BAJO',
      ciudad: data.ciudad || '',
      perfil_psicologico: data.perfil_psicologico || '',
      assigned_to: data.assigned_to || '',
      channel_id: data.channel_id || null,
      tags: Array.isArray(data.tags) ? data.tags : [],
      reminders: Array.isArray(data.reminders) ? data.reminders : []
    });
  };

  const fetchAiSuggestions = async (leadId: string, msgs: any[]) => {
    if (!leadId || !msgs?.length) return;
    setLoadingSuggestions(true);
    try {
      const transcript = msgs.slice(-8).map(m => `${m.emisor}: ${m.mensaje}`).join('\n');
      const { data, error } = await supabase.functions.invoke('get-ai-suggestions', {
        body: { lead_id: leadId, transcript }
      });
      if (!error && Array.isArray(data?.suggestions)) {
        setSuggestions(data.suggestions);
      } else {
        setSuggestions([]);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAutoGenerate = async () => {
    try {
      const history = (messages || []).slice(-15).map(m => ({
        role: (m.emisor === 'IA' || m.emisor === 'SAMURAI' ? 'bot' : 'user'),
        text: m.mensaje
      }));
      const { data, error } = await supabase.functions.invoke('simulate-samurai', {
        body: { question: "Genera una respuesta corta y persuasiva.", history, customPrompts: null }
      });
      if (error) throw error;
      return data.answer as string;
    } catch {
      return null;
    }
  };

  const handleSendMessage = async (text: string, file?: File, isInternalNote: boolean = false) => {
    if (!lead) return;
    setSending(true);
    try {
      if (text.trim() === '#STOP' || text.trim() === '#START') {
        const isPaused = text.trim() === '#STOP';
        await supabase.from('leads').update({ ai_paused: isPaused }).eq('id', lead.id);
        await supabase.from('conversaciones').insert({
          lead_id: lead.id,
          mensaje: `IA ${isPaused ? 'Pausada' : 'Activada'} manualmente.`,
          emisor: 'NOTA',
          platform: 'PANEL_INTERNO'
        });
        setDraftMessage('');
        return;
      }

      if (isInternalNote) {
        await supabase.from('conversaciones').insert({
          lead_id: lead.id,
          mensaje: text,
          emisor: 'NOTA',
          platform: 'PANEL_INTERNO'
        });
        setDraftMessage('');
        return;
      }

      let mediaData = undefined;
      if (file) {
        const ext = file.name.split('.').pop();
        const path = `chat_uploads/${Date.now()}.${ext}`;
        await supabase.storage.from('media').upload(path, file);
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path);
        mediaData = {
          url: publicUrl,
          type: file.type.startsWith('image/') ? 'image' : 'document',
          mimetype: file.type,
          name: file.name
        };
      }

      await sendEvolutionMessage(lead.telefono, text, lead.id, mediaData);

      await supabase.from('conversaciones').insert({
        lead_id: lead.id,
        mensaje: text || (file ? `[ARCHIVO: ${file.name}]` : ''),
        emisor: 'HUMANO',
        platform: 'PANEL',
        metadata: mediaData ? { mediaUrl: mediaData.url, mediaType: mediaData.type, fileName: mediaData.name } : {}
      });

      setDraftMessage('');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const saveMemory = async () => {
    if (!lead) return;
    setSending(true);
    try {
      await supabase.from('leads').update({ ...memoryForm }).eq('id', lead.id);
      toast.success('Memoria actualizada');
      setIsEditingMemory(false);
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-6xl flex flex-col sm:flex-row bg-slate-950 border-l border-slate-800 text-white p-0 overflow-hidden">
        <ChatErrorBoundary>
          <div className={cn("flex-1 min-w-0 flex flex-col h-full bg-slate-950 transition-all", showMemoryMobile ? "hidden sm:flex" : "flex")}>
            <ChatHeader lead={lead} isAiPaused={lead?.ai_paused} sending={sending} onSendCommand={(cmd) => handleSendMessage(cmd)} />
            <MessageList messages={messages || []} loading={loadingMessages} />
            <div className="p-3 bg-slate-900/80 border-t border-slate-800 shrink-0">
              <AiSuggestions suggestions={Array.isArray(suggestions) ? suggestions : []} loading={loadingSuggestions} onSelect={setDraftMessage} onRefresh={() => fetchAiSuggestions(lead?.id, messages || [])} />
              <MessageInput
                onSendMessage={handleSendMessage}
                sending={sending}
                isAiPaused={!!lead?.ai_paused}
                initialValue={draftMessage}
                onAutoGenerate={handleAutoGenerate}
                toolbarAction={
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 text-[10px] bg-slate-950 border-slate-700 text-amber-500 uppercase font-bold tracking-widest rounded-lg">
                        <Zap className="w-3 h-3 mr-1.5" /> Plantillas
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-slate-900 border-slate-800 text-white w-64 max-h-[300px] overflow-y-auto">
                      {products.length > 0 && (
                        <>
                          <DropdownMenuLabel className="text-[10px] uppercase text-slate-500 font-bold">Catálogo</DropdownMenuLabel>
                          {products.map((p) => (
                            <DropdownMenuItem key={p.id || p.title} onClick={() => setDraftMessage(`${quickActions.wcBaseUrl}/checkout/?add-to-cart=${p.wc_id}`)} className="cursor-pointer text-xs">
                              <ShoppingCart className="w-3 h-3 mr-2 text-indigo-400 shrink-0" />
                              <span className="truncate">{p.title}</span>
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator className="bg-slate-800 my-2" />
                        </>
                      )}
                      <DropdownMenuItem onClick={() => setDraftMessage(quickActions.bankInfo)} className="cursor-pointer text-xs">
                        <CreditCard className="w-3 h-3 mr-2 text-indigo-400" /> Datos Bancarios
                      </DropdownMenuItem>
                      {globalReplies.map((qr) => (
                        <DropdownMenuItem key={qr.id || qr.title} onClick={() => setDraftMessage(qr.text)} className="cursor-pointer text-xs">
                          <MessageSquarePlus className="w-3 h-3 mr-2 text-indigo-400 shrink-0" />
                          <span className="truncate">{qr.title}</span>
                        </DropdownMenuItem>
                      ))}
                      {localReplies.map((qr) => (
                        <DropdownMenuItem key={qr.id || qr.title} onClick={() => setDraftMessage(qr.text)} className="cursor-pointer text-xs">
                          <MessageSquarePlus className="w-3 h-3 mr-2 text-amber-500 shrink-0" />
                          <span className="truncate">{qr.title}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              />
            </div>
          </div>

          <div className={cn("w-full sm:w-[380px] sm:min-w-[380px] flex-shrink-0 bg-slate-900/50 border-l border-slate-800 flex flex-col overflow-y-auto absolute sm:relative z-20 h-full transition-transform duration-300", showMemoryMobile ? "translate-x-0" : "translate-x-full sm:translate-x-0")}>
            <MemoryPanel
              currentAnalysis={lead}
              isEditing={isEditingMemory}
              setIsEditing={setIsEditingMemory}
              memoryForm={memoryForm}
              setMemoryForm={setMemoryForm}
              onSave={saveMemory}
              saving={sending}
              onReset={() => {}}
              onToggleFollowup={() => handleSendMessage(lead?.ai_paused ? '#START' : '#STOP')}
              onAnalysisComplete={() => refetchMessages()}
            />
          </div>
        </ChatErrorBoundary>
      </SheetContent>
    </Sheet>
  );
};

export default ChatViewer;