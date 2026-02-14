import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Bot, User, UserCog } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ChatViewerProps {
  lead: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ChatViewer = ({ lead, open, onOpenChange }: ChatViewerProps) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && lead) {
      fetchMessages();
      subscribeToMessages();
    }
  }, [open, lead]);

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('conversaciones')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
    setLoading(false);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`chat:${lead.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversaciones',
          filter: `lead_id=eq.${lead.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      // 1. Insert into DB (this will trigger the subscription update locally)
      // In a real scenario, you might want to call an Edge Function to send to Kommo/WhatsApp first.
      const { error } = await supabase.from('conversaciones').insert({
        lead_id: lead.id,
        mensaje: newMessage,
        emisor: 'HUMANO',
        platform: 'PANEL'
      });

      if (error) throw error;
      setNewMessage('');
      
      // NOTE: Here you would typically trigger a webhook to send the message to WhatsApp via Kommo
      // e.g. await fetch('/api/send-whatsapp', ...)

    } catch (error: any) {
      toast.error('Error enviando mensaje');
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col bg-slate-950 border-l border-slate-800 text-white p-0">
        <SheetHeader className="p-6 border-b border-slate-800 bg-slate-900/50">
          <SheetTitle className="flex items-center gap-3 text-white">
            <Avatar className="h-10 w-10 border border-slate-700">
               <AvatarImage src="" />
               <AvatarFallback className="bg-indigo-600 text-white">
                  {lead?.nombre?.substring(0, 2).toUpperCase() || 'CL'}
               </AvatarFallback>
            </Avatar>
            <div>
               <div className="text-base font-bold">{lead?.nombre || 'Cliente'}</div>
               <div className="text-xs font-normal text-slate-400 flex items-center gap-2">
                  {lead?.telefono}
                  {lead?.estado_emocional_actual && (
                     <Badge variant="outline" className="text-[10px] h-4 border-slate-600 text-slate-300">
                        {lead.estado_emocional_actual}
                     </Badge>
                  )}
               </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 p-4 bg-slate-950">
          {loading ? (
             <div className="flex h-full items-center justify-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando historial...
             </div>
          ) : messages.length === 0 ? (
             <div className="flex h-full flex-col items-center justify-center text-slate-600 space-y-2">
                <MessageSquare className="w-10 h-10 opacity-20" />
                <p>No hay mensajes previos.</p>
             </div>
          ) : (
             <div className="space-y-4">
                {messages.map((msg) => (
                   <div 
                     key={msg.id} 
                     className={`flex ${msg.emisor === 'CLIENTE' ? 'justify-start' : 'justify-end'}`}
                   >
                      <div className={`
                         max-w-[85%] rounded-2xl p-3 text-sm
                         ${msg.emisor === 'CLIENTE' 
                           ? 'bg-slate-800 text-slate-200 rounded-tl-none' 
                           : msg.emisor === 'SAMURAI' 
                              ? 'bg-indigo-600 text-white rounded-tr-none'
                              : 'bg-slate-700 text-slate-300 rounded-tr-none border border-slate-600' // Humano
                         }
                      `}>
                         {msg.emisor !== 'CLIENTE' && (
                            <div className="text-[10px] opacity-70 mb-1 font-bold flex items-center gap-1">
                               {msg.emisor === 'SAMURAI' ? <Bot className="w-3 h-3" /> : <UserCog className="w-3 h-3" />}
                               {msg.emisor}
                            </div>
                         )}
                         <p className="whitespace-pre-wrap leading-relaxed">{msg.mensaje}</p>
                         <span className="text-[10px] opacity-50 block text-right mt-1">
                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </span>
                      </div>
                   </div>
                ))}
                <div ref={scrollRef} />
             </div>
          )}
        </ScrollArea>

        <div className="p-4 bg-slate-900 border-t border-slate-800">
           <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input 
                 value={newMessage}
                 onChange={(e) => setNewMessage(e.target.value)}
                 className="bg-slate-950 border-slate-700 focus-visible:ring-indigo-500"
                 placeholder="Escribir mensaje manual..."
                 disabled={sending}
              />
              <Button type="submit" size="icon" className="bg-indigo-600 hover:bg-indigo-700" disabled={sending || !newMessage.trim()}>
                 {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
           </form>
           <p className="text-[10px] text-slate-500 text-center mt-2">
              Intervención manual pausará al Samurai por 30 mins.
           </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};

import { MessageSquare } from 'lucide-react';

export default ChatViewer;