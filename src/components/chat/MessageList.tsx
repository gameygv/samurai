import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Bot, UserCog, Mic, Volume2, Image as ImageIcon, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

  const renderMessageContent = (text: string) => {
    // 1. Detección de Transcripción de Audio
    if (text.includes('[TRANSCRIPCIÓN AUDIO]:')) {
      const cleanText = text.replace('[TRANSCRIPCIÓN AUDIO]:', '').trim();
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-indigo-300 font-bold uppercase bg-indigo-900/30 p-1.5 rounded">
            <Mic className="w-3 h-3" /> Nota de Voz Transcrita
          </div>
          <p className="italic text-slate-300">"{cleanText.replace(/"/g, '')}"</p>
        </div>
      );
    }

    // 2. Detección de Imagen Enviada (Log del Webhook)
    if (text.includes('[IMG:')) {
      const imgMatch = text.match(/\[IMG: (.*?)\]/);
      const url = imgMatch ? imgMatch[1] : '';
      const caption = text.replace(/\[IMG: .*?\]/, '').trim();
      
      return (
        <div className="space-y-3">
          <div className="relative group overflow-hidden rounded-lg border border-slate-700 max-w-[200px]">
             <img src={url} alt="Poster enviado" className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
             <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={url} target="_blank" rel="noreferrer" className="text-[10px] text-white font-bold flex items-center gap-1 bg-black/80 px-2 py-1 rounded-full">
                   <ImageIcon className="w-3 h-3" /> VER FULL
                </a>
             </div>
          </div>
          {caption && <p className="whitespace-pre-wrap leading-relaxed">{caption}</p>}
        </div>
      );
    }

    // 3. Texto Normal
    return <p className="whitespace-pre-wrap leading-relaxed text-xs">{text}</p>;
  };

  return (
    <ScrollArea className="flex-1 p-4 bg-slate-950">
      {loading ? (
        <div className="flex h-full items-center justify-center text-slate-500 text-xs">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando historial...
        </div>
      ) : (
        <div className="space-y-6 pb-4">
          {messages.map((msg) => {
            const isSamurai = msg.emisor === 'SAMURAI';
            const isSystem = msg.emisor === 'SISTEMA' || msg.mensaje.includes('[ALERTA]');

            if (isSystem) {
               return (
                  <div key={msg.id} className="flex justify-center my-4">
                     <Badge variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-500 bg-yellow-500/5 py-1">
                        {msg.mensaje}
                     </Badge>
                  </div>
               );
            }

            return (
              <div key={msg.id} className={`flex ${msg.emisor === 'CLIENTE' ? 'justify-start' : 'justify-end'}`}>
                <div className={`flex flex-col max-w-[85%] ${msg.emisor === 'CLIENTE' ? 'items-start' : 'items-end'}`}>
                   
                   {/* Bubble */}
                   <div
                    className={`rounded-2xl p-3 text-sm shadow-md relative group border
                      ${msg.emisor === 'CLIENTE' ? 'bg-slate-900 border-slate-800 text-slate-200 rounded-tl-none' :
                        'bg-indigo-600/10 border-indigo-500/20 text-indigo-100 rounded-tr-none'}
                    `}
                  >
                    {renderMessageContent(msg.mensaje)}
                  </div>

                  {/* Meta info */}
                  <div className="flex items-center gap-2 mt-1 px-1">
                     <span className="text-[9px] text-slate-600 font-mono">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                     </span>
                     {isSamurai && (
                        <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1">
                           <Bot className="w-3 h-3" /> AI
                        </span>
                     )}
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