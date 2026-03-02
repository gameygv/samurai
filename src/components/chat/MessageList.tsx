import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Bot, Mic, Image as ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MessageListProps {
  messages: any[];
  loading: boolean;
}

export const MessageList = ({ messages, loading }: MessageListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const renderMessageContent = (text: string) => {
    // 1. Audio
    if (text.includes('[TRANSCRIPCIÓN AUDIO]:')) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-indigo-300 font-bold uppercase bg-indigo-900/30 p-1 rounded">
            <Mic className="w-3 h-3" /> Audio Transcrito
          </div>
          <p className="italic text-slate-300 text-xs">"{text.replace('[TRANSCRIPCIÓN AUDIO]:', '').trim().replace(/"/g, '')}"</p>
        </div>
      );
    }

    // 2. Imagen (Lógica limpia)
    const mediaRegex = /<<MEDIA:(.*?)>>/;
    const imgInLog = text.match(/\[IMG: (.*?)\]/);
    const mediaInAi = text.match(mediaRegex);
    
    const url = imgInLog ? imgInLog[1] : (mediaInAi ? mediaInAi[1] : null);
    let cleanText = text.replace(/\[IMG: .*?\]/, '').replace(mediaRegex, '').trim();

    return (
      <div className="space-y-2">
        {url && (
          <div className="relative rounded-lg border border-slate-700 overflow-hidden max-w-[200px] mb-2">
             <img src={url} alt="Poster" className="w-full h-auto" />
             <div className="absolute top-1 right-1 bg-black/60 p-1 rounded text-[8px] text-white">POSTER</div>
          </div>
        )}
        {cleanText && <p className="whitespace-pre-wrap leading-relaxed text-xs">{cleanText}</p>}
      </div>
    );
  };

  return (
    <ScrollArea className="flex-1 p-4 bg-slate-950">
      {loading ? (
        <div className="flex h-full items-center justify-center text-slate-500 text-xs"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Sincronizando...</div>
      ) : (
        <div className="space-y-6 pb-4">
          {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.emisor === 'CLIENTE' ? 'justify-start' : 'justify-end'}`}>
                <div className={`flex flex-col max-w-[85%] ${msg.emisor === 'CLIENTE' ? 'items-start' : 'items-end'}`}>
                   <div className={`rounded-2xl p-3 text-sm shadow-md border ${msg.emisor === 'CLIENTE' ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-indigo-600/10 border-indigo-500/20 text-indigo-100'}`}>
                    {renderMessageContent(msg.mensaje)}
                  </div>
                  <div className="flex items-center gap-2 mt-1 px-1">
                     <span className="text-[9px] text-slate-600 font-mono">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                     {msg.emisor === 'SAMURAI' && <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1"><Bot className="w-3 h-3" /> AI</span>}
                  </div>
                </div>
              </div>
          ))}
          <div ref={scrollRef} />
        </div>
      )}
    </ScrollArea>
  );
};