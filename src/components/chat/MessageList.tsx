import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Bot, User, Mic, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageListProps {
  messages: any[];
  loading: boolean;
}

export const MessageList = ({ messages, loading }: MessageListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <ScrollArea className="flex-1 p-4 bg-slate-950">
      {loading ? (
        <div className="flex h-full items-center justify-center text-slate-500 text-xs gap-2">
           <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Sincronizando...
        </div>
      ) : (
        <div className="space-y-6 pb-4">
          {messages.map((msg) => {
             const emisor = (msg.emisor || '').toUpperCase();
             const isClient = emisor === 'CLIENTE';
             const isAI = emisor === 'IA' || emisor === 'SAMURAI';
             const isHuman = emisor === 'HUMANO';
             
             const align = isClient ? 'justify-start' : 'justify-end';
             
             return (
              <div key={msg.id} className={cn("flex w-full animate-in fade-in duration-300", align)}>
                <div className={cn("max-w-[85%] flex flex-col", isClient ? "items-start" : "items-end")}>
                   <div className={cn(
                      "p-3.5 rounded-2xl text-sm border shadow-sm",
                      isClient ? "bg-slate-900 border-slate-800 text-slate-200 rounded-bl-none" : 
                      isAI ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-100 rounded-br-none" : 
                      "bg-emerald-600/10 border-emerald-500/30 text-emerald-100 rounded-br-none"
                   )}>
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.mensaje}</p>
                   </div>
                   <div className="flex items-center gap-1.5 mt-1.5 px-1 opacity-40">
                      {isAI && <Bot className="w-3 h-3 text-indigo-400" />}
                      {isHuman && <User className="w-3 h-3 text-emerald-400" />}
                      <span className="text-[9px] font-mono uppercase tracking-widest">
                         {isAI ? 'Samurai AI' : isHuman ? 'Vendedor' : 'Cliente'} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                   </div>
                </div>
              </div>
          )})}
          <div ref={scrollRef} />
        </div>
      )}
    </ScrollArea>
  );
};