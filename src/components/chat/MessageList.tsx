import React, { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Bot, Mic, Image as ImageIcon, Waves, FileText, Download } from 'lucide-react';
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

  const renderMessageContent = (msg: any) => {
    const text = msg.mensaje;
    
    // Transcripciones de audio de la IA
    if (text.includes('[TRANSCRIPCIÓN AUDIO]')) {
      const cleanText = text.replace(/\[TRANSCRIPCIÓN AUDIO\]:?/, '').replace(/^ "/, '').replace(/"$/, '').trim();
      return (
        <div className="space-y-2 min-w-[200px]">
          <div className="flex items-center gap-2 text-[10px] text-indigo-300 font-bold uppercase bg-indigo-500/10 border border-indigo-500/20 p-2 rounded-lg">
            <div className="p-1 bg-indigo-500 rounded-full text-white"><Mic className="w-3 h-3" /></div>
            <span className="flex-1">Nota de Voz</span>
            <Waves className="w-4 h-4 text-indigo-400 animate-pulse" />
          </div>
          <p className="italic text-slate-300 text-sm leading-relaxed pl-1 border-l-2 border-indigo-500/30">
            "{cleanText}"
          </p>
        </div>
      );
    }

    // Media adjunta desde el panel (Metadata JSON)
    if (msg.metadata?.mediaUrl) {
      const isImg = msg.metadata.mediaType === 'image';
      return (
        <div className="space-y-2">
          {isImg ? (
            <div className="relative rounded-xl border border-slate-700/50 overflow-hidden max-w-[240px] bg-black shadow-lg">
              <img src={msg.metadata.mediaUrl} alt="Adjunto" className="w-full h-auto object-cover" />
            </div>
          ) : (
            <a href={msg.metadata.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-700 rounded-lg hover:border-indigo-500 transition-colors max-w-[240px]">
              <div className="p-2 bg-indigo-900/50 text-indigo-400 rounded-lg shrink-0"><FileText className="w-5 h-5"/></div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-200 truncate">{msg.metadata.fileName || 'Documento adjunto'}</span>
                <span className="text-[10px] text-indigo-400 flex items-center gap-1"><Download className="w-3 h-3"/> Descargar</span>
              </div>
            </a>
          )}
          {text && !text.includes('[ARCHIVO ENVIADO]') && <p className="whitespace-pre-wrap leading-relaxed text-sm mt-2">{text}</p>}
        </div>
      );
    }

    // Media antigua en texto plano [IMG: url] (Legacy support)
    const mediaRegex = /<<MEDIA:(.*?)>>/;
    const imgInLog = text.match(/\[IMG: (.*?)\]/);
    const mediaInAi = text.match(mediaRegex);
    
    const url = imgInLog ? imgInLog[1] : (mediaInAi ? mediaInAi[1] : null);
    let cleanText = text.replace(/\[IMG: .*?\]/, '').replace(mediaRegex, '').trim();

    return (
      <div className="space-y-2">
        {url && (
          <div className="relative rounded-xl border border-slate-700/50 overflow-hidden max-w-[240px] mb-2 bg-black shadow-lg group">
             <img src={url} alt="Poster" className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
             <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[9px] font-bold text-white flex items-center gap-1 border border-white/10">
                <ImageIcon className="w-3 h-3" /> POSTER
             </div>
          </div>
        )}
        {cleanText && <p className="whitespace-pre-wrap leading-relaxed text-sm">{cleanText}</p>}
      </div>
    );
  };

  return (
    <ScrollArea className="flex-1 p-4 bg-slate-950">
      {loading ? (
        <div className="flex h-full items-center justify-center text-slate-500 text-xs gap-2">
           <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Sincronizando historial...
        </div>
      ) : (
        <div className="space-y-6 pb-4">
          {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.emisor === 'CLIENTE' ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`flex flex-col max-w-[85%] ${msg.emisor === 'CLIENTE' ? 'items-start' : 'items-end'}`}>
                   <div className={`rounded-2xl p-3.5 text-sm shadow-sm border ${
                      msg.emisor === 'CLIENTE' 
                      ? 'bg-slate-900 border-slate-800 text-slate-200 rounded-bl-sm' 
                      : 'bg-indigo-600/10 border-indigo-500/20 text-indigo-100 rounded-br-sm'
                   }`}>
                    {renderMessageContent(msg)}
                  </div>
                  <div className="flex items-center gap-2 mt-1 px-1 opacity-60">
                     {(msg.emisor === 'IA' || msg.emisor === 'SAMURAI') && <Bot className="w-3 h-3 text-indigo-400" />}
                     <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">
                        {(msg.emisor === 'IA' || msg.emisor === 'SAMURAI') ? 'ELEPHANT BOWL AI' : (msg.emisor === 'HUMANO' ? 'AGENTE' : 'CLIENTE')} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                     </span>
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