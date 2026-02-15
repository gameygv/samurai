import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, Bot, User, UserCog, ShieldAlert, ZapOff, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { logActivity } from '@/utils/logger';

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
  const [isAiPaused, setIsAiPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && lead) {
      fetchMessages();
      subscribeToMessages();
      // Simular chequeo de estado de pausa
      setIsAiPaused(lead.ai_paused || false);
    }
  }, [open, lead]);

  useEffect(() => {
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

    if (!error && data) setMessages(data);
    setLoading(false);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`chat:${lead.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversaciones', filter: `lead_id=eq.${lead.id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const toggleAiPause = async () => {
    const newState = !isAiPaused;
    setIsAiPaused(newState);
    
    await logActivity({
      action: newState ? 'UPDATE' : 'CREATE',
      resource: 'SYSTEM',
      description: `${newState ? 'PAUSADO' : 'ACTIVADO'} Samurai para lead: ${lead.nombre}`,
      status: 'OK'
    });

    toast.info(newState ? 'Samurai pausado. Puedes hablar libremente.' : 'Samurai reactivado.');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase.from('conversaciones').insert({
        lead_id: lead.id,
        mensaje: newMessage,
        emisor: 'HUMANO',
        platform: 'PANEL'
      });

      if (error) throw error;
      
      if (!isAiPaused) {
         // Auto-pausar si un humano escribe
         toggleAiPause();
      }

      setNewMessage('');
    } catch (error: any) {
      toast.error('Error enviando mensaje');
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col bg-slate-950 border-l border-slate-800 text-white p-0 shadow-2xl">
        <SheetHeader className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-row items-center justify-between gap-4 space-y-0">
          <div className="flex items-center gap-3">
             <Avatar className="h-10 w-10 border border-slate-700">
                <AvatarFallback className="bg-indigo-600 text-white">{lead?.nombre?.substring(0, 2).toUpperCase() || 'CL'}</AvatarFallback>
             </Avatar>
             <div>
                <div className="text-sm font-bold truncate max-w-[120px]">{lead?.nombre || 'Cliente'}</div>
                <div className="text-[10px] text-slate-500 font-mono">{lead?.telefono}</div>
             </div>
          </div>
          
          <Button 
             variant={isAiPaused ? "destructive" : "outline"} 
             size="sm" 
             onClick={toggleAiPause}
             className="h-8 text-[10px] px-2"
          >
             {isAiPaused ? <ZapOff className="w-3 h-3 mr-1" /> : <Bot className="w-3 h-3 mr-1" />}
             {isAiPaused ? 'IA PAUSADA' : 'AI ACTIVA'}
          </Button>
        </SheetHeader>

        <ScrollArea className="flex-1 p-4 bg-slate-950">
          {loading ? (
             <div className="flex h-full items-center justify-center text-slate-500 text-xs"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Historial...</div>
          ) : (
             <div className="space-y-4">
                {messages.map((msg) => (
                   <div key={msg.id} className={`flex ${msg.emisor === 'CLIENTE' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${msg.emisor === 'CLIENTE' ? 'bg-slate-800 text-slate-200 rounded-tl-none' : msg.emisor === 'SAMURAI' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-700 text-slate-300 rounded-tr-none border border-slate-600'}`}>
                         {msg.emisor !== 'CLIENTE' && (
                            <div className="text-[10px] opacity-70 mb-1 font-bold flex items-center gap-1 uppercase">
                               {msg.emisor === 'SAMURAI' ? <Bot className="w-3 h-3" /> : <UserCog className="w-3 h-3" />}
                               {msg.emisor}
                            </div>
                         )}
                         <p className="whitespace-pre-wrap leading-relaxed text-xs">{msg.mensaje}</p>
                         <span className="text-[9px] opacity-40 block text-right mt-1">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                   </div>
                ))}
                <div ref={scrollRef} />
             </div>
          )}
        </ScrollArea>

        <div className="p-4 bg-slate-900 border-t border-slate-800 shadow-inner">
           <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input 
                 value={newMessage}
                 onChange={(e) => setNewMessage(e.target.value)}
                 className="bg-slate-950 border-slate-700 text-sm h-10"
                 placeholder="Responder manualmente..."
                 disabled={sending}
              />
              <Button type="submit" size="icon" className="bg-indigo-600 hover:bg-indigo-700 shrink-0" disabled={sending || !newMessage.trim()}>
                 {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
           </form>
           {isAiPaused && (
              <div className="mt-2 text-[10px] text-red-400 bg-red-400/5 p-2 rounded border border-red-400/10 flex items-center gap-2">
                 <ShieldAlert className="w-3 h-3" /> La IA no responderá hasta que la reactives.
              </div>
           )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ChatViewer;