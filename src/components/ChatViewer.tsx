import React, { useMemo, useState } from 'react';
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

const safeLead = (lead: any) => ({
  id: lead?.id ?? '',
  nombre: typeof lead?.nombre === 'string' ? lead.nombre : 'Cliente',
  telefono: typeof lead?.telefono === 'string' ? lead.telefono : '',
  email: typeof lead?.email === 'string' ? lead.email : '',
  ciudad: typeof lead?.ciudad === 'string' ? lead.ciudad : '',
  buying_intent: typeof lead?.buying_intent === 'string' ? lead.buying_intent : 'BAJO',
  ai_paused: Boolean(lead?.ai_paused),
  payment_status: typeof lead?.payment_status === 'string' ? lead.payment_status : 'NONE',
  platform: typeof lead?.platform === 'string' ? lead.platform : 'WHATSAPP',
});

const ChatViewer = ({ lead, open, onOpenChange }: ChatViewerProps) => {
  const parsedLead = useMemo(() => safeLead(lead), [lead]);
  const { messages, loading, refetch } = useRealtimeMessages(parsedLead.id || null, open);
  const [sending, setSending] = useState(false);
  const initials = parsedLead.nombre.slice(0, 2).toUpperCase() || 'CL';

  const handleSendMessage = async (text: string, file?: File, isInternalNote?: boolean) => {
    if (!parsedLead.id) return;
    setSending(true);

    try {
      if (text.trim() === '#STOP' || text.trim() === '#START') {
        const isPaused = text.trim() === '#STOP';

        const { error: leadError } = await supabase
          .from('leads')
          .update({ ai_paused: isPaused })
          .eq('id', parsedLead.id);

        if (leadError) throw leadError;

        const { error: noteError } = await supabase.from('conversaciones').insert({
          lead_id: parsedLead.id,
          mensaje: `IA ${isPaused ? 'Pausada' : 'Activada'} manualmente.`,
          emisor: 'NOTA',
          platform: 'PANEL_INTERNO',
        });

        if (noteError) throw noteError;

        toast.success(`Samurai ${isPaused ? 'pausado' : 'activado'}`);
        refetch();
        return;
      }

      if (isInternalNote) {
        const { error } = await supabase.from('conversaciones').insert({
          lead_id: parsedLead.id,
          mensaje: text,
          emisor: 'NOTA',
          platform: 'PANEL_INTERNO',
        });

        if (error) throw error;
        toast.success('Nota guardada');
        refetch();
        return;
      }

      let mediaData:
        | { url: string; type: string; mimetype: string; name: string }
        | undefined;

      if (file) {
        const ext = file.name.split('.').pop() || 'bin';
        const filePath = `chat_uploads/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from('media').getPublicUrl(filePath);

        mediaData = {
          url: publicUrl,
          type: file.type.startsWith('image/')
            ? 'image'
            : file.type.startsWith('video/')
              ? 'video'
              : 'document',
          mimetype: file.type,
          name: file.name,
        };
      }

      await sendEvolutionMessage(parsedLead.telefono, text, parsedLead.id, mediaData);

      const { error: insertError } = await supabase.from('conversaciones').insert({
        lead_id: parsedLead.id,
        mensaje: text || (file ? `[ARCHIVO: ${file.name}]` : ''),
        emisor: 'HUMANO',
        platform: 'PANEL',
        metadata: mediaData
          ? {
              mediaUrl: mediaData.url,
              mediaType: mediaData.type,
              fileName: mediaData.name,
            }
          : {},
      });

      if (insertError) throw insertError;

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
          <div className="flex h-16 items-center justify-between border-b border-[#1a1a1a] bg-[#0a0a0c] px-4">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-10 w-10 border border-[#222225] bg-[#121214]">
                <AvatarFallback className="bg-transparent text-indigo-400 font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-white">
                    {parsedLead.nombre}
                  </p>
                  <Badge
                    variant="outline"
                    className="hidden sm:inline-flex border-[#333336] text-[9px] uppercase text-slate-400"
                  >
                    {parsedLead.platform}
                  </Badge>
                </div>
                <p className="text-[10px] font-mono text-slate-500">
                  {parsedLead.telefono || 'Sin teléfono'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {parsedLead.payment_status === 'VALID' && (
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] uppercase">
                  Pago OK
                </Badge>
              )}

              <Button
                size="sm"
                variant="outline"
                className="border-[#333336] bg-[#121214] text-slate-300 hover:bg-[#161618]"
                onClick={() =>
                  handleSendMessage(parsedLead.ai_paused ? '#START' : '#STOP')
                }
                disabled={sending}
              >
                {parsedLead.ai_paused ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="text-slate-400 hover:text-white"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              </div>
            ) : (
              <MessageList messages={Array.isArray(messages) ? messages : []} loading={false} />
            )}
          </div>

          <div className="border-t border-[#1a1a1a] bg-[#0a0a0c] p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500">
              <MessageCircle className="h-3.5 w-3.5" />
              Chat estable
            </div>
            <MessageInput
              onSendMessage={handleSendMessage}
              sending={sending}
              isAiPaused={parsedLead.ai_paused}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ChatViewer;