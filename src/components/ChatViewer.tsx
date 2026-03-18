import React, { useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageCircle, X, Loader2, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { sendEvolutionMessage } from '@/utils/messagingService';

interface ChatViewerProps {
  lead: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getSafe(lead: any) {
  if (!lead || typeof lead !== 'object') {
    return null;
  }
  return {
    id: String(lead.id || ''),
    nombre: String(lead.nombre || 'Cliente'),
    telefono: String(lead.telefono || ''),
    email: String(lead.email || ''),
    ciudad: String(lead.ciudad || ''),
    buying_intent: String(lead.buying_intent || 'BAJO'),
    ai_paused: Boolean(lead.ai_paused),
    payment_status: String(lead.payment_status || 'NONE'),
    platform: String(lead.platform || 'WHATSAPP'),
    channel_id: String(lead.channel_id || ''),
  };
}

const ChatViewer = ({ lead, open, onOpenChange }: ChatViewerProps) => {
  const safe = getSafe(lead);
  const leadId = safe?.id || null;
  const { messages, loading, refetch } = useRealtimeMessages(leadId, open);
  const [sending, setSending] = useState(false);

  // Si no hay lead válido, no renderizar nada dentro del Sheet
  if (!safe || !safe.id) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-5xl bg-[#050505] border-l border-[#1a1a1a] p-0 text-white">
          <div className="flex h-full items-center justify-center text-slate-500 text-sm">
            No se pudo cargar el chat. Intenta de nuevo.
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const initials = safe.nombre.slice(0, 2).toUpperCase() || 'CL';

  const handleSendMessage = async (text: string, file?: File, isInternalNote?: boolean) => {
    if (!safe.id) return;
    setSending(true);

    try {
      if (text.trim() === '#STOP' || text.trim() === '#START') {
        const isPaused = text.trim() === '#STOP';
        await supabase.from('leads').update({ ai_paused: isPaused }).eq('id', safe.id);
        await supabase.from('conversaciones').insert({
          lead_id: safe.id,
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
          lead_id: safe.id,
          mensaje: text,
          emisor: 'NOTA',
          platform: 'PANEL_INTERNO',
        });
        toast.success('Nota guardada');
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

      await sendEvolutionMessage(safe.telefono, text, safe.id, mediaData);

      await supabase.from('conversaciones').insert({
        lead_id: safe.id,
        mensaje: text || (file ? `[ARCHIVO: ${file.name}]` : ''),
        emisor: 'HUMANO',
        platform: 'PANEL',
        metadata: mediaData ? { mediaUrl: mediaData.url, mediaType: mediaData.type, fileName: mediaData.name } : {},
      });

      refetch();
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-5xl bg-[#050505] border-l border-[#1a1a1a] p-0 text-white">
        <div className="flex h-full flex-col bg-[#050505]">
          {/* HEADER */}
          <div className="flex h-16 items-center justify-between border-b border-[#1a1a1a] bg-[#0a0a0c] px-4">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-10 w-10 border border-[#222225] bg-[#121214]">
                <AvatarFallback className="bg-transparent text-indigo-400 font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-white">{safe.nombre}</p>
                  <Badge variant="outline" className="hidden sm:inline-flex border-[#333336] text-[9px] uppercase text-slate-400">
                    {safe.platform}
                  </Badge>
                </div>
                <p className="text-[10px] font-mono text-slate-500">{safe.telefono || 'Sin teléfono'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {safe.payment_status === 'VALID' && (
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] uppercase">
                  Pago OK
                </Badge>
              )}
              <Button
                size="sm"
                variant="outline"
                className="border-[#333336] bg-[#121214] text-slate-300 hover:bg-[#161618]"
                onClick={() => handleSendMessage(safe.ai_paused ? '#START' : '#STOP')}
                disabled={sending}
              >
                {safe.ai_paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* MESSAGES */}
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              </div>
            ) : (
              <MessageList messages={Array.isArray(messages) ? messages : []} loading={false} />
            )}
          </div>

          {/* INPUT */}
          <div className="border-t border-[#1a1a1a] bg-[#0a0a0c] p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500">
              <MessageCircle className="h-3.5 w-3.5" />
              Chat activo
            </div>
            <MessageInput
              onSendMessage={handleSendMessage}
              sending={sending}
              isAiPaused={safe.ai_paused}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ChatViewer;