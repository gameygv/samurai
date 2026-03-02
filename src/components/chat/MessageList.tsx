import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Bot, UserCog, Mic, Volume2 } from 'lucide-react';

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
  }, [messages]);

  const isAudio = (text: string) => text.includes('<<AUDIO:') || text.includes('[AUDIO]');

  return (
    <ScrollArea className="flex-1 p-4">
      {loading ? (
        <div className="flex h-full items-center justify-center text-slate-500 text-xs">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando historial...
        </div>
      ) : (
        <div className="space-y-4 pb-4">
          {messages.map((msg) => {
            const audioMatch = msg.mensaje.match(/<<AUDIO:(.*?)>>/);
            const audioUrl = audioMatch ? audioMatch[1] : null;

            return (
              <div key={msg.id} className={`flex ${msg.emisor === 'CLIENTE' ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm relative group
                    ${msg.emisor === 'CLIENTE' ? 'bg-slate-800 text-slate-200 rounded-tl-none' :
                      msg.emisor === 'SAMURAI' ? 'bg-indigo-600 text-white rounded-tr-none' :
                      'bg-slate-700 text-slate-300 rounded-tr-none border border-slate-600'}
                    ${msg.mensaje.includes('#STOP') || msg.mensaje.includes('#START') || msg.mensaje.includes('#CIA') ? 'border-yellow-500/50 bg-yellow-900/10' : ''}
                  `}
                >
                  {msg.emisor !== 'CLIENTE' && (
                    <div className="text-[9px] opacity-70 mb-1 font-bold flex items-center gap-1 uppercase tracking-wider">
                      {msg.emisor === 'SAMURAI' ? <Bot className="w-3 h-3" /> : <UserCog className="w-3 h-3" />}
                      {msg.emisor}
                    </div>
                  )}

                  {audioUrl ? (
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <div className="flex items-center gap-2 text-[10px] text-indigo-300 font-bold uppercase">
                         <Mic className="w-3 h-3" /> Nota de Voz
                      </div>
                      <audio controls className="h-8 w-full filter invert brightness-200">
                        <source src={audioUrl} type="audio/mpeg" />
                        Tu navegador no soporta audio.
                      </audio>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed text-xs">{msg.mensaje}</p>
                  )}
                  
                  <div className="text-[8px] opacity-0 group-hover:opacity-50 transition-opacity mt-1 text-right">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      )}
    </ScrollArea>
  );
};