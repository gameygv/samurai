import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Bot, User, MessageCircle, AlertCircle, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageListProps {
  messages: any[];
  loading: boolean;
}

export const MessageList = ({ messages, loading }: MessageListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs gap-2 bg-slate-950">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Cargando conversación...
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <div className="text-center text-slate-600">
          <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-xs uppercase tracking-widest">Sin mensajes aún</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 bg-slate-950">
      <div className="p-4 space-y-3 pb-6">
        {messages.map((msg) => {
          const emisor = (msg.emisor || '').toUpperCase();
          const isClient = emisor === 'CLIENTE';
          const isAI = emisor === 'IA' || emisor === 'SAMURAI';
          const isHuman = emisor === 'HUMANO';
          const isNote = emisor === 'NOTA';
          const isError = msg.platform === 'ERROR';

          // Notas internas - centradas
          if (isNote) {
            return (
              <div key={msg.id} className="flex justify-center animate-in fade-in duration-200">
                <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-500/20 text-amber-400 text-[10px] px-3 py-1.5 rounded-full max-w-[80%]">
                  <StickyNote className="w-3 h-3 shrink-0" />
                  <span className="italic">{msg.mensaje}</span>
                </div>
              </div>
            );
          }

          // Errores - centrados en rojo
          if (isError) {
            return (
              <div key={msg.id} className="flex justify-center animate-in fade-in duration-200">
                <div className="flex items-center gap-2 bg-red-900/20 border border-red-500/30 text-red-400 text-[10px] px-3 py-1.5 rounded-lg max-w-[90%]">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span className="font-mono">{msg.mensaje}</span>
                </div>
              </div>
            );
          }

          // Mensajes normales
          const isRight = isAI || isHuman;

          return (
            <div
              key={msg.id}
              className={cn(
                "flex w-full animate-in fade-in slide-in-from-bottom-1 duration-200",
                isRight ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn("max-w-[80%] flex flex-col gap-1", isRight ? "items-end" : "items-start")}>
                {/* Burbuja del mensaje */}
                <div className={cn(
                  "px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm",
                  isClient && "bg-slate-800 text-slate-100 rounded-bl-sm",
                  isAI && "bg-indigo-600 text-white rounded-br-sm",
                  isHuman && "bg-emerald-700 text-white rounded-br-sm",
                )}>
                  <p className="whitespace-pre-wrap break-words">{msg.mensaje}</p>
                </div>

                {/* Etiqueta de emisor */}
                <div className={cn(
                  "flex items-center gap-1 px-1",
                  isRight ? "flex-row-reverse" : "flex-row"
                )}>
                  {isAI && <Bot className="w-3 h-3 text-indigo-400" />}
                  {isHuman && <User className="w-3 h-3 text-emerald-400" />}
                  <span className={cn(
                    "text-[9px] font-mono uppercase tracking-wider",
                    isAI ? "text-indigo-400" : isHuman ? "text-emerald-400" : "text-slate-500"
                  )}>
                    {isAI ? 'Samurai IA' : isHuman ? 'Vendedor' : 'Cliente'}
                    {' · '}
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>
    </ScrollArea>
  );
};